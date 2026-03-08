/**
 * shared/combat.js
 *
 * Lógica de combate e movimentação de tropas do Noble Lands.
 * Importado tanto pelo backend (Node.js) quanto pelo frontend (Vue/Vite).
 *
 * Velocidade no TW: cada unidade tem `speed` em minutos por campo.
 * Quanto MAIOR o speed, mais LENTA a unidade (= mais min/campo).
 * O exército viaja na velocidade da unidade mais lenta.
 *
 * Distância = distância euclidiana entre coords (x1,y1) → (x2,y2).
 * Tempo de viagem (ms) = distância × slowest_speed × 60_000 / (worldSpeed × unitSpeed)
 * Mínimo absoluto: 200ms (regra do TW).
 */

import { UNIT_CONFIGS } from './units.js'

// ── Constantes ─────────────────────────────────────────────────────────────

/** Tempo mínimo de viagem em ms (igual ao Tribal Wars) */
export const MIN_TRAVEL_MS = 200

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Distância euclidiana entre duas coordenadas do mapa.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} distância em campos
 */
export function mapDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

/**
 * Retorna o speed (min/campo) mais lento entre as unidades enviadas.
 * Unidades com qty = 0 são ignoradas.
 * Unidades desconhecidas em UNIT_CONFIGS são ignoradas.
 *
 * @param {Object} troops  { spear: 10, axe: 5, ... }
 * @returns {number} speed mais lento (min/campo), ou 0 se troops vazio
 */
export function slowestSpeed(troops) {
  let max = 0 // maior speed = mais lento
  for (const [key, qty] of Object.entries(troops)) {
    if (!qty || qty <= 0) continue
    const cfg = UNIT_CONFIGS[key]
    if (!cfg || !cfg.speed) continue
    if (cfg.speed > max) max = cfg.speed
  }
  return max
}

/**
 * Calcula o tempo de viagem em milissegundos, respeitando o mínimo de 200ms.
 *
 * @param {number} distance   distância em campos (resultado de mapDistance)
 * @param {number} speed      velocidade em min/campo (resultado de slowestSpeed)
 * @param {number} worldSpeed multiplicador de velocidade do mundo (world_configs.speed)
 * @param {number} unitSpeed  multiplicador de velocidade de unidades (world_configs.unit_speed)
 * @returns {number} tempo de viagem em ms (nunca < MIN_TRAVEL_MS)
 */
export function travelTimeMs(distance, speed, worldSpeed = 1, unitSpeed = 1) {
  if (distance === 0 || speed === 0) return MIN_TRAVEL_MS
  // speed está em min/campo → converter para ms/campo
  const msPerField = speed * 60_000
  const raw = (distance * msPerField) / (worldSpeed * unitSpeed)
  return Math.max(MIN_TRAVEL_MS, Math.round(raw))
}

/**
 * Calcula arrives_at e returns_at de um comando.
 *
 * @param {number} originX
 * @param {number} originY
 * @param {number} targetX
 * @param {number} targetY
 * @param {Object} troops       { spear: 10, ... }
 * @param {number} worldSpeed   world_configs.speed
 * @param {number} unitSpeed    world_configs.unit_speed
 * @param {number} nowMs        Date.now() no momento do disparo
 * @returns {{ travelMs: number, arrivesAt: number, returnsAt: number }}
 */
export function calcCommandTimes(
  originX, originY,
  targetX, targetY,
  troops,
  worldSpeed = 1,
  unitSpeed  = 1,
  nowMs      = Date.now()
) {
  const dist     = mapDistance(originX, originY, targetX, targetY)
  const speed    = slowestSpeed(troops)
  const travelMs = travelTimeMs(dist, speed, worldSpeed, unitSpeed)

  return {
    travelMs,
    arrivesAt: nowMs + travelMs,
    returnsAt: nowMs + travelMs * 2,
  }
}

/**
 * Dado um cancelamento de ataque em andamento,
 * calcula o returns_at com base na fração já percorrida.
 *
 * Se o ataque já está voltando (status = 'returning'),
 * o returns_at atual já é o correto — não chamar esta função.
 *
 * @param {number} sentAt     timestamp ms quando o ataque foi enviado
 * @param {number} arrivesAt  timestamp ms de chegada original
 * @param {number} nowMs      timestamp ms do cancelamento
 * @returns {number} returns_at em ms
 */
export function calcCancelReturnTime(sentAt, arrivesAt, nowMs = Date.now()) {
  const totalTravel = arrivesAt - sentAt          // tempo total de ida (ms)
  const elapsed     = nowMs - sentAt              // quanto já percorreu (ms)
  const fraction    = Math.min(elapsed / totalTravel, 1) // 0.0 → 1.0
  const returnTravel = Math.round(fraction * totalTravel) // tempo de volta proporcional
  return Math.max(nowMs + MIN_TRAVEL_MS, nowMs + returnTravel)
}

/**
 * Formata milissegundos em string legível "H:MM:SS" ou "MM:SS" ou "0.2s".
 * Usado para exibir tempo de viagem/retorno na interface.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatTravelTime(ms) {
  if (ms < 1000) return `${ms}ms`
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
