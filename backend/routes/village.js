import { Router } from 'express'
import { getDb } from '../db/database.js'
import { calcResources, getBuildingsMap, getResourceRate } from '../db/helpers.js'
import { authMiddleware, worldMiddleware } from '../middleware/auth.js'
import { BUILDING_CONFIGS, getBuildingCost, getBuildingTime, getStorageCapacity } from '../../shared/buildings.js'

const router = Router()
router.use(authMiddleware)
router.use(worldMiddleware)

const CONFIGS = BUILDING_CONFIGS

// Whitelist de colunas de recursos — previne SQL Injection em processQueue
const RESOURCE_RATE_COLUMNS = {
  wood:  'wood_rate',
  stone: 'stone_rate',
  iron:  'iron_rate'
}

async function getUserVillage(userId, worldId) {
  const db = await getDb()
  const { rows } = await db.query(
    'SELECT * FROM villages WHERE user_id = $1 AND world_id = $2',
    [userId, worldId]
  )
  return rows[0]
}

async function processQueue(villageId) {
  const db  = await getDb()
  const now = Math.floor(Date.now() / 1000)
  const { rows: done } = await db.query(
    'SELECT * FROM build_queue WHERE village_id = $1 AND ends_at <= $2 ORDER BY ends_at ASC',
    [villageId, now]
  )

  for (const job of done) {
    // ── Transação: aplica cada item da fila atomicamente ────────────────
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO village_buildings (village_id, building_key, level) VALUES ($1, $2, $3)
         ON CONFLICT (village_id, building_key) DO UPDATE SET level = EXCLUDED.level`,
        [villageId, job.building_key, job.target_level]
      )

      // Usa whitelist para evitar SQL Injection na coluna de rate
      const rateCol = RESOURCE_RATE_COLUMNS[job.building_key]
      if (rateCol) {
        await client.query(
          `UPDATE village_resources SET ${rateCol} = $1 WHERE village_id = $2`,
          [getResourceRate(job.target_level), villageId]
        )
      }

      await client.query('DELETE FROM build_queue WHERE id = $1', [job.id])

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      console.error('[processQueue] Erro ao aplicar job, rollback executado:', e)
    } finally {
      client.release()
    }
  }
}

// ── GET /api/village?worldId=1 ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processQueue(village.id)

    const resources = await calcResources(village.id)
    const buildings = await getBuildingsMap(village.id)
    const db        = await getDb()
    const { rows: queue } = await db.query(
      'SELECT * FROM build_queue WHERE village_id = $1 ORDER BY ends_at ASC',
      [village.id]
    )

    const nowSec = Math.floor(Date.now() / 1000)

    res.json({
      id: village.id,
      name: village.name,
      points: village.points,
      coords: { x: village.x, y: village.y },
      resources,
      buildings,
      buildQueue: queue.map((q, i) => ({
        buildingKey: q.building_key,
        targetLevel: q.target_level,
        startedAt:   (i === 0 ? nowSec : queue[i - 1].ends_at) * 1000,
        endsAt:      q.ends_at * 1000
      }))
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/village/cancel?worldId=1 ───────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const { buildingKey } = req.body
    if (!buildingKey || typeof buildingKey !== 'string')
      return res.status(400).json({ error: 'buildingKey é obrigatório.' })

    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    const db = await getDb()
    const { rows } = await db.query(
      'SELECT * FROM build_queue WHERE village_id = $1 AND building_key = $2',
      [village.id, buildingKey]
    )
    const job = rows[0]
    if (!job) return res.status(404).json({ error: 'Construção não encontrada na fila.' })

    // ── Transação: devolve recursos e remove da fila atomicamente ────────
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const config = CONFIGS[buildingKey]
      if (config) {
        const cost = getBuildingCost(config, job.target_level)
        await client.query(
          `UPDATE village_resources
           SET wood = wood + $1, stone = stone + $2, iron = iron + $3
           WHERE village_id = $4`,
          [cost.wood, cost.stone, cost.iron, village.id]
        )
      }

      await client.query('DELETE FROM build_queue WHERE id = $1', [job.id])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ── POST /api/village/build?worldId=1 ────────────────────────────────────
router.post('/build', async (req, res) => {
  try {
    const { buildingKey } = req.body
    if (!buildingKey || typeof buildingKey !== 'string')
      return res.status(400).json({ error: 'buildingKey é obrigatório.' })

    const config = CONFIGS[buildingKey]
    if (!config) return res.status(400).json({ error: 'Edifício inválido.' })

    const village = await getUserVillage(req.user.id, req.worldId)
    if (!village) return res.status(404).json({ error: 'Aldeia não encontrada.' })

    await processQueue(village.id)

    const db           = await getDb()
    const buildings    = await getBuildingsMap(village.id)
    const currentLevel = buildings[buildingKey] ?? 0
    const nextLevel    = currentLevel + 1

    if (nextLevel > config.maxLevel)
      return res.status(400).json({ error: 'Nível máximo atingido.' })

    const { rows: queueRows } = await db.query(
      'SELECT COUNT(*) AS c FROM build_queue WHERE village_id = $1',
      [village.id]
    )
    if (parseInt(queueRows[0].c) >= 2)
      return res.status(400).json({ error: 'Fila de construção cheia.' })

    for (const [req2, reqLevel] of Object.entries(config.requires || {})) {
      if ((buildings[req2] ?? 0) < reqLevel) {
        const reqName = CONFIGS[req2]?.name || req2
        return res.status(400).json({ error: `Requer ${reqName} nível ${reqLevel}.` })
      }
    }

    const cost = getBuildingCost(config, nextLevel)

    // ── Transação: debita recursos e insere na fila atomicamente ─────────
    const client = await db.connect()
    let endsAt
    try {
      await client.query('BEGIN')

      const { rows: resRows } = await client.query(
        'SELECT wood, stone, iron FROM village_resources WHERE village_id = $1 FOR UPDATE',
        [village.id]
      )
      const resources = resRows[0]

      const { rows: rateRows } = await client.query(
        'SELECT wood_rate, stone_rate, iron_rate, last_updated FROM village_resources WHERE village_id = $1',
        [village.id]
      )
      const r     = rateRows[0]
      const now   = Math.floor(Date.now() / 1000)
      const delta = now - r.last_updated
      const { rows: storRows } = await client.query(
        "SELECT level FROM village_buildings WHERE village_id = $1 AND building_key = 'storage'",
        [village.id]
      )
      const cap   = getStorageCapacity(storRows[0]?.level ?? 1)
      const wood  = Math.floor(Math.min(cap, Number(resources.wood)  + Number(r.wood_rate)  * (delta / 3600)))
      const stone = Math.floor(Math.min(cap, Number(resources.stone) + Number(r.stone_rate) * (delta / 3600)))
      const iron  = Math.floor(Math.min(cap, Number(resources.iron)  + Number(r.iron_rate)  * (delta / 3600)))

      if (wood  < cost.wood)  { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Madeira insuficiente.' }) }
      if (stone < cost.stone) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Argila insuficiente.' }) }
      if (iron  < cost.iron)  { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ferro insuficiente.' }) }

      await client.query(
        `UPDATE village_resources
         SET wood = $1::integer - $4::integer, stone = $2::integer - $5::integer, iron = $3::integer - $6::integer, last_updated = $7
         WHERE village_id = $8`,
        [wood, stone, iron, cost.wood, cost.stone, cost.iron, now, village.id]
      )

      const buildTime = getBuildingTime(config, nextLevel, buildings.main ?? 1)
      const { rows: lastRows } = await client.query(
        'SELECT MAX(ends_at) AS last FROM build_queue WHERE village_id = $1',
        [village.id]
      )
      const startsAt = lastRows[0]?.last ?? now
      endsAt = startsAt + buildTime

      await client.query(
        'INSERT INTO build_queue (village_id, building_key, target_level, ends_at) VALUES ($1, $2, $3, $4)',
        [village.id, buildingKey, nextLevel, endsAt]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    res.json({ ok: true, endsAt: endsAt * 1000 })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
