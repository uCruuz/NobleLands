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

/** Bônus de defesa da muralha por nível: defForce × WALL_BONUS^level */
const WALL_BONUS_FACTOR = 1.037

/** Sorte: ±25% sobre a força atacante */
const LUCK_RANGE = 0.25

// ── Helpers de movimento ───────────────────────────────────────────────────

/**
 * Distância euclidiana entre duas coordenadas do mapa.
 */
export function mapDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

/**
 * Retorna o speed (min/campo) mais lento entre as unidades enviadas.
 * Unidades com qty = 0 ou desconhecidas são ignoradas.
 *
 * @param {Object} troops  { spear: 10, axe: 5, ... }
 * @returns {number} speed mais lento (min/campo), ou 0 se troops vazio
 */
export function slowestSpeed(troops) {
  let max = 0
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
 */
export function travelTimeMs(distance, speed, worldSpeed = 1, unitSpeed = 1) {
  if (distance === 0 || speed === 0) return MIN_TRAVEL_MS
  const msPerField = speed * 60_000
  const raw = (distance * msPerField) / (worldSpeed * unitSpeed)
  return Math.max(MIN_TRAVEL_MS, Math.round(raw))
}

/**
 * Calcula arrives_at e returns_at de um comando.
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
 * Calcula returns_at ao cancelar um ataque em andamento (proporcional ao percorrido).
 */
export function calcCancelReturnTime(sentAt, arrivesAt, nowMs = Date.now()) {
  const totalTravel  = arrivesAt - sentAt
  const elapsed      = nowMs - sentAt
  const fraction     = Math.min(elapsed / totalTravel, 1)
  const returnTravel = Math.round(fraction * totalTravel)
  return Math.max(nowMs + MIN_TRAVEL_MS, nowMs + returnTravel)
}

/**
 * Formata milissegundos em string legível "H:MM:SS" ou "MM:SS".
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

// ── Helpers de combate ─────────────────────────────────────────────────────

/**
 * Soma a força total de ataque de um grupo de tropas.
 *
 * @param {Object} troops  { spear: 10, axe: 5, ... }
 * @returns {number}
 */
function totalAttackPower(troops) {
  let power = 0
  for (const [key, qty] of Object.entries(troops)) {
    if (!qty || qty <= 0) continue
    const cfg = UNIT_CONFIGS[key]
    if (!cfg) continue
    power += cfg.attack * qty
  }
  return power
}

/**
 * Determina o tipo dominante do exército atacante para selecionar
 * o valor de defesa correto do defensor.
 *
 * Retorna 'cavalry' se cavalaria (stable) domina,
 * 'archer'  se arqueiros dominam,
 * 'infantry' caso contrário.
 *
 * A dominância é medida pela contribuição de ataque de cada categoria.
 *
 * @param {Object} troops
 * @returns {'infantry'|'cavalry'|'archer'}
 */
function dominantAttackType(troops) {
  let infantry = 0
  let cavalry  = 0
  let archer   = 0

  for (const [key, qty] of Object.entries(troops)) {
    if (!qty || qty <= 0) continue
    const cfg = UNIT_CONFIGS[key]
    if (!cfg) continue

    const contribution = cfg.attack * qty

    if (cfg.building === 'stable') {
      cavalry += contribution
    } else if (key === 'archer' || key === 'marcher') {
      archer += contribution
    } else {
      infantry += contribution
    }
  }

  if (cavalry >= infantry && cavalry >= archer) return 'cavalry'
  if (archer  >= infantry && archer  >= cavalry) return 'archer'
  return 'infantry'
}

/**
 * Soma a força total de defesa de um grupo de tropas
 * contra um tipo de ataque específico.
 *
 * @param {Object} troops        tropas defensoras { spear: 10, ... }
 * @param {'infantry'|'cavalry'|'archer'} attackType
 * @returns {number}
 */
function totalDefensePower(troops, attackType) {
  let power = 0
  for (const [key, qty] of Object.entries(troops)) {
    if (!qty || qty <= 0) continue
    const cfg = UNIT_CONFIGS[key]
    if (!cfg) continue

    let def
    if (attackType === 'cavalry') {
      def = cfg.defCav
    } else if (attackType === 'archer') {
      def = cfg.defArch
    } else {
      def = cfg.defInf
    }

    power += def * qty
  }
  return power
}

/**
 * Aplica a fórmula de sobrevivência do Tribal Wars.
 *
 * A fração de sobreviventes do lado perdedor é:
 *   survivors = (loserPower / winnerPower)^1.5   (aplicada sobre cada unidade)
 *
 * O lado vencedor perde proporcionalmente:
 *   winners_lost_fraction = 1 - (winnerPower / loserPower * survivors_fraction)
 *   ... simplificado pela fórmula oficial:
 *   winner_survivors = winner_qty × (1 - (loserPower / winnerPower)^0.5)
 *
 * Referência: https://en.wiki.tribalwars.net/wiki/Simulator
 *
 * @param {number} attackPower   força efetiva do atacante (com sorte aplicada)
 * @param {number} defensePower  força efetiva do defensor (com muralha aplicada)
 * @param {Object} attackerTroops
 * @param {Object} defenderTroops
 * @returns {{ attackerSurvivors: Object, defenderSurvivors: Object, winner: 'attacker'|'defender' }}
 */
function applyCasualties(attackPower, defensePower, attackerTroops, defenderTroops) {
  const attackerSurvivors = {}
  const defenderSurvivors = {}

  // Evita divisão por zero
  if (attackPower === 0 && defensePower === 0) {
    for (const [k, q] of Object.entries(attackerTroops)) attackerSurvivors[k] = q
    for (const [k, q] of Object.entries(defenderTroops)) defenderSurvivors[k] = q
    return { attackerSurvivors, defenderSurvivors, winner: 'defender' }
  }

  if (attackPower === 0) {
    for (const [k, q] of Object.entries(attackerTroops)) attackerSurvivors[k] = 0
    for (const [k, q] of Object.entries(defenderTroops)) defenderSurvivors[k] = q
    return { attackerSurvivors, defenderSurvivors, winner: 'defender' }
  }

  if (defensePower === 0) {
    for (const [k, q] of Object.entries(attackerTroops)) attackerSurvivors[k] = q
    for (const [k, q] of Object.entries(defenderTroops)) defenderSurvivors[k] = 0
    return { attackerSurvivors, defenderSurvivors, winner: 'attacker' }
  }

  const winner = attackPower > defensePower ? 'attacker' : 'defender'

  if (winner === 'attacker') {
    // Defensor perde tudo (perde o lado mais fraco)
    for (const [k, q] of Object.entries(defenderTroops)) {
      defenderSurvivors[k] = 0
    }
    // Atacante: survivors_fraction = 1 - (defensePower / attackPower)^0.5
    const survivorFraction = 1 - Math.sqrt(defensePower / attackPower)
    for (const [k, q] of Object.entries(attackerTroops)) {
      attackerSurvivors[k] = Math.round(q * survivorFraction)
    }
  } else {
    // Atacante perde tudo
    for (const [k, q] of Object.entries(attackerTroops)) {
      attackerSurvivors[k] = 0
    }
    // Defensor: survivors_fraction = 1 - (attackPower / defensePower)^0.5
    const survivorFraction = 1 - Math.sqrt(attackPower / defensePower)
    for (const [k, q] of Object.entries(defenderTroops)) {
      defenderSurvivors[k] = Math.round(q * survivorFraction)
    }
  }

  return { attackerSurvivors, defenderSurvivors, winner }
}

// ── API pública de combate ─────────────────────────────────────────────────

/**
 * Resolve uma batalha completa entre atacante e defensor.
 *
 * @param {Object} attackerTroops   { spear: 10, axe: 5, ... }
 * @param {Object} defenderTroops   { spear: 20, sword: 10, ... }
 * @param {number} wallLevel        nível da muralha defensora (0–20)
 * @returns {{
 *   winner:             'attacker' | 'defender',
 *   luck:               number,       // valor aplicado, ex: 0.12 = +12%
 *   attackType:         string,
 *   rawAttackPower:     number,
 *   effectiveAttack:    number,       // com sorte
 *   rawDefensePower:    number,
 *   wallBonus:          number,       // multiplicador da muralha, ex: 1.297
 *   effectiveDefense:   number,       // com muralha
 *   attackerSurvivors:  Object,
 *   defenderSurvivors:  Object,
 * }}
 */
export function resolveBattle(attackerTroops, defenderTroops, wallLevel = 0) {
  // ── Sorte: valor aleatório entre -LUCK_RANGE e +LUCK_RANGE ──────────────
  const luck = parseFloat((Math.random() * LUCK_RANGE * 2 - LUCK_RANGE).toFixed(4))

  // ── Forças brutas ────────────────────────────────────────────────────────
  const attackType    = dominantAttackType(attackerTroops)
  const rawAttack     = totalAttackPower(attackerTroops)
  const effectiveAtk  = Math.max(0, Math.round(rawAttack * (1 + luck)))

  const rawDefense    = totalDefensePower(defenderTroops, attackType)
  const wallBonus     = parseFloat(Math.pow(WALL_BONUS_FACTOR, wallLevel).toFixed(4))
  const effectiveDef  = Math.round(rawDefense * wallBonus)

  // ── Resolve baixas ───────────────────────────────────────────────────────
  const { attackerSurvivors, defenderSurvivors, winner } = applyCasualties(
    effectiveAtk,
    effectiveDef,
    attackerTroops,
    defenderTroops
  )

  return {
    winner,
    luck,
    attackType,
    rawAttackPower:   rawAttack,
    effectiveAttack:  effectiveAtk,
    rawDefensePower:  rawDefense,
    wallBonus,
    effectiveDefense: effectiveDef,
    attackerSurvivors,
    defenderSurvivors,
  }
}

/**
 * Calcula o saque que as tropas sobreviventes do atacante podem carregar.
 *
 * O esconderijo protege uma quantidade fixa de recursos (distribuída igualmente
 * entre os três tipos). O atacante só pode saquear o que está exposto.
 *
 * @param {Object} survivors       tropas sobreviventes do atacante
 * @param {{ wood: number, stone: number, iron: number }} defResources recursos atuais do defensor
 * @param {number} hidingCapacity  total protegido pelo esconderijo
 * @returns {{ wood: number, stone: number, iron: number }}
 */
export function calcLoot(survivors, defResources, hidingCapacity = 0) {
  // Capacidade de carga total das tropas sobreviventes
  let carryCapacity = 0
  for (const [key, qty] of Object.entries(survivors)) {
    if (!qty || qty <= 0) continue
    const cfg = UNIT_CONFIGS[key]
    if (!cfg) continue
    carryCapacity += cfg.carry * qty
  }

  if (carryCapacity === 0) return { wood: 0, stone: 0, iron: 0 }

  // Recursos expostos (esconderijo protege igualmente os três tipos)
  const hiddenPerResource = Math.floor(hidingCapacity / 3)
  const exposedWood  = Math.max(0, Math.floor(defResources.wood)  - hiddenPerResource)
  const exposedStone = Math.max(0, Math.floor(defResources.stone) - hiddenPerResource)
  const exposedIron  = Math.max(0, Math.floor(defResources.iron)  - hiddenPerResource)
  const totalExposed = exposedWood + exposedStone + exposedIron

  if (totalExposed === 0) return { wood: 0, stone: 0, iron: 0 }

  // Se a carga comporta tudo, leva tudo; senão distribui proporcionalmente
  if (carryCapacity >= totalExposed) {
    return {
      wood:  exposedWood,
      stone: exposedStone,
      iron:  exposedIron,
    }
  }

  // Distribui a capacidade de carga proporcionalmente entre os recursos disponíveis
  const ratio = carryCapacity / totalExposed
  return {
    wood:  Math.floor(exposedWood  * ratio),
    stone: Math.floor(exposedStone * ratio),
    iron:  Math.floor(exposedIron  * ratio),
  }
}

/**
 * Resolve uma missão de espionagem.
 *
 * Regras (inspiradas no TW):
 *  - Cada espião atacante enfrenta os espiões defensores que estão em casa.
 *  - Se o atacante tiver mais espiões, vence e obtém o relatório completo.
 *  - Se o defensor tiver mais (ou igual), os espiões atacantes são destruídos
 *    e o defensor recebe um relatório de tentativa de espionagem.
 *  - A muralha adiciona espiões "virtuais" defensores: wallLevel espiões extras.
 *
 * @param {number} attackingSpies   quantidade de espiões enviados
 * @param {number} defendingSpies   espiões do defensor presentes na aldeia
 * @param {number} wallLevel        nível da muralha (adiciona espiões virtuais)
 * @returns {{
 *   success:          boolean,
 *   attackerSpiesLost: number,
 *   defenderSpiesLost: number,
 * }}
 */
export function resolveEspionage(attackingSpies, defendingSpies, wallLevel = 0) {
  // Muralha adiciona espiões defensores virtuais
  const totalDefending = defendingSpies + wallLevel

  if (attackingSpies > totalDefending) {
    // Espionagem bem-sucedida
    // Espiões defensores perdidos: proporcional à vantagem do atacante
    const fraction        = totalDefending > 0
      ? Math.sqrt(totalDefending / attackingSpies)
      : 0
    const defSpiesLost    = Math.min(defendingSpies, Math.round(defendingSpies * fraction))
    const atkSpiesLost    = 0

    return {
      success:           true,
      attackerSpiesLost: atkSpiesLost,
      defenderSpiesLost: defSpiesLost,
    }
  } else {
    // Espionagem fracassada — todos os espiões atacantes morrem
    const fraction     = attackingSpies / Math.max(1, totalDefending)
    const defSpiesLost = Math.min(defendingSpies, Math.round(defendingSpies * fraction * 0.5))

    return {
      success:           false,
      attackerSpiesLost: attackingSpies,
      defenderSpiesLost: defSpiesLost,
    }
  }
}

/**
 * Determina o resultado (cor) do relatório para cada lado.
 *
 * Para o atacante:
 *   green  = venceu sem perder nenhuma unidade
 *   yellow = venceu com perdas
 *   red    = perdeu
 *
 * Para o defensor: inverte green↔red, yellow permanece yellow.
 *
 * @param {'attacker'|'defender'} winner
 * @param {Object} sent       tropas enviadas pelo atacante
 * @param {Object} survivors  tropas sobreviventes do atacante
 * @param {'attacker'|'defender'} perspective
 * @returns {'green'|'yellow'|'red'}
 */
export function calcReportResult(winner, sent, survivors, perspective) {
  const attackerWon = winner === 'attacker'

  if (perspective === 'attacker') {
    if (!attackerWon) return 'red'
    const hadLosses = Object.entries(sent).some(([k, q]) => (survivors[k] ?? 0) < q)
    return hadLosses ? 'yellow' : 'green'
  }

  // perspective === 'defender'
  if (attackerWon) return 'red'
  const hadLosses = Object.entries(sent).some(([k, q]) => (survivors[k] ?? 0) < q)
  return hadLosses ? 'yellow' : 'green'
}
