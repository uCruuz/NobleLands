import { Router } from 'express'
import { getDb } from '../db/database.js'
import { flushResources, getBuildingsMap } from '../db/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import { UNIT_CONFIGS, getTrainTime } from '../../shared/units.js'

const router = Router()
router.use(authMiddleware)

async function getUserVillage(userId) {
  const db = await getDb()
  const { rows } = await db.query('SELECT * FROM villages WHERE user_id = $1', [userId])
  return rows[0]
}

async function processTrainQueue(villageId) {
  const db  = await getDb()
  const now = Math.floor(Date.now() / 1000)
  const { rows: done } = await db.query(
    'SELECT * FROM train_queue WHERE village_id = $1 AND ends_at <= $2 ORDER BY ends_at ASC',
    [villageId, now]
  )
  for (const job of done) {
    await db.query(
      `INSERT INTO village_units (village_id, unit_key, count) VALUES ($1, $2, $3)
       ON CONFLICT (village_id, unit_key) DO UPDATE SET count = village_units.count + EXCLUDED.count`,
      [villageId, job.unit_key, job.count]
    )
    await db.query('DELETE FROM train_queue WHERE id = $1', [job.id])
  }
}

// ── GET /api/barracks ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processTrainQueue(village.id)

    const db        = await getDb()
    const buildings = await getBuildingsMap(village.id)
    const { rows: unitRows } = await db.query(
      'SELECT * FROM village_units WHERE village_id = $1',
      [village.id]
    )
    const { rows: queue } = await db.query(
      'SELECT * FROM train_queue WHERE village_id = $1 ORDER BY ends_at ASC',
      [village.id]
    )

    const units = {}
    for (const row of unitRows) units[row.unit_key] = row.count

    res.json({
      units,
      buildings,
      trainQueue: queue.map(q => ({
        unitKey: q.unit_key,
        count:   q.count,
        endsAt:  q.ends_at * 1000
      }))
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/barracks/train ──────────────────────────────────────────────
router.post('/train', async (req, res) => {
  try {
    const { unitKey, count } = req.body
    const qty = parseInt(count, 10)

    if (!unitKey || !UNIT_CONFIGS[unitKey]) return res.status(400).json({ error: 'Unidade inválida.' })
    if (!qty || qty < 1)                    return res.status(400).json({ error: 'Quantidade inválida.' })

    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processTrainQueue(village.id)

    const db        = await getDb()
    const buildings = await getBuildingsMap(village.id)
    const cfg       = UNIT_CONFIGS[unitKey]

    for (const [reqKey, reqLevel] of Object.entries(cfg.requires ?? {})) {
      if ((buildings[reqKey] ?? 0) < reqLevel) {
        return res.status(400).json({ error: `Requer ${reqKey} nível ${reqLevel}.` })
      }
    }

    const resources  = await flushResources(village.id)
    const totalWood  = cfg.wood  * qty
    const totalStone = cfg.stone * qty
    const totalIron  = cfg.iron  * qty

    if (resources.wood  < totalWood)  return res.status(400).json({ error: 'Madeira insuficiente.' })
    if (resources.stone < totalStone) return res.status(400).json({ error: 'Argila insuficiente.' })
    if (resources.iron  < totalIron)  return res.status(400).json({ error: 'Ferro insuficiente.' })

    await db.query(
      `UPDATE village_resources
       SET wood = wood - $1, stone = stone - $2, iron = iron - $3
       WHERE village_id = $4`,
      [totalWood, totalStone, totalIron, village.id]
    )

    const timePerUnit = getTrainTime(unitKey, buildings.barracks ?? 1)
    const totalTime   = timePerUnit * qty

    const { rows: lastRows } = await db.query(
      'SELECT MAX(ends_at) AS last FROM train_queue WHERE village_id = $1',
      [village.id]
    )
    const startsAt = lastRows[0]?.last ?? Math.floor(Date.now() / 1000)
    const endsAt   = startsAt + totalTime

    await db.query(
      'INSERT INTO train_queue (village_id, unit_key, count, ends_at) VALUES ($1, $2, $3, $4)',
      [village.id, unitKey, qty, endsAt]
    )

    res.json({ ok: true, endsAt: endsAt * 1000 })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/barracks/cancel ─────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const { unitKey, endsAt } = req.body
    const village = await getUserVillage(req.user.id)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    const db = await getDb()
    const { rows } = await db.query(
      'SELECT * FROM train_queue WHERE village_id = $1 AND unit_key = $2 AND ends_at = $3',
      [village.id, unitKey, Math.round(endsAt / 1000)]
    )
    const job = rows[0]
    if (!job) return res.status(404).json({ error: 'Job de treino não encontrado.' })

    const cfg = UNIT_CONFIGS[unitKey]
    if (cfg) {
      const refund = 0.9
      await db.query(
        `UPDATE village_resources
         SET wood = wood + $1, stone = stone + $2, iron = iron + $3
         WHERE village_id = $4`,
        [
          Math.floor(cfg.wood  * job.count * refund),
          Math.floor(cfg.stone * job.count * refund),
          Math.floor(cfg.iron  * job.count * refund),
          village.id
        ]
      )
    }

    await db.query('DELETE FROM train_queue WHERE id = $1', [job.id])
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
