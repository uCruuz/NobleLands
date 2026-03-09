/**
 * backend/routes/commands.js
 *
 * GET /api/commands retorna:
 *   - comandos próprios saindo/voltando  (perspective: 'own')
 *   - ataques inimigos chegando          (perspective: 'incoming_attack')
 *
 * O campo `perspective` determina a cor no mapa:
 *   own              → verde (saindo) / azul (apoio, futuro)
 *   incoming_attack  → vermelho
 */

import { Router } from 'express'
import { getDb }  from '../db/database.js'
import { authMiddleware, worldMiddleware } from '../middleware/auth.js'
import { UNIT_CONFIGS } from '../../shared/units.js'
import { getHidingCapacity } from '../../shared/buildings.js'
import {
  calcCommandTimes,
  calcCancelReturnTime,
  slowestSpeed,
  resolveBattle,
  calcLoot,
  resolveEspionage,
  calcReportResult,
} from '../../shared/combat.js'

const router = Router()
router.use(authMiddleware)
router.use(worldMiddleware)

// ── Helpers ────────────────────────────────────────────────────────────────

async function getUserVillage(userId, worldId) {
  const db = await getDb()
  const { rows } = await db.query(
    'SELECT * FROM villages WHERE user_id = $1 AND world_id = $2',
    [userId, worldId]
  )
  return rows[0] ?? null
}

async function getWorldConfig(worldId) {
  const db = await getDb()
  const { rows } = await db.query(
    'SELECT speed, unit_speed FROM world_configs WHERE world_id = $1',
    [worldId]
  )
  return rows[0] ?? { speed: 1, unit_speed: 1 }
}

/**
 * Lê as unidades presentes em uma aldeia como objeto { unitKey: count }.
 * Exclui unidades com count = 0.
 */
async function getVillageTroops(client, villageId) {
  const { rows } = await client.query(
    'SELECT unit_key, count FROM village_units WHERE village_id = $1 AND count > 0',
    [villageId]
  )
  const troops = {}
  for (const r of rows) troops[r.unit_key] = r.count
  return troops
}

/**
 * Lê o nível de um edifício específico de uma aldeia.
 * Retorna 0 se o edifício não existir.
 */
async function getBuildingLevel(client, villageId, buildingKey) {
  const { rows } = await client.query(
    'SELECT level FROM village_buildings WHERE village_id = $1 AND building_key = $2',
    [villageId, buildingKey]
  )
  return rows[0]?.level ?? 0
}

/**
 * Lê os recursos atuais de uma aldeia (sem projeção de produção passiva).
 */
async function getVillageResources(client, villageId) {
  const { rows } = await client.query(
    'SELECT wood, stone, iron FROM village_resources WHERE village_id = $1',
    [villageId]
  )
  return rows[0] ?? { wood: 0, stone: 0, iron: 0 }
}

// ── Processamento de chegada de ataques ───────────────────────────────────

/**
 * Processa um comando de ataque que acabou de chegar ao alvo.
 * Executa dentro de uma transação de banco já iniciada (client).
 *
 * Fluxo:
 *  1. Lê tropas e estruturas do defensor
 *  2. Resolve a batalha (resolveBattle)
 *  3. Aplica baixas nas unidades do defensor
 *  4. Calcula saque
 *  5. Debita recursos do defensor
 *  6. Atualiza o comando com tropas sobreviventes do atacante e saque
 *  7. Insere relatório para o atacante
 *  8. Insere relatório para o defensor (se tiver dono)
 */
async function processAttack(client, cmd, origin, target, worldId, nowSec) {
  // ── 1. Ler estado do defensor ──────────────────────────────────────────
  const defTroops    = await getVillageTroops(client, cmd.target_village_id)
  const wallLevel    = await getBuildingLevel(client, cmd.target_village_id, 'wall')
  const hideLevel    = await getBuildingLevel(client, cmd.target_village_id, 'hide')
  const hidingCap    = getHidingCapacity(hideLevel)
  const defResources = await getVillageResources(client, cmd.target_village_id)

  // ── 2. Resolver batalha ────────────────────────────────────────────────
  const battle = resolveBattle(cmd.troops, defTroops, wallLevel)

  // ── 3. Aplicar baixas nas unidades do defensor ─────────────────────────
  for (const [unitKey, surviving] of Object.entries(battle.defenderSurvivors)) {
    const lost = (defTroops[unitKey] ?? 0) - surviving
    if (lost > 0) {
      await client.query(
        `UPDATE village_units
         SET count = GREATEST(0, count - $1)
         WHERE village_id = $2 AND unit_key = $3`,
        [lost, cmd.target_village_id, unitKey]
      )
    }
  }

  // ── 4. Calcular saque (só se o atacante venceu) ────────────────────────
  let loot = { wood: 0, stone: 0, iron: 0 }
  if (battle.winner === 'attacker') {
    loot = calcLoot(battle.attackerSurvivors, defResources, hidingCap)
  }

  // ── 5. Debitar recursos do defensor ───────────────────────────────────
  if (loot.wood > 0 || loot.stone > 0 || loot.iron > 0) {
    await client.query(
      `UPDATE village_resources
       SET wood  = GREATEST(0, wood  - $1),
           stone = GREATEST(0, stone - $2),
           iron  = GREATEST(0, iron  - $3)
       WHERE village_id = $4`,
      [loot.wood, loot.stone, loot.iron, cmd.target_village_id]
    )
  }

  // ── 6. Atualizar comando: sobreviventes + saque ────────────────────────
  await client.query(
    `UPDATE commands
     SET status     = 'returning',
         troops     = $1,
         loot_wood  = $2,
         loot_stone = $3,
         loot_iron  = $4
     WHERE id = $5`,
    [
      JSON.stringify(battle.attackerSurvivors),
      loot.wood,
      loot.stone,
      loot.iron,
      cmd.id,
    ]
  )

  // ── 7. Montar dados do relatório ───────────────────────────────────────
  const troopsSentByAttacker = cmd.troops
  const reportBase = {
    attacker: {
      villageName: origin.name,
      playerName:  origin.player_name ?? 'Bárbaro',
      coords:      { x: origin.x, y: origin.y },
      troopsSent:  troopsSentByAttacker,
      troopsLost:  buildLosses(troopsSentByAttacker, battle.attackerSurvivors),
    },
    defender: {
      villageName: target.name,
      playerName:  target.player_name ?? 'Bárbaro',
      coords:      { x: target.x, y: target.y },
      troopsSent:  defTroops,
      troopsLost:  buildLosses(defTroops, battle.defenderSurvivors),
    },
    battle: {
      winner:           battle.winner,
      luck:             battle.luck,
      attackType:       battle.attackType,
      wallLevel,
      wallBonus:        battle.wallBonus,
      effectiveAttack:  battle.effectiveAttack,
      effectiveDefense: battle.effectiveDefense,
    },
    loot,
    travelMs: Number(cmd.arrives_at_ms) - Number(cmd.sent_at_ms),
  }

  // ── 8. Relatório para o atacante ───────────────────────────────────────
  const atkResult  = calcReportResult(battle.winner, troopsSentByAttacker, battle.attackerSurvivors, 'attacker')
  const atkSubject = buildAttackSubject(battle.winner, target.name, target.x, target.y, loot)

  const { rows: repRows } = await client.query(
    `INSERT INTO reports
       (world_id, owner_id, attacker_village_id, defender_village_id,
        type, result, subject, read, data_json, created_at)
     VALUES ($1, $2, $3, $4, 'attack', $5, $6, false, $7, $8)
     RETURNING id`,
    [
      worldId,
      origin.user_id,
      cmd.origin_village_id,
      cmd.target_village_id,
      atkResult,
      atkSubject,
      JSON.stringify(reportBase),
      nowSec,
    ]
  )
  const reportId = repRows[0]?.id ?? null

  await client.query(
    'UPDATE commands SET report_id = $1 WHERE id = $2',
    [reportId, cmd.id]
  )

  // ── 9. Relatório para o defensor (se tiver dono humano) ───────────────
  if (target.user_id) {
    const defResult  = calcReportResult(battle.winner, troopsSentByAttacker, battle.attackerSurvivors, 'defender')
    const defSubject = buildDefenseSubject(battle.winner, origin.name, origin.x, origin.y)

    await client.query(
      `INSERT INTO reports
         (world_id, owner_id, attacker_village_id, defender_village_id,
          type, result, subject, read, data_json, created_at)
       VALUES ($1, $2, $3, $4, 'attack', $5, $6, false, $7, $8)`,
      [
        worldId,
        target.user_id,
        cmd.origin_village_id,
        cmd.target_village_id,
        defResult,
        defSubject,
        JSON.stringify(reportBase),
        nowSec,
      ]
    )
  }
}

/**
 * Processa um comando de espionagem que acabou de chegar ao alvo.
 */
async function processEspionage(client, cmd, origin, target, worldId, nowSec) {
  // Espiões do atacante
  const attackingSpies = cmd.troops['spy'] ?? 0

  // Espiões do defensor presentes na aldeia alvo
  const defTroops = await getVillageTroops(client, cmd.target_village_id)
  const defendingSpies = defTroops['spy'] ?? 0
  const wallLevel      = await getBuildingLevel(client, cmd.target_village_id, 'wall')

  const result = resolveEspionage(attackingSpies, defendingSpies, wallLevel)

  // ── Baixas nos espiões do defensor ────────────────────────────────────
  if (result.defenderSpiesLost > 0) {
    await client.query(
      `UPDATE village_units
       SET count = GREATEST(0, count - $1)
       WHERE village_id = $2 AND unit_key = 'spy'`,
      [result.defenderSpiesLost, cmd.target_village_id]
    )
  }

  // ── Espiões sobreviventes do atacante que voltam ──────────────────────
  const survivingSpies = attackingSpies - result.attackerSpiesLost
  await client.query(
    `UPDATE commands
     SET status = 'returning',
         troops = $1
     WHERE id = $2`,
    [JSON.stringify({ spy: survivingSpies }), cmd.id]
  )

  // ── Dados coletados (só se bem-sucedido) ──────────────────────────────
  let spiedResources = null
  let spiedTroops    = null

  if (result.success) {
    spiedResources = await getVillageResources(client, cmd.target_village_id)
    spiedTroops    = defTroops
  }

  const reportData = {
    attacker: {
      villageName: origin.name,
      playerName:  origin.player_name ?? 'Bárbaro',
      coords:      { x: origin.x, y: origin.y },
      spiesSent:   attackingSpies,
      spiesLost:   result.attackerSpiesLost,
    },
    defender: {
      villageName: target.name,
      playerName:  target.player_name ?? 'Bárbaro',
      coords:      { x: target.x, y: target.y },
      spiesLost:   result.defenderSpiesLost,
    },
    success:   result.success,
    resources: spiedResources,
    troops:    spiedTroops,
    travelMs:  Number(cmd.arrives_at_ms) - Number(cmd.sent_at_ms),
  }

  // Relatório para o atacante
  const atkResult  = result.success ? 'green' : 'red'
  const atkSubject = result.success
    ? `Espionagem bem-sucedida em ${target.name} (${target.x}|${target.y})`
    : `Espionagem falhou em ${target.name} (${target.x}|${target.y})`

  const { rows: repRows } = await client.query(
    `INSERT INTO reports
       (world_id, owner_id, attacker_village_id, defender_village_id,
        type, result, subject, read, data_json, created_at)
     VALUES ($1, $2, $3, $4, 'spy', $5, $6, false, $7, $8)
     RETURNING id`,
    [
      worldId,
      origin.user_id,
      cmd.origin_village_id,
      cmd.target_village_id,
      atkResult,
      atkSubject,
      JSON.stringify(reportData),
      nowSec,
    ]
  )

  await client.query(
    'UPDATE commands SET report_id = $1 WHERE id = $2',
    [repRows[0]?.id ?? null, cmd.id]
  )

  // Relatório para o defensor (apenas se a espionagem falhou —
  // se foi bem-sucedida, o defensor não sabe que foi espionado)
  if (!result.success && target.user_id) {
    const defSubject = `Tentativa de espionagem detectada de ${origin.name} (${origin.x}|${origin.y})`
    await client.query(
      `INSERT INTO reports
         (world_id, owner_id, attacker_village_id, defender_village_id,
          type, result, subject, read, data_json, created_at)
       VALUES ($1, $2, $3, $4, 'spy', 'green', $5, false, $6, $7)`,
      [
        worldId,
        target.user_id,
        cmd.origin_village_id,
        cmd.target_village_id,
        defSubject,
        JSON.stringify(reportData),
        nowSec,
      ]
    )
  }
}

// ── Helpers de relatório ───────────────────────────────────────────────────

/**
 * Calcula as perdas de um lado: { unitKey: quantidade_perdida }.
 */
function buildLosses(sent, survivors) {
  const losses = {}
  for (const [k, q] of Object.entries(sent)) {
    const lost = q - (survivors[k] ?? 0)
    if (lost > 0) losses[k] = lost
  }
  return losses
}

function buildAttackSubject(winner, targetName, tx, ty, loot) {
  const coords = `${targetName} (${tx}|${ty})`
  if (winner !== 'attacker') return `Ataque derrotado em ${coords}`
  const totalLoot = loot.wood + loot.stone + loot.iron
  if (totalLoot > 0) return `Ataque bem-sucedido em ${coords} (+${totalLoot} recursos)`
  return `Ataque bem-sucedido em ${coords}`
}

function buildDefenseSubject(winner, originName, ox, oy) {
  const coords = `${originName} (${ox}|${oy})`
  if (winner === 'attacker') return `Sua aldeia foi atacada por ${coords}`
  return `Ataque de ${coords} foi repelido`
}

// ── processCommands ────────────────────────────────────────────────────────

async function processCommands(villageId, worldId) {
  const db  = await getDb()
  const now = Date.now()
  const nowSec = Math.floor(now / 1000)

  // ── Ataques/espionagens chegando ao alvo ──────────────────────────────
  // Buscamos por TARGET (não por origem) para processar ataques recebidos
  // mesmo quando o dono do alvo não está online.
  // Adicionalmente, processamos também ataques saindo desta aldeia para
  // garantir que o retorno seja creditado.
  const { rows: arriving } = await db.query(
    `SELECT * FROM commands
     WHERE (origin_village_id = $1 OR target_village_id = $1)
       AND status = 'traveling'
       AND arrives_at_ms::bigint <= $2`,
    [villageId, now]
  )

  for (const cmd of arriving) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const { rows: originRows } = await client.query(
        `SELECT v.id, v.name, v.x, v.y, v.user_id, u.username AS player_name
         FROM villages v LEFT JOIN users u ON u.id = v.user_id
         WHERE v.id = $1`,
        [cmd.origin_village_id]
      )
      const { rows: targetRows } = await client.query(
        `SELECT v.id, v.name, v.x, v.y, v.user_id, u.username AS player_name
         FROM villages v LEFT JOIN users u ON u.id = v.user_id
         WHERE v.id = $1`,
        [cmd.target_village_id]
      )

      const origin = originRows[0]
      const target = targetRows[0]

      if (!origin || !target) {
        await client.query('ROLLBACK')
        continue
      }

      if (cmd.type === 'spy') {
        await processEspionage(client, cmd, origin, target, worldId, nowSec)
      } else {
        // 'attack' (e futuramente 'support')
        await processAttack(client, cmd, origin, target, worldId, nowSec)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      console.error('[processCommands] Erro chegada cmd:', cmd.id, e)
    } finally {
      client.release()
    }
  }

  // ── Tropas retornando ─────────────────────────────────────────────────
  const { rows: returning } = await db.query(
    `SELECT * FROM commands
     WHERE origin_village_id = $1
       AND status = 'returning'
       AND returns_at_ms::bigint <= $2`,
    [villageId, now]
  )

  for (const cmd of returning) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Credita tropas sobreviventes
      for (const [unitKey, qty] of Object.entries(cmd.troops)) {
        if (!qty || qty <= 0) continue
        await client.query(
          `INSERT INTO village_units (village_id, unit_key, count) VALUES ($1, $2, $3)
           ON CONFLICT (village_id, unit_key)
           DO UPDATE SET count = village_units.count + EXCLUDED.count`,
          [cmd.origin_village_id, unitKey, qty]
        )
      }

      // Credita saque
      const lootWood  = cmd.loot_wood  ?? 0
      const lootStone = cmd.loot_stone ?? 0
      const lootIron  = cmd.loot_iron  ?? 0

      if (lootWood > 0 || lootStone > 0 || lootIron > 0) {
        // Respeita a capacidade do armazém da aldeia de origem
        const { rows: storRows } = await client.query(
          `SELECT level FROM village_buildings
           WHERE village_id = $1 AND building_key = 'storage'`,
          [cmd.origin_village_id]
        )
        const storLevel = storRows[0]?.level ?? 1

        // Importa getStorageCapacity para limitar o crédito
        const { getStorageCapacity } = await import('../../shared/buildings.js')
        const cap = getStorageCapacity(storLevel)

        await client.query(
          `UPDATE village_resources
           SET wood  = LEAST($1, wood  + $2),
               stone = LEAST($1, stone + $3),
               iron  = LEAST($1, iron  + $4)
           WHERE village_id = $5`,
          [cap, lootWood, lootStone, lootIron, cmd.origin_village_id]
        )
      }

      await client.query(`UPDATE commands SET status = 'done' WHERE id = $1`, [cmd.id])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      console.error('[processCommands] Erro devolver tropas cmd:', cmd.id, e)
    } finally {
      client.release()
    }
  }
}

// ── Serializa row → objeto frontend ───────────────────────────────────────
function serializeCommand(r, perspective) {
  return {
    id:          r.id,
    type:        r.type,
    status:      r.status,
    troops:      r.troops,
    cancelled:   r.cancelled,
    perspective,
    sentAtMs:    r.sent_at_ms,
    arrivesAtMs: r.arrives_at_ms,
    returnsAtMs: r.returns_at_ms,
    origin: {
      id:         r.origin_village_id,
      name:       r.origin_name,
      x:          r.origin_x,
      y:          r.origin_y,
      playerName: r.origin_player ?? 'Bárbaro',
    },
    target: {
      id:         r.target_village_id,
      name:       r.target_name,
      x:          r.target_x,
      y:          r.target_y,
      playerName: r.target_player ?? 'Bárbaro',
    },
  }
}

// ── GET /api/commands?worldId=X ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processCommands(village.id, req.worldId)

    const db  = await getDb()
    const now = Date.now()

    const BASE_JOIN = `
      SELECT
        c.*,
        ov.name AS origin_name, ov.x AS origin_x, ov.y AS origin_y,
        tv.name AS target_name, tv.x AS target_x, tv.y AS target_y,
        ou.username AS origin_player,
        tu.username AS target_player
      FROM commands c
      JOIN villages ov ON ov.id = c.origin_village_id
      JOIN villages tv ON tv.id = c.target_village_id
      LEFT JOIN users ou ON ou.id = ov.user_id
      LEFT JOIN users tu ON tu.id = tv.user_id
    `

    // Próprios: saindo ou voltando
    const { rows: ownRows } = await db.query(
      `${BASE_JOIN}
       WHERE c.origin_village_id = $1
         AND c.status IN ('traveling', 'returning')
       ORDER BY c.arrives_at_ms ASC`,
      [village.id]
    )

    // Inimigos: ataques chegando nesta aldeia que não são nossos
    const { rows: incomingRows } = await db.query(
      `${BASE_JOIN}
       WHERE c.target_village_id = $1
         AND c.origin_village_id != $1
         AND c.type IN ('attack', 'spy')
         AND c.status = 'traveling'
       ORDER BY c.arrives_at_ms ASC`,
      [village.id]
    )

    const commands = [
      ...ownRows.map(r      => serializeCommand(r, 'own')),
      ...incomingRows.map(r => serializeCommand(r, 'incoming_attack')),
    ]

    res.json({ commands, serverTime: now })
  } catch (e) {
    console.error('[commands GET]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/commands/attack?worldId=X ──────────────────────────────────
router.post('/attack', async (req, res) => {
  try {
    const { troops, targetX, targetY } = req.body

    if (!troops || typeof troops !== 'object')
      return res.status(400).json({ error: 'Tropas inválidas.' })
    if (targetX == null || targetY == null)
      return res.status(400).json({ error: 'Coordenadas do alvo obrigatórias.' })

    const tx = parseInt(targetX, 10)
    const ty = parseInt(targetY, 10)
    if (isNaN(tx) || isNaN(ty))
      return res.status(400).json({ error: 'Coordenadas inválidas.' })

    if (!Object.values(troops).some(q => q > 0))
      return res.status(400).json({ error: 'Selecione ao menos uma unidade.' })

    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    if (village.x === tx && village.y === ty)
      return res.status(400).json({ error: 'Você não pode atacar sua própria aldeia.' })

    const db = await getDb()

    const { rows: targetRows } = await db.query(
      'SELECT * FROM villages WHERE world_id = $1 AND x = $2 AND y = $3',
      [req.worldId, tx, ty]
    )
    const target = targetRows[0]
    if (!target) return res.status(404).json({ error: 'Aldeia alvo não encontrada.' })

    const cleanTroops = {}
    for (const [key, qty] of Object.entries(troops)) {
      const q = parseInt(qty, 10)
      if (!q || q <= 0) continue
      if (!UNIT_CONFIGS[key]) return res.status(400).json({ error: `Unidade desconhecida: ${key}` })
      cleanTroops[key] = q
    }
    if (!Object.keys(cleanTroops).length)
      return res.status(400).json({ error: 'Nenhuma unidade válida selecionada.' })

    if (slowestSpeed(cleanTroops) === 0)
      return res.status(400).json({ error: 'Nenhuma unidade com velocidade.' })

    const worldCfg = await getWorldConfig(req.worldId)
    const now      = Date.now()
    const { travelMs, arrivesAt, returnsAt } = calcCommandTimes(
      village.x, village.y, tx, ty,
      cleanTroops, worldCfg.speed, worldCfg.unit_speed, now
    )

    console.log('[attack] travelMs:', travelMs, 'arrivesAt:', new Date(arrivesAt).toISOString())

    const client = await db.connect()
    let commandId
    try {
      await client.query('BEGIN')

      const { rows: unitRows } = await client.query(
        'SELECT unit_key, count FROM village_units WHERE village_id = $1 FOR UPDATE',
        [village.id]
      )
      const stock = {}
      for (const r of unitRows) stock[r.unit_key] = r.count

      for (const [key, qty] of Object.entries(cleanTroops)) {
        const available = stock[key] ?? 0
        if (available < qty) {
          await client.query('ROLLBACK')
          return res.status(400).json({
            error: `Unidades insuficientes: ${UNIT_CONFIGS[key]?.name ?? key} (disponível: ${available}, pedido: ${qty})`
          })
        }
        await client.query(
          `UPDATE village_units SET count = count - $1 WHERE village_id = $2 AND unit_key = $3`,
          [qty, village.id, key]
        )
      }

      const { rows: cmdRows } = await client.query(
        `INSERT INTO commands
           (world_id, origin_village_id, target_village_id, type, troops,
            sent_at_ms, arrives_at_ms, returns_at_ms, status)
         VALUES ($1, $2, $3, 'attack', $4, $5, $6, $7, 'traveling')
         RETURNING id`,
        [req.worldId, village.id, target.id, JSON.stringify(cleanTroops), now, arrivesAt, returnsAt]
      )
      commandId = cmdRows[0].id

      await client.query('COMMIT')
      console.log('[attack] commandId inserido:', commandId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const io = req.app.locals.io
    if (io) {
      io.to(`player:${req.user.id}`).emit('command:new', {
        commandId, arrivesAtMs: arrivesAt, returnsAtMs: returnsAt, travelMs,
      })
    }

    res.json({ ok: true, commandId, arrivesAtMs: arrivesAt, returnsAtMs: returnsAt, travelMs })
  } catch (e) {
    console.error('[commands POST /attack]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/commands/spy?worldId=X ─────────────────────────────────────
router.post('/spy', async (req, res) => {
  try {
    const { spyCount, targetX, targetY } = req.body

    const qty = parseInt(spyCount, 10)
    if (!qty || qty < 1)
      return res.status(400).json({ error: 'Quantidade de espiões inválida.' })
    if (targetX == null || targetY == null)
      return res.status(400).json({ error: 'Coordenadas do alvo obrigatórias.' })

    const tx = parseInt(targetX, 10)
    const ty = parseInt(targetY, 10)
    if (isNaN(tx) || isNaN(ty))
      return res.status(400).json({ error: 'Coordenadas inválidas.' })

    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    if (village.x === tx && village.y === ty)
      return res.status(400).json({ error: 'Não é possível espionar a própria aldeia.' })

    const db = await getDb()

    const { rows: targetRows } = await db.query(
      'SELECT * FROM villages WHERE world_id = $1 AND x = $2 AND y = $3',
      [req.worldId, tx, ty]
    )
    const target = targetRows[0]
    if (!target) return res.status(404).json({ error: 'Aldeia alvo não encontrada.' })

    const worldCfg = await getWorldConfig(req.worldId)
    const now      = Date.now()
    const spyTroops = { spy: qty }
    const { travelMs, arrivesAt, returnsAt } = calcCommandTimes(
      village.x, village.y, tx, ty,
      spyTroops, worldCfg.speed, worldCfg.unit_speed, now
    )

    const client = await db.connect()
    let commandId
    try {
      await client.query('BEGIN')

      const { rows: unitRows } = await client.query(
        `SELECT count FROM village_units
         WHERE village_id = $1 AND unit_key = 'spy' FOR UPDATE`,
        [village.id]
      )
      const available = unitRows[0]?.count ?? 0
      if (available < qty) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          error: `Espiões insuficientes (disponível: ${available}, pedido: ${qty})`
        })
      }

      await client.query(
        `UPDATE village_units SET count = count - $1
         WHERE village_id = $2 AND unit_key = 'spy'`,
        [qty, village.id]
      )

      const { rows: cmdRows } = await client.query(
        `INSERT INTO commands
           (world_id, origin_village_id, target_village_id, type, troops,
            sent_at_ms, arrives_at_ms, returns_at_ms, status)
         VALUES ($1, $2, $3, 'spy', $4, $5, $6, $7, 'traveling')
         RETURNING id`,
        [req.worldId, village.id, target.id, JSON.stringify(spyTroops), now, arrivesAt, returnsAt]
      )
      commandId = cmdRows[0].id

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const io = req.app.locals.io
    if (io) {
      io.to(`player:${req.user.id}`).emit('command:new', {
        commandId, arrivesAtMs: arrivesAt, returnsAtMs: returnsAt, travelMs,
      })
    }

    res.json({ ok: true, commandId, arrivesAtMs: arrivesAt, returnsAtMs: returnsAt, travelMs })
  } catch (e) {
    console.error('[commands POST /spy]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/commands/cancel?worldId=X ──────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const { commandId } = req.body
    if (!commandId) return res.status(400).json({ error: 'commandId obrigatório.' })

    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    const db = await getDb()
    const { rows } = await db.query(
      `SELECT * FROM commands WHERE id = $1 AND origin_village_id = $2`,
      [commandId, village.id]
    )
    const cmd = rows[0]
    if (!cmd) return res.status(404).json({ error: 'Comando não encontrado.' })
    if (cmd.status !== 'traveling')
      return res.status(400).json({ error: 'Só é possível cancelar ataques ainda em trânsito.' })

    const now          = Date.now()
    const newReturnsAt = calcCancelReturnTime(
      Number(cmd.sent_at_ms),
      Number(cmd.arrives_at_ms),
      now
    )

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE commands SET status = 'returning', cancelled = true, returns_at_ms = $1 WHERE id = $2`,
        [newReturnsAt, cmd.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const io = req.app.locals.io
    if (io) {
      io.to(`player:${req.user.id}`).emit('command:cancelled', {
        commandId: cmd.id, returnsAtMs: newReturnsAt,
      })
    }

    res.json({ ok: true, returnsAtMs: newReturnsAt })
  } catch (e) {
    console.error('[commands POST /cancel]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
