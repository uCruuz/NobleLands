/**
 * worldConfigCache.js — cache em memória para configurações de mundo
 *
 * Evita query ao banco a cada request. TTL de 5 minutos.
 * Invalidado quando o painel admin salva uma nova config.
 */

import { getDb } from '../db/database.js'

const TTL   = 5 * 60 * 1000  // 5 minutos em ms
const cache = new Map()       // worldId → { config, expiresAt }

/**
 * Retorna a config do mundo — do cache se válido, do banco caso contrário.
 * @param {number} worldId
 * @returns {Promise<object>} linha de worlds JOIN world_configs
 */
export async function get(worldId) {
  const hit = cache.get(worldId)
  if (hit && Date.now() < hit.expiresAt) return hit.config

  const db = await getDb()
  const { rows } = await db.query(`
    SELECT w.*, wc.speed, wc.unit_speed, wc.production_rate,
           wc.morale, wc.barbarian_growth, wc.night_bonus, wc.updated_at
    FROM worlds w
    JOIN world_configs wc ON wc.world_id = w.id
    WHERE w.id = $1
  `, [worldId])

  if (!rows[0]) throw new Error(`World ${worldId} não encontrado`)

  cache.set(worldId, { config: rows[0], expiresAt: Date.now() + TTL })
  return rows[0]
}

/**
 * Remove o mundo do cache — chamar sempre após UPDATE em world_configs.
 * @param {number} worldId
 */
export function invalidate(worldId) {
  cache.delete(worldId)
  console.log(`[Cache] world:${worldId} invalidado`)
}

/**
 * Limpa todo o cache — útil em testes ou reinicialização.
 */
export function clear() {
  cache.clear()
}
