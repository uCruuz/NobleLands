/**
 * routes/map.js
 *
 * Montado em /api/map no server.js.
 *
 * GET  /api/map/:worldId               — viewport de aldeias
 * GET  /api/map/:worldId/search?q=nome — busca por jogador
 * POST /api/map/:worldId/attack        — envia ataque/suporte
 */

import { Router } from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const MAX_VIEWPORT = 100  // máximo de tiles por eixo

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
        v.id,
        v.x,
        v.y,
        v.name,
        v.points,
        v.continent,
        v.ring,
        v.user_id     AS player_id,
        u.username    AS player_name
      FROM villages v
      LEFT JOIN users u ON u.id = v.user_id
      WHERE v.world_id = $1
        AND v.x BETWEEN $2 AND $3
        AND v.y BETWEEN $4 AND $5
      ORDER BY v.x, v.y
    `, [worldId, x1, x2, y1, y2])

    res.json({
      viewport: { x1, y1, x2, y2 },
      count: rows.length,
      villages: rows
    })
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
      SELECT
        v.id, v.x, v.y, v.name, v.points,
        u.username AS player_name
      FROM villages v
      JOIN users u ON u.id = v.user_id
      WHERE v.world_id = $1
        AND u.username ILIKE $2
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

    const { rows: originRows } = await db.query(
      'SELECT * FROM villages WHERE user_id = $1 AND world_id = $2',
      [req.user.id, worldId]
    )
    if (!originRows.length) return res.status(404).json({ error: 'Aldeia de origem não encontrada.' })
    const origin = originRows[0]

    const { rows: targetRows } = await db.query(
      'SELECT * FROM villages WHERE id = $1 AND world_id = $2',
      [targetVillageId, worldId]
    )
    if (!targetRows.length) return res.status(404).json({ error: 'Aldeia alvo não encontrada.' })

    for (const [unitKey, qty] of Object.entries(units)) {
      if (!qty || qty <= 0) continue
      const { rows: unitRows } = await db.query(
        'SELECT count FROM village_units WHERE village_id = $1 AND unit_key = $2',
        [origin.id, unitKey]
      )
      const available = unitRows[0]?.count ?? 0
      if (available < qty) {
        return res.status(400).json({ error: `Unidades insuficientes: ${unitKey} (tem ${available}, tentou enviar ${qty}).` })
      }
    }

    // Fase IV: aqui será inserido o movimento na tabela attacks
    res.json({ ok: true })

  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
