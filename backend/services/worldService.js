/**
 * worldService.js — lógica de criação e geração de mundos
 */

import { getDb } from '../db/database.js'
import { get as getCached, invalidate } from './worldConfigCache.js'
import { spiralCoords, getContinent, getRing, getDensity, isInBounds } from '../utils/worldUtils.js'

const BATCH_SIZE = 500

/**
 * Cria um mundo e sua config no banco. Não gera aldeias ainda.
 *
 * @param {object} opts
 * @param {string} opts.name
 * @param {number} [opts.size=1000]
 * @param {number} [opts.centerX=500]
 * @param {number} [opts.centerY=500]
 * @param {number} [opts.spawnRing=3]
 * @param {object} [opts.config]  overrides de world_configs
 * @returns {Promise<object>} linha da tabela worlds
 */
export async function createWorld(opts = {}) {
  const {
    name,
    size      = 1000,
    centerX   = 500,
    centerY   = 500,
    spawnRing = 3,
    config    = {},
    seed      = Math.floor(Math.random() * 2_147_483_647) + 1
  } = opts

  if (!name) throw new Error('name é obrigatório')

  const db = await getDb()

  const { rows: worldRows } = await db.query(`
    INSERT INTO worlds (name, size, center_x, center_y, spawn_ring, seed)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [name, size, centerX, centerY, spawnRing, seed])

  const world = worldRows[0]

  await db.query(`
    INSERT INTO world_configs
      (world_id, speed, unit_speed, production_rate, morale, barbarian_growth, night_bonus)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    world.id,
    config.speed            ?? 1.0,
    config.unit_speed       ?? 1.0,
    config.production_rate  ?? 1.0,
    config.morale           ?? true,
    config.barbarian_growth ?? true,
    config.night_bonus      ?? false
  ])

  console.log(`[World] Criado: "${name}" (id=${world.id}, size=${size})`)
  return world
}

/**
 * Gera as aldeias bárbaras de um mundo via spiralCoords + densidade.
 * Usa batch inserts de BATCH_SIZE para performance.
 *
 * @param {number} worldId
 * @param {Function} [onProgress]  callback(percent 0-100) chamado a cada batch
 * @returns {Promise<number>} total de aldeias inseridas
 */
export async function generateWorld(worldId, onProgress) {
  const db     = await getDb()
  const config = await getCached(worldId)

  const { size, center_x: cx, center_y: cy } = config
  const maxR       = Math.floor(size / 2)
  const totalTiles = Math.pow(2 * maxR + 1, 2)

  let batch        = []
  let inserted     = 0
  let tilesVisited = 0

  for (const [x, y] of spiralCoords(cx, cy, maxR)) {
    if (!isInBounds(x, y, size)) {
      tilesVisited++
      continue
    }

    const ring    = getRing(x, y, cx, cy)
    const density = getDensity(ring, config)

    if (Math.random() < density) {
      batch.push({ x, y, continent: getContinent(x, y), ring, worldId })
    }

    tilesVisited++

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(db, batch)
      inserted += batch.length
      batch     = []

      if (onProgress) {
        onProgress(Math.min(99, Math.round((tilesVisited / totalTiles) * 100)))
      }
    }
  }

  if (batch.length > 0) {
    await insertBatch(db, batch)
    inserted += batch.length
  }

  if (onProgress) onProgress(100)

  invalidate(worldId)
  console.log(`[World] Geração concluída: world=${worldId}, aldeias=${inserted}`)
  return inserted
}

async function insertBatch(db, batch) {
  const values = []
  const params = []
  let   idx    = 1

  for (const v of batch) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
    params.push(v.worldId, v.x, v.y, v.continent, v.ring)
  }

  await db.query(`
    INSERT INTO villages (world_id, x, y, continent, ring)
    VALUES ${values.join(', ')}
    ON CONFLICT (world_id, x, y) DO NOTHING
  `, params)
}

/**
 * Retorna a config de um mundo (com cache).
 * @param {number} worldId
 */
export async function getWorldConfig(worldId) {
  return getCached(worldId)
}

/**
 * Lista todos os mundos com contagem de aldeias.
 */
export async function listWorlds() {
  const db = await getDb()
  const { rows } = await db.query(`
    SELECT w.*, wc.speed, wc.unit_speed, wc.production_rate,
           wc.morale, wc.barbarian_growth, wc.night_bonus,
           COUNT(v.id)::INTEGER AS village_count
    FROM worlds w
    LEFT JOIN world_configs wc ON wc.world_id = w.id
    LEFT JOIN villages v       ON v.world_id  = w.id
    GROUP BY w.id, wc.world_id
    ORDER BY w.created_at DESC
  `)
  return rows
}
