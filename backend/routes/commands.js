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
import {
  calcCommandTimes,
  calcCancelReturnTime,
  slowestSpeed,
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

async function processCommands(villageId, worldId) {
  const db  = await getDb()
  const now = Date.now()

  const { rows: arriving } = await db.query(
    `SELECT * FROM commands
     WHERE origin_village_id = $1
       AND status = 'traveling'
       AND arrives_at_ms::bigint <= $2`,
    [villageId, now]
  )

  for (const cmd of arriving) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const { rows: originRows } = await client.query(
        `SELECT v.name, v.x, v.y, v.user_id, u.username AS player_name
         FROM villages v LEFT JOIN users u ON u.id = v.user_id
         WHERE v.id = $1`, [cmd.origin_village_id]
      )
      const { rows: targetRows } = await client.query(
        `SELECT v.name, v.x, v.y, u.username AS player_name
         FROM villages v LEFT JOIN users u ON u.id = v.user_id
         WHERE v.id = $1`, [cmd.target_village_id]
      )

      const origin = originRows[0]
      const target = targetRows[0]

      if (!origin) { await client.query('ROLLBACK'); continue }

      const reportData = {
        attacker: {
          villageName: origin.name,
          playerName:  origin.player_name ?? 'Bárbaro',
          coords:      { x: origin.x, y: origin.y },
        },
        defender: {
          villageName: target?.name ?? '?',
          playerName:  target?.player_name ?? 'Bárbaro',
          coords:      { x: target?.x, y: target?.y },
        },
        troopsSent: cmd.troops,
        troopsLost: {},
        loot:       { wood: 0, stone: 0, iron: 0 },
        travelMs:   cmd.arrives_at_ms - cmd.sent_at_ms,
      }

      const subject = `Visita em ${target?.name ?? '?'} (${target?.x ?? '?'}|${target?.y ?? '?'})`

      const { rows: repRows } = await client.query(
        `INSERT INTO reports
           (world_id, owner_id, attacker_village_id, defender_village_id,
            type, result, subject, read, data_json, created_at)
         VALUES ($1, $2, $3, $4, 'attack', 'neutral', $5, false, $6, $7)
         RETURNING id`,
        [
          worldId, origin.user_id,
          cmd.origin_village_id, cmd.target_village_id,
          subject, JSON.stringify(reportData),
          Math.floor(now / 1000),
        ]
      )

      await client.query(
        `UPDATE commands SET status = 'returning', report_id = $1 WHERE id = $2`,
        [repRows[0]?.id ?? null, cmd.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      console.error('[processCommands] Erro chegada cmd:', cmd.id, e)
    } finally {
      client.release()
    }
  }

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
      for (const [unitKey, qty] of Object.entries(cmd.troops)) {
        if (!qty || qty <= 0) continue
        await client.query(
          `INSERT INTO village_units (village_id, unit_key, count) VALUES ($1, $2, $3)
           ON CONFLICT (village_id, unit_key)
           DO UPDATE SET count = village_units.count + EXCLUDED.count`,
          [cmd.origin_village_id, unitKey, qty]
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
    perspective, // 'own' | 'incoming_attack'
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
         AND c.type = 'attack'
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
