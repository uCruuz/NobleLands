/**
 * shared/mapNoise.js
 *
 * Lógica de terrain compartilhada entre frontend e backend.
 * Chame initNoise(seed) antes de usar hasForest/hasWater.
 * A seed é salva no banco — mesma seed = mesmo mapa sempre.
 */

// ── Tabela de permutação (modificada pela seed) ───────────────────────────

const _P = new Uint8Array(512)

const _BASE = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
  69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
  252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,
  168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,
  211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,
  216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,
  164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,
  126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,
  213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,
  253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,
  242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
  192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
]

// Inicializa com a tabela padrão
for (let i = 0; i < 256; i++) _P[i] = _P[i + 256] = _BASE[i]

/**
 * Inicializa o noise com uma seed.
 * Deve ser chamado antes de qualquer função de terrain.
 * @param {number} seed — inteiro positivo
 */
export function initNoise(seed) {
  // Copia a tabela base
  const table = [..._BASE]

  // Embaralha usando mulberry32 (PRNG determinístico a partir da seed)
  let s = seed >>> 0
  function rand() {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [table[i], table[j]] = [table[j], table[i]]
  }

  for (let i = 0; i < 256; i++) _P[i] = _P[i + 256] = table[i]
}

// ── Perlin Noise ──────────────────────────────────────────────────────────

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function _lerp(a, b, t) { return a + t * (b - a) }
function _grad(h, x, y) {
  h &= 3
  return ((h & 1) ? -x : x) + ((h & 2) ? -y : y)
}
function _noise(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
  x -= Math.floor(x); y -= Math.floor(y)
  const u = _fade(x), v = _fade(y)
  const a = _P[X] + Y, b = _P[X + 1] + Y
  return _lerp(
    _lerp(_grad(_P[a],     x,     y),     _grad(_P[b],     x - 1, y),     u),
    _lerp(_grad(_P[a + 1], x,     y - 1), _grad(_P[b + 1], x - 1, y - 1), u),
    v
  )
}

export function noise01(x, y, scale) {
  return (_noise(x * scale, y * scale) + 1) / 2
}

// ── Thresholds ────────────────────────────────────────────────────────────

const GRASS_SCALE      = 0.90   // variação da grama
const FOREST_SCALE     = 0.72   // patches pequenos e espalhados
const FOREST_THRESHOLD = 0.54   // top ~22% vira floresta
const WATER_SCALE      = 0.72   // mesma frequência da floresta
const WATER_THRESHOLD  = 0.20   // bottom ~4% candidatos a água

// ── Terrain ───────────────────────────────────────────────────────────────

export function getGrassTile(wx, wy) {
  const n = noise01(wx, wy, GRASS_SCALE)
  if (n < 0.25) return 'gras1'
  if (n < 0.50) return 'gras2'
  if (n < 0.75) return 'gras3'
  return 'gras4'
}

export function hasForest(wx, wy) {
  if (wx < 0 || wy < 0 || wx > 999 || wy > 999) return false
  return noise01(wx, wy, FOREST_SCALE) > FOREST_THRESHOLD
}

/**
 * Água: tile só é água se o noise estiver abaixo do threshold
 * E nenhum vizinho cardinal também for água — garante tiles isolados.
 */
export function hasWater(wx, wy) {
  if (wx < 0 || wy < 0 || wx > 999 || wy > 999) return false
  if (noise01(wx, wy, WATER_SCALE) >= WATER_THRESHOLD) return false
  return (
    noise01(wx + 1, wy,     WATER_SCALE) >= WATER_THRESHOLD &&
    noise01(wx - 1, wy,     WATER_SCALE) >= WATER_THRESHOLD &&
    noise01(wx,     wy + 1, WATER_SCALE) >= WATER_THRESHOLD &&
    noise01(wx,     wy - 1, WATER_SCALE) >= WATER_THRESHOLD
  )
}

// Tile é utilizável para aldeia — nem floresta nem água
export function isGrassTile(wx, wy) {
  return !hasForest(wx, wy) && !hasWater(wx, wy)
}

export function getForestKey(wx, wy) {
  const s = hasForest(wx, wy + 1) ? '1' : '0'
  const o = hasForest(wx - 1, wy) ? '1' : '0'
  const n = hasForest(wx, wy - 1) ? '1' : '0'
  const e = hasForest(wx + 1, wy) ? '1' : '0'
  return `forest${s}${o}${n}${e}`
}
