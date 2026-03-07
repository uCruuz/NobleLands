import { getDb } from './database.js'
import { getResourceProduction, getStorageCapacity } from '../../shared/buildings.js'
import { isGrassTile, initNoise } from '../../shared/mapNoise.js'
import { getContinent, getRing } from '../utils/worldUtils.js'

export function getResourceRate(level) {
  return getResourceProduction(level)
}

export async function calcResources(villageId) {
  const db = await getDb()

  const { rows: resRows } = await db.query(
    'SELECT * FROM village_resources WHERE village_id = $1',
    [villageId]
  )
  const res = resRows[0]
  if (!res) return null

  const { rows: storRows } = await db.query(
    "SELECT level FROM village_buildings WHERE village_id = $1 AND building_key = 'storage'",
    [villageId]
  )
  const stor = storRows[0]

  const cap   = getStorageCapacity(stor?.level ?? 1)
  const now   = Math.floor(Date.now() / 1000)
  const delta = now - res.last_updated

  return {
    wood:         Math.min(cap, res.wood  + res.wood_rate  * (delta / 3600)),
    stone:        Math.min(cap, res.stone + res.stone_rate * (delta / 3600)),
    iron:         Math.min(cap, res.iron  + res.iron_rate  * (delta / 3600)),
    wood_rate:    res.wood_rate,
    stone_rate:   res.stone_rate,
    iron_rate:    res.iron_rate,
    capacity:     cap,
    last_updated: res.last_updated
  }
}

export async function flushResources(villageId) {
  const db      = await getDb()
  const current = await calcResources(villageId)
  if (!current) return null

  await db.query(
    `UPDATE village_resources
     SET wood = $1, stone = $2, iron = $3, last_updated = $4
     WHERE village_id = $5`,
    [current.wood, current.stone, current.iron, Math.floor(Date.now() / 1000), villageId]
  )
  return current
}

export async function getBuildingsMap(villageId) {
  const db = await getDb()
  const { rows } = await db.query(
    'SELECT building_key, level FROM village_buildings WHERE village_id = $1',
    [villageId]
  )
  const map = {}
  for (const row of rows) map[row.building_key] = row.level
  return map
}

/**
 * Encontra coordenadas livres nas bordas da área ocupada atual,
 * expandindo em espiral a partir do spawn_ring.
 * Só aceita tiles que sejam grama (nem floresta nem água).
 */
async function findFreeCoords(db, wid, cx, cy, startRing, size) {
  const maxR = Math.floor(size / 2)

  for (let r = startRing; r <= maxR; r++) {
    const candidates = []
    for (let dx = -r; dx <= r; dx++) {
      candidates.push({ x: cx + dx, y: cy - r })
      candidates.push({ x: cx + dx, y: cy + r })
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      candidates.push({ x: cx - r, y: cy + dy })
      candidates.push({ x: cx + r, y: cy + dy })
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    // Filtra por limites do mundo E por tile de grama
    const valid = candidates.filter(
      c => c.x >= 0 && c.y >= 0 && c.x < size && c.y < size && isGrassTile(c.x, c.y)
    )

    if (valid.length === 0) continue

    const placeholders = valid.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
    const params       = valid.flatMap(c => [c.x, c.y])

    const { rows: occupied } = await db.query(`
      SELECT x, y FROM villages
      WHERE world_id = $${params.length + 1}
        AND (x, y) IN (${placeholders})
    `, [...params, wid])

    const occupiedSet = new Set(occupied.map(r => `${r.x},${r.y}`))
    const free        = valid.filter(c => !occupiedSet.has(`${c.x},${c.y}`))

    if (free.length > 0) {
      return free[Math.floor(Math.random() * free.length)]
    }
  }

  return null
}

/**
 * Gera aldeias bárbaras ao redor das coordenadas do jogador.
 * Só coloca bárbaras em tiles de grama.
 */
async function spawnNearbyBarbarians(db, wid, px, py, cx, cy, size) {
  const count      = 3 + Math.floor(Math.random() * 3)
  const candidates = []

  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      if (dx === 0 && dy === 0) continue
      const x = px + dx
      const y = py + dy
      if (x >= 0 && y >= 0 && x < size && y < size && isGrassTile(x, y)) {
        candidates.push({ x, y })
      }
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  let spawned = 0
  for (const c of candidates) {
    if (spawned >= count) break
    const continent = getContinent(c.x, c.y)
    const ring      = getRing(c.x, c.y, cx, cy)

    try {
      await db.query(`
        INSERT INTO villages (world_id, user_id, name, x, y, continent, ring, points)
        VALUES ($1, NULL, 'Aldeia Bárbara', $2, $3, $4, $5, 26)
        ON CONFLICT (world_id, x, y) DO NOTHING
      `, [wid, c.x, c.y, continent, ring])
      spawned++
    } catch {
      // ignora conflito
    }
  }

  console.log(`[Spawn] ${spawned} aldeias bárbaras criadas ao redor de (${px},${py})`)
}

export async function createDefaultVillage(userId, worldId) {
  const db = await getDb()

  let wid = worldId
  if (!wid) {
    const { rows } = await db.query(
      "SELECT id FROM worlds WHERE status = 'active' ORDER BY id ASC LIMIT 1"
    )
    if (!rows[0]) throw new Error('Nenhum mundo ativo. Crie um mundo antes de registrar jogadores.')
    wid = rows[0].id
  }

  const { rows: worldRows } = await db.query(
    'SELECT center_x, center_y, spawn_ring, size, seed FROM worlds WHERE id = $1',
    [wid]
  )
  const { center_x: cx, center_y: cy, spawn_ring: spawnRing, size, seed } = worldRows[0]

  // Sincroniza o noise com a seed do mundo — garante mesmo terrain que o frontend
  initNoise(seed)

  const coords = await findFreeCoords(db, wid, cx, cy, spawnRing, size)
  if (!coords) throw new Error('Não foi possível encontrar coordenadas livres no mundo.')

  const { x, y }  = coords
  const continent = getContinent(x, y)
  const ring      = getRing(x, y, cx, cy)

  const { rows } = await db.query(`
    INSERT INTO villages (world_id, user_id, name, x, y, continent, ring, points)
    VALUES ($1, $2, 'Minha Aldeia', $3, $4, $5, $6, 26)
    RETURNING id
  `, [wid, userId, x, y, continent, ring])

  const vid = rows[0].id

  await db.query(`
    INSERT INTO village_resources (village_id, wood, stone, iron, wood_rate, stone_rate, iron_rate)
    VALUES ($1, 200, 150, 100, $2, $3, $4)
    ON CONFLICT (village_id) DO UPDATE
      SET wood = 200, stone = 150, iron = 100,
          wood_rate  = EXCLUDED.wood_rate,
          stone_rate = EXCLUDED.stone_rate,
          iron_rate  = EXCLUDED.iron_rate,
          last_updated = EXTRACT(EPOCH FROM NOW())::INTEGER
  `, [vid, getResourceRate(1), getResourceRate(1), getResourceRate(1)])

  const buildings = [
    ['main',1],['barracks',1],['stable',1],['garage',1],
    ['snob',1],['smith',1],['place',1],['statue',1],
    ['market',1],['wood',1],['stone',1],['iron',1],
    ['farm',1],['storage',1],['hide',1],['wall',1],
  ]
  for (const [key, level] of buildings) {
    await db.query(`
      INSERT INTO village_buildings (village_id, building_key, level)
      VALUES ($1, $2, $3)
      ON CONFLICT (village_id, building_key) DO UPDATE SET level = EXCLUDED.level
    `, [vid, key, level])
  }

  await spawnNearbyBarbarians(db, wid, x, y, cx, cy, size)

  console.log(`[Spawn] Jogador ${userId} criado em (${x},${y}) ring=${ring} world=${wid}`)
  return vid
}
