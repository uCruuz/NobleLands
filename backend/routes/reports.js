/**
 * backend/routes/reports.js
 *
 * Endpoints:
 *   GET    /api/reports?worldId=X          → lista relatórios do jogador
 *   POST   /api/reports/:id/read?worldId=X → marca como lido
 *   DELETE /api/reports?worldId=X          → apaga relatórios por ids (body: { ids: [] })
 */

import { Router } from 'express'
import { getDb }  from '../db/database.js'
import { authMiddleware, worldMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)
router.use(worldMiddleware)

// ── GET /api/reports?worldId=X ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = await getDb()

    const { rows } = await db.query(
      `SELECT
         id,
         type,
         result,
         subject,
         read,
         data_json  AS data,
         created_at AS "createdAt"
       FROM reports
       WHERE world_id = $1
         AND owner_id  = $2
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.worldId, req.user.id]
    )

    const reports = rows.map(r => ({
      ...r,
      // created_at está em segundos no banco — converte para ms para o front
      createdAt: Number(r.createdAt) * 1000,
      data:      typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    }))

    res.json({ reports })
  } catch (e) {
    console.error('[reports GET]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/reports/:id/read?worldId=X ─────────────────────────────────
router.post('/:id/read', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10)
    if (!reportId) return res.status(400).json({ error: 'ID inválido.' })

    const db = await getDb()
    const { rowCount } = await db.query(
      `UPDATE reports SET read = true
       WHERE id = $1 AND owner_id = $2 AND world_id = $3`,
      [reportId, req.user.id, req.worldId]
    )

    if (!rowCount) return res.status(404).json({ error: 'Relatório não encontrado.' })
    res.json({ ok: true })
  } catch (e) {
    console.error('[reports POST /:id/read]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── DELETE /api/reports?worldId=X  body: { ids: [1, 2, 3] } ──────────────
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids obrigatório.' })
    }

    const db = await getDb()
    await db.query(
      `DELETE FROM reports
       WHERE id = ANY($1::int[])
         AND owner_id = $2
         AND world_id = $3`,
      [ids, req.user.id, req.worldId]
    )

    res.json({ ok: true })
  } catch (e) {
    console.error('[reports DELETE]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
