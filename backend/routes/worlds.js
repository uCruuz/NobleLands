/**
 * routes/worlds.js
 *
 * GET  /api/worlds                  — lista mundos disponíveis
 * GET  /api/worlds/:id              — info de um mundo específico
 * GET  /api/worlds/:id/my-village   — verifica se jogador tem aldeia nesse mundo
 * POST /api/worlds                  — cria mundo
 * POST /api/worlds/:id/join         — jogador entra num mundo e recebe sua aldeia
 */

import { Router } from 'express'
import { createWorld, generateWorld, listWorlds, getWorldConfig } from '../services/worldService.js'
import { createDefaultVillage } from '../db/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDb } from '../db/database.js'

const router = Router()

// ── GET /api/worlds ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const worlds = await listWorlds()
    res.json(worlds)
  } catch (e) {
    console.error('[worlds/list]', e)
    res.status(500).json({ error: 'Erro ao listar mundos.' })
  }
})

// ── GET /api/worlds/:id/my-village ────────────────────────────────────────
// Retorna a aldeia do jogador nesse mundo, ou 404 se não tiver
router.get('/:id/my-village', authMiddleware, async (req, res) => {
  try {
    const worldId = parseInt(req.params.id)
    const userId  = req.user.id
    const db      = await getDb()

    const { rows } = await db.query(
      'SELECT id, name, x, y, points FROM villages WHERE world_id = $1 AND user_id = $2',
      [worldId, userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'Sem aldeia nesse mundo.' })

    res.json(rows[0])
  } catch (e) {
    console.error('[worlds/my-village]', e)
    res.status(500).json({ error: 'Erro ao buscar aldeia.' })
  }
})

// ── GET /api/worlds/:id/seed ──────────────────────────────────────────────
router.get('/:id/seed', async (req, res) => {
  try {
    const db = await getDb()
    const { rows } = await db.query(
      'SELECT seed FROM worlds WHERE id = $1',
      [parseInt(req.params.id)]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Mundo não encontrado.' })
    res.json({ seed: rows[0].seed })
  } catch (e) {
    console.error('[worlds/seed]', e)
    res.status(500).json({ error: 'Erro ao buscar seed.' })
  }
})

// ── GET /api/worlds/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const config = await getWorldConfig(parseInt(req.params.id))
    res.json(config)
  } catch (e) {
    if (e.message.includes('não encontrado'))
      return res.status(404).json({ error: e.message })
    console.error('[worlds/get]', e)
    res.status(500).json({ error: 'Erro ao buscar mundo.' })
  }
})

// ── POST /api/worlds ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, size, centerX, centerY, spawnRing, config } = req.body

    if (!name || name.trim().length < 2)
      return res.status(400).json({ error: 'Nome do mundo deve ter pelo menos 2 caracteres.' })

    // Gera seed aleatório único para este mundo
    const seed = Math.floor(Math.random() * 2_147_483_647) + 1


    const world = await createWorld({ name: name.trim(), size, centerX, centerY, spawnRing, config, seed })

    generateWorld(world.id).catch(err =>
      console.error(`[World] Erro na geração do world ${world.id}:`, err)
    )

    res.status(201).json({
      world,
      message: 'Mundo criado. Geração de aldeias iniciada em background.'
    })
  } catch (e) {
    if (e.code === '23505')
      return res.status(400).json({ error: 'Já existe um mundo com esse nome.' })
    console.error('[worlds/create]', e)
    res.status(500).json({ error: 'Erro ao criar mundo.' })
  }
})

// ── POST /api/worlds/:id/join ─────────────────────────────────────────────
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const worldId = parseInt(req.params.id)
    const userId  = req.user.id
    const db      = await getDb()

    const { rows: worldRows } = await db.query(
      'SELECT id, name, status FROM worlds WHERE id = $1',
      [worldId]
    )
    if (!worldRows[0])
      return res.status(404).json({ error: 'Mundo não encontrado.' })
    if (worldRows[0].status !== 'active')
      return res.status(400).json({ error: 'Este mundo não está ativo.' })

    // Se já tem aldeia, apenas retorna
    const { rows: existing } = await db.query(
      'SELECT id FROM villages WHERE world_id = $1 AND user_id = $2',
      [worldId, userId]
    )
    if (existing.length > 0) {
      return res.json({
        villageId: existing[0].id,
        message: 'Você já está neste mundo.',
        isNew: false
      })
    }

    const villageId = await createDefaultVillage(userId, worldId)

    res.status(201).json({
      villageId,
      message: `Bem-vindo ao ${worldRows[0].name}! Sua aldeia foi criada.`,
      isNew: true
    })
  } catch (e) {
    console.error('[worlds/join]', e)
    res.status(500).json({ error: e.message || 'Erro ao entrar no mundo.' })
  }
})

export default router
