import { Router } from 'express'
import { getDb } from '../db/database.js'
import { flushResources, getBuildingsMap } from '../db/helpers.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const RESEARCH_CONFIGS = {
  axe:      { researchCost: { wood: 200,  stone: 0,   iron: 100  }, researchTime: 1800,  requires: { smith: 2 } },
  archer:   { researchCost: { wood: 400,  stone: 200, iron: 100  }, researchTime: 3600,  requires: { barracks: 5, smith: 5 } },
  spy:      { researchCost: { wood: 0,    stone: 0,   iron: 400  }, researchTime: 2700,  requires: { stable: 1 } },
  light:    { researchCost: { wood: 0,    stone: 0,   iron: 2000 }, researchTime: 7200,  requires: { stable: 3 } },
  marcher:  { researchCost: { wood: 1200, stone: 0,   iron: 1200 }, researchTime: 7200,  requires: { stable: 5 } },
  heavy:    { researchCost: { wood: 0,    stone: 0,   iron: 4000 }, researchTime: 18000, requires: { stable: 10, smith: 15 } },
  ram:      { researchCost: { wood: 800,  stone: 300, iron: 0    }, researchTime: 7200,  requires: { garage: 1 } },
  catapult: { researchCost: { wood: 1400, stone: 800, iron: 400  }, researchTime: 18000, requires: { garage: 2, smith: 12 } },
}

async function getUserVillage(userId) {
  const db = await getDb()
  const { rows } = await db.query('SELECT * FROM villages WHERE user_id = $1', [userId])
  return rows[0]
}

async function processResearchQueue(villageId) {
  const db  = await getDb()
  const now = Math.floor(Date.now() / 1000)
  const { rows: done } = await db.query(
    'SELECT * FROM research_queue WHERE village_id = $1 AND ends_at <= $2',
    [villageId, now]
  )
  for (const job of done) {
    await db.query(
      `INSERT INTO village_research (village_id, unit_key) VALUES ($1, $2)
       ON CONFLICT (village_id, unit_key) DO NOTHING`,
      [villageId, job.unit_key]
    )
    await db.query('DELETE FROM research_queue WHERE id = $1', [job.id])
  }
}

// ── GET /api/smith ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processResearchQueue(village.id)

    const db        = await getDb()
    const buildings = await getBuildingsMap(village.id)

    const { rows: researchRows } = await db.query(
      'SELECT unit_key FROM village_research WHERE village_id = $1',
      [village.id]
    )
    const { rows: queueRows } = await db.query(
      'SELECT * FROM research_queue WHERE village_id = $1 ORDER BY ends_at ASC',
      [village.id]
    )

    const researched = {}
    for (const r of researchRows) researched[r.unit_key] = true

    res.json({
      researched,
      buildings,
      researchQueue: queueRows.map(q => ({
        unitKey: q.unit_key,
        endsAt:  q.ends_at * 1000,
      }))
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/smith/research ──────────────────────────────────────────────
router.post('/research', async (req, res) => {
  try {
    const { unitKey } = req.body

    const cfg = RESEARCH_CONFIGS[unitKey]
    if (!cfg) return res.status(400).json({ error: 'Pesquisa inválida.' })

    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processResearchQueue(village.id)

    const db        = await getDb()
    const buildings = await getBuildingsMap(village.id)

    const { rows: alreadyRows } = await db.query(
      'SELECT 1 FROM village_research WHERE village_id = $1 AND unit_key = $2',
      [village.id, unitKey]
    )
    if (alreadyRows.length > 0)
      return res.status(400).json({ error: 'Unidade já pesquisada.' })

    const { rows: inQueueRows } = await db.query(
      'SELECT 1 FROM research_queue WHERE village_id = $1',
      [village.id]
    )
    if (inQueueRows.length > 0)
      return res.status(400).json({ error: 'Já existe uma pesquisa em andamento.' })

    for (const [reqKey, reqLevel] of Object.entries(cfg.requires ?? {})) {
      if ((buildings[reqKey] ?? 0) < reqLevel) {
        return res.status(400).json({ error: `Requer ${reqKey} nível ${reqLevel}.` })
      }
    }

    const resources = await flushResources(village.id)
    const { wood, stone, iron } = cfg.researchCost

    if (resources.wood  < wood)  return res.status(400).json({ error: 'Madeira insuficiente.' })
    if (resources.stone < stone) return res.status(400).json({ error: 'Argila insuficiente.' })
    if (resources.iron  < iron)  return res.status(400).json({ error: 'Ferro insuficiente.' })

    await db.query(
      `UPDATE village_resources
       SET wood = wood - $1, stone = stone - $2, iron = iron - $3
       WHERE village_id = $4`,
      [wood, stone, iron, village.id]
    )

    const smithLevel   = buildings.smith ?? 1
    const researchTime = Math.round(cfg.researchTime * Math.pow(1.026, -smithLevel))
    const endsAt       = Math.floor(Date.now() / 1000) + researchTime

    await db.query(
      'INSERT INTO research_queue (village_id, unit_key, ends_at) VALUES ($1, $2, $3)',
      [village.id, unitKey, endsAt]
    )

    res.json({ ok: true, endsAt: endsAt * 1000 })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/smith/cancel ────────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const { unitKey } = req.body
    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    const db = await getDb()
    const { rows } = await db.query(
      'SELECT * FROM research_queue WHERE village_id = $1 AND unit_key = $2',
      [village.id, unitKey]
    )
    const job = rows[0]
    if (!job) return res.status(404).json({ error: 'Pesquisa não encontrada.' })

    const cfg = RESEARCH_CONFIGS[unitKey]
    if (cfg) {
      const { wood, stone, iron } = cfg.researchCost
      await db.query(
        `UPDATE village_resources
         SET wood = wood + $1, stone = stone + $2, iron = iron + $3
         WHERE village_id = $4`,
        [wood, stone, iron, village.id]
      )
    }

    await db.query('DELETE FROM research_queue WHERE id = $1', [job.id])
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
