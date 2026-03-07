/**
 * Dados oficiais do Tribal Wars
 * Fonte: interface.php?func=get_building_info (XML oficial do jogo)
 * Fórmula: https://gist.github.com/amiuhle/61b0334997805ada0e99
 *
 * Custo por nível:   Math.round(base * factor^(level - 1))
 * Tempo por nível:   Math.round(buildTime * 1.18 * buildTimeFactor^(level - 1 - 14 / (level - 1)))
 * Tempo é reduzido pelo nível do HQ: time * 1.05^(-hqLevel)
 * Produção de recurso por nível: Math.round(30 * 1.163118^level)  (timber/clay/iron)
 * População da fazenda por nível: Math.round(240 * 1.172^level)
 * Capacidade do armazém por nível: Math.round(1000 * 1.2294^level)
 */

// ── Definições base de cada edifício (direto do XML oficial) ────────────────
export const BUILDING_CONFIGS = {
  main: {
    name: 'Edifício Principal',
    maxLevel: 30,
    minLevel: 1,
    wood: 90,        stone: 80,        iron: 70,        pop: 5,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 900,  buildTimeFactor: 1.2,
    requires: {}
  },
  barracks: {
    name: 'Quartel',
    maxLevel: 25,
    minLevel: 0,
    wood: 200,       stone: 170,       iron: 90,        pop: 7,
    woodFactor: 1.26, stoneFactor: 1.28, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 1800, buildTimeFactor: 1.2,
    requires: { main: 3 }
  },
  stable: {
    name: 'Estábulo',
    maxLevel: 20,
    minLevel: 0,
    wood: 270,       stone: 240,       iron: 260,       pop: 8,
    woodFactor: 1.26, stoneFactor: 1.28, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 6000, buildTimeFactor: 1.2,
    requires: { main: 10, barracks: 5, smith: 5 }
  },
  garage: {
    name: 'Oficina',
    maxLevel: 15,
    minLevel: 0,
    wood: 300,       stone: 240,       iron: 260,       pop: 8,
    woodFactor: 1.26, stoneFactor: 1.28, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 6000, buildTimeFactor: 1.2,
    requires: { main: 10, smith: 10 }
  },
  snob: {
    name: 'Academia',
    maxLevel: 3,
    minLevel: 0,
    wood: 15000,     stone: 25000,     iron: 10000,     pop: 80,
    woodFactor: 2,   stoneFactor: 2,   ironFactor: 2,   popFactor: 1.17,
    buildTime: 18000, buildTimeFactor: 1.2,
    requires: { main: 20, smith: 20, market: 10 }
  },
  smith: {
    name: 'Ferreiro',
    maxLevel: 20,
    minLevel: 0,
    wood: 220,       stone: 180,       iron: 240,       pop: 20,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 6000, buildTimeFactor: 1.2,
    requires: { main: 5, barracks: 1 }
  },
  place: {
    name: 'Praça de Reunião',
    maxLevel: 1,
    minLevel: 0,
    wood: 10,        stone: 40,        iron: 30,        pop: 0,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 1000, buildTimeFactor: 1.2,
    requires: {}
  },
  statue: {
    name: 'Estátua',
    maxLevel: 1,
    minLevel: 0,
    wood: 220,       stone: 220,       iron: 220,       pop: 10,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 1500, buildTimeFactor: 1.2,
    requires: {}
  },
  market: {
    name: 'Mercado',
    maxLevel: 25,
    minLevel: 0,
    wood: 100,       stone: 100,       iron: 100,       pop: 20,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 2500, buildTimeFactor: 1.2,
    requires: { main: 3, storage: 2 }
  },
  wood: {
    name: 'Bosque',
    maxLevel: 30,
    minLevel: 0,
    wood: 50,        stone: 60,        iron: 40,        pop: 5,
    woodFactor: 1.25, stoneFactor: 1.275, ironFactor: 1.245, popFactor: 1.17,
    buildTime: 900,  buildTimeFactor: 1.2,
    requires: {}
  },
  stone: {
    name: 'Poço de Argila',
    maxLevel: 30,
    minLevel: 0,
    wood: 65,        stone: 50,        iron: 40,        pop: 10,
    woodFactor: 1.27, stoneFactor: 1.265, ironFactor: 1.24, popFactor: 1.17,
    buildTime: 1200, buildTimeFactor: 1.2,
    requires: {}
  },
  iron: {
    name: 'Mina de Ferro',
    maxLevel: 30,
    minLevel: 0,
    wood: 75,        stone: 65,        iron: 70,        pop: 10,
    woodFactor: 1.252, stoneFactor: 1.275, ironFactor: 1.24, popFactor: 1.17,
    buildTime: 1500, buildTimeFactor: 1.2,
    requires: {}
  },
  farm: {
    name: 'Fazenda',
    maxLevel: 30,
    minLevel: 1,
    wood: 45,        stone: 40,        iron: 30,        pop: 0,
    woodFactor: 1.3,  stoneFactor: 1.32, ironFactor: 1.29, popFactor: 1,
    buildTime: 1200, buildTimeFactor: 1.2,
    requires: {}
  },
  storage: {
    name: 'Armazém',
    maxLevel: 30,
    minLevel: 1,
    wood: 60,        stone: 50,        iron: 40,        pop: 0,
    woodFactor: 1.265, stoneFactor: 1.265, ironFactor: 1.265, popFactor: 1.17,
    buildTime: 1800, buildTimeFactor: 1.2,
    requires: {}
  },
  hide: {
    name: 'Esconderijo',
    maxLevel: 10,
    minLevel: 0,
    wood: 50,        stone: 60,        iron: 50,        pop: 2,
    woodFactor: 1.25, stoneFactor: 1.25, ironFactor: 1.25, popFactor: 1.17,
    buildTime: 1800, buildTimeFactor: 1.2,
    requires: {}
  },
  wall: {
    name: 'Muralha',
    maxLevel: 20,
    minLevel: 0,
    wood: 50,        stone: 100,       iron: 20,        pop: 5,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 3600, buildTimeFactor: 1.2,
    requires: { barracks: 1 }
  },
  church: {
    name: 'Igreja',
    maxLevel: 3,
    minLevel: 0,
    wood: 16000,     stone: 20000,     iron: 5000,      pop: 5,
    woodFactor: 1.26, stoneFactor: 1.275, ironFactor: 1.26, popFactor: 1.17,
    buildTime: 14400, buildTimeFactor: 1.2,
    requires: { main: 5, farm: 5 }
  }
}

// ── Fórmulas oficiais ───────────────────────────────────────────────────────

/**
 * Calcula o custo de construção de um edifício para um nível específico.
 * Aceita tanto uma chave string quanto o objeto config diretamente.
 * @param {string|object} keyOrConfig  - chave do edifício ou objeto config
 * @param {number} level               - nível alvo
 * @returns {{ wood, stone, iron, pop }}
 */
export function getBuildingCost(keyOrConfig, level) {
  const b = typeof keyOrConfig === 'string'
    ? BUILDING_CONFIGS[keyOrConfig]
    : keyOrConfig
  if (!b) return null
  return {
    wood:  Math.round(b.wood  * Math.pow(b.woodFactor,  level - 1)),
    stone: Math.round(b.stone * Math.pow(b.stoneFactor, level - 1)),
    iron:  Math.round(b.iron  * Math.pow(b.ironFactor,  level - 1)),
    pop:   Math.round(b.pop   * Math.pow(b.popFactor,   level - 1))
  }
}

/**
 * Calcula o tempo de construção em segundos.
 * Aceita tanto uma chave string quanto o objeto config diretamente.
 * @param {string|object} keyOrConfig  - chave do edifício ou objeto config
 * @param {number} level               - nível alvo
 * @param {number} hqLevel             - nível atual da sede (reduz o tempo)
 * @returns {number} tempo em segundos
 */
export function getBuildingTime(keyOrConfig, level, hqLevel = 1) {
  const b = typeof keyOrConfig === 'string'
    ? BUILDING_CONFIGS[keyOrConfig]
    : keyOrConfig
  if (!b) return 0
  const exponent = Math.max(-13, level - 1 - 14 / (level - 1))
  const baseTime  = b.buildTime * 1.18 * Math.pow(b.buildTimeFactor, exponent)
  return Math.round(baseTime * Math.pow(1.05, -hqLevel))
}

/**
 * Produção de recursos por hora da serraria/argileira/mina em um nível.
 * @param {number} level
 * @returns {number} recursos por hora
 */
export function getResourceProduction(level) {
  return Math.round(30 * Math.pow(1.163118, level))
}

/**
 * Capacidade de armazenamento do armazém em um nível.
 * @param {number} level
 * @returns {number} capacidade
 */
export function getStorageCapacity(level) {
  return Math.round(1000 * Math.pow(1.2294, level))
}

/**
 * Capacidade de população da fazenda em um nível.
 * @param {number} level
 * @returns {number} população máxima
 */
export function getFarmCapacity(level) {
  return Math.round(240 * Math.pow(1.172, level))
}

/**
 * Capacidade do esconderijo em um nível.
 * @param {number} level
 * @returns {number} recursos protegidos
 */
export function getHidingCapacity(level) {
  return Math.round(50 * Math.pow(1.25, level))
}

/**
 * Formata segundos em string legível (ex: "1h 23min 45s")
 * @param {number} seconds
 * @returns {string}
 */
export function formatBuildTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}min ${s}s`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}
