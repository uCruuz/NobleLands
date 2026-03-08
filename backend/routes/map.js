/**
 * routes/map.js
 *
 * Montado em /api/map no server.js.
 *
 * GET  /api/map/:worldId               — viewport de aldeias
 * GET  /api/map/:worldId/search?q=nome — busca por jogador
 * POST /api/map/:worldId/attack        — envia ataque/suporte (delega para lógica de commands)
 */

import { Router } from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { UNIT_CONFIGS } from '../../shared/units.js'
import { calcCommandTimes, slowestSpeed } from '../../shared/combat.js'

const router = Router()

const MAX_VIEWPORT = 100

// ── GET /api/map/:worldId ─────────────────────────────────────────────────
router.get('/:worldId', async (req, res) => {
  try {
    const worldId = parseInt(req.params.worldId)
    if (isNaN(worldId)) return res.status(400).json({ error: 'worldId inválido.' })

    let { x1, y1, x2, y2 } = req.query

    x1 = parseInt(x1)
    y1 = parseInt(y1)
    x2 = parseInt(x2)
    y2 = parseInt(y2)

    if ([x1, y1, x2, y2].some(isNaN)) {
      return res.status(400).json({ error: 'Parâmetros x1, y1, x2, y2 são obrigatórios e devem ser números.' })
    }

    if (x1 > x2) [x1, x2] = [x2, x1]
    if (y1 > y2) [y1, y2] = [y2, y1]

    if (x2 - x1 > MAX_VIEWPORT) x2 = x1 + MAX_VIEWPORT
    if (y2 - y1 > MAX_VIEWPORT) y2 = y1 + MAX_VIEWPORT

    const db = await getDb()

    const { rows } = await db.query(`
      SELECT
        v.id, v.x, v.y, v.name, v.points, v.continent, v.ring,
        v.user_id AS player_id,
        u.username AS player_name
      FROM villages v
      LEFT JOIN users u ON u.id = v.user_id
      WHERE v.world_id = $1
        AND v.x BETWEEN $2 AND $3
        AND v.y BETWEEN $4 AND $5
      ORDER BY v.x, v.y
    `, [worldId, x1, x2, y1, y2])

    res.json({ viewport: { x1, y1, x2, y2 }, count: rows.length, villages: rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro ao buscar mapa.' })
  }
})

// ── GET /api/map/:worldId/search?q=nome ──────────────────────────────────
router.get('/:worldId/search', async (req, res) => {
  try {
    const worldId = parseInt(req.params.worldId)
    if (isNaN(worldId)) return res.status(400).json({ error: 'worldId inválido.' })

    const q = (req.query.q ?? '').trim()
    if (q.length < 2) return res.json({ villages: [] })

    const db = await getDb()

    const { rows } = await db.query(`
      SELECT v.id, v.x, v.y, v.name, v.points, u.username AS player_name
      FROM villages v
      JOIN users u ON u.id = v.user_id
      WHERE v.world_id = $1 AND u.username ILIKE $2
      ORDER BY v.points DESC
      LIMIT 20
    `, [worldId, `%${q}%`])

    res.json({ villages: rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro na busca.' })
  }
})

// ── POST /api/map/:worldId/attack ─────────────────────────────────────────
// Recebe { targetVillageId, units, type } do MapView.
// Resolve coordenadas e delega a mesma lógica de commands.js.
router.post('/:worldId/attack', authMiddleware, async (req, res) => {
  try {
    const worldId = parseInt(req.params.worldId)
    if (isNaN(worldId)) return res.status(400).json({ error: 'worldId inválido.' })

    const { targetVillageId, units, type } = req.body

    if (!targetVillageId || !units || !type) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' })
    }
    if (!['attack', 'support'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido.' })
    }

    const db = await getDb()

    // ── Aldeia de origem ─────────────────────────────────────────────────
    const { rows: originRows } = await db.query(
      'SELECT * FROM villages WHERE user_id = $1 AND world_id = $2',
      [req.user.id, worldId]
    )
    if (!originRows.length) return res.status(404).json({ error: 'Aldeia de origem não encontrada.' })
    const origin = originRows[0]

    // ── Aldeia alvo ──────────────────────────────────────────────────────
    const { rows: targetRows } = await db.query(
      'SELECT * FROM villages WHERE id = $1 AND world_id = $2',
      [targetVillageId, worldId]
    )
    if (!targetRows.length) return res.status(404).json({ error: 'Aldeia alvo não encontrada.' })
    const target = targetRows[0]

    if (origin.x === target.x && origin.y === target.y) {
      return res.status(400).json({ error: 'Você não pode atacar sua própria aldeia.' })
    }

    // ── Valida e limpa tropas ────────────────────────────────────────────
    const cleanTroops = {}
    for (const [key, qty] of Object.entries(units)) {
      const q = parseInt(qty, 10)
      if (!q || q <= 0) continue
      if (!UNIT_CONFIGS[key]) return res.status(400).json({ error: `Unidade desconhecida: ${key}` })
      cleanTroops[key] = q
    }
    if (!Object.keys(cleanTroops).length) {
      return res.status(400).json({ error: 'Nenhuma unidade válida selecionada.' })
    }

    const speed = slowestSpeed(cleanTroops)
    if (speed === 0) {
      return res.status(400).json({ error: 'Nenhuma das unidades enviadas possui velocidade.' })
    }

    // ── Config do mundo ──────────────────────────────────────────────────
    const { rows: cfgRows } = await db.query(
      'SELECT speed, unit_speed FROM world_configs WHERE world_id = $1',
      [worldId]
    )
    const worldCfg = cfgRows[0] ?? { speed: 1, unit_speed: 1 }

    const now = Date.now()
    const { travelMs, arrivesAt, returnsAt } = calcCommandTimes(
      origin.x, origin.y,
      target.x, target.y,
      cleanTroops,
      worldCfg.speed,
      worldCfg.unit_speed,
      now
    )

    console.log('[map/attack] travelMs:', travelMs, 'arrivesAt:', new Date(arrivesAt).toISOString())

    // ── Transação: desconta tropas e insere comando ──────────────────────
    const client = await db.connect()
    let commandId
    try {
      await client.query('BEGIN')

      // Lê estoque com lock
      const { rows: unitRows } = await client.query(
        'SELECT unit_key, count FROM village_units WHERE village_id = $1 FOR UPDATE',
        [origin.id]
      )
      const stock = {}
      for (const r of unitRows) stock[r.unit_key] = r.count

      // Verifica e desconta
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
          [qty, origin.id, key]
        )
      }

      // Insere comando
      const { rows: cmdRows } = await client.query(
        `INSERT INTO commands
           (world_id, origin_village_id, target_village_id, type, troops,
            sent_at_ms, arrives_at_ms, returns_at_ms, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'traveling')
         RETURNING id`,
        [
          worldId,
          origin.id,
          target.id,
          type,
          JSON.stringify(cleanTroops),
          now,
          arrivesAt,
          returnsAt,
        ]
      )
      commandId = cmdRows[0].id

      await client.query('COMMIT')
      console.log('[map/attack] commandId inserido:', commandId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // ── Emite socket ─────────────────────────────────────────────────────
    const io = req.app.locals.io
    if (io) {
      io.to(`player:${req.user.id}`).emit('command:new', {
        commandId,
        arrivesAtMs: arrivesAt,
        returnsAtMs: returnsAt,
        travelMs,
      })
    }

    res.json({ ok: true, commandId, arrivesAtMs: arrivesAt, returnsAtMs: returnsAt, travelMs })
  } catch (e) {
    console.error('[map/attack]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
