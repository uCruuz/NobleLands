/**
 * worldUtils.js — funções puras para geração e navegação de mundos
 * Sem dependências externas, totalmente testáveis em isolamento.
 */

/**
 * Retorna o continente no formato "KXY" a partir das coordenadas.
 * Cada continente cobre um quadrante de 100x100 tiles.
 * Ex: (523, 487) → K45  (centena de y=4, centena de x=5)
 *
 * @param {number} x
 * @param {number} y
 * @returns {string} ex: "K55"
 */
export function getContinent(x, y) {
  const kx = Math.floor(x / 100)
  const ky = Math.floor(y / 100)
  return `K${ky}${kx}`
}

/**
 * Retorna o anel (distância Chebyshev) de uma coordenada em relação ao centro.
 * Ring 0 = tile central, ring 1 = 3x3 ao redor, ring N = quadrado de lado 2N+1.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} cx  centro x do mundo
 * @param {number} cy  centro y do mundo
 * @returns {number}
 */
export function getRing(x, y, cx, cy) {
  return Math.max(Math.abs(x - cx), Math.abs(y - cy))
}

/**
 * Gerador de coordenadas em espiral a partir do centro.
 * Produz tiles em ordem crescente de anel, cobrindo o mundo inteiro.
 * Uso: for (const [x, y] of spiralCoords(500, 500, 50)) { ... }
 *
 * @param {number} cx     centro x
 * @param {number} cy     centro y
 * @param {number} maxR   anel máximo (metade do tamanho do mundo)
 * @yields {[number, number]}
 */
export function* spiralCoords(cx, cy, maxR) {
  // Ring 0: só o centro
  yield [cx, cy]

  for (let r = 1; r <= maxR; r++) {
    // Começa no canto superior esquerdo e percorre o perímetro no sentido horário
    let x = cx - r
    let y = cy - r

    // Borda superior: esquerda → direita
    for (let i = 0; i < 2 * r; i++) yield [x + i, y]
    // Borda direita: cima → baixo
    for (let i = 0; i < 2 * r; i++) yield [x + 2 * r, y + i]
    // Borda inferior: direita → esquerda
    for (let i = 0; i < 2 * r; i++) yield [x + 2 * r - i, y + 2 * r]
    // Borda esquerda: baixo → cima
    for (let i = 0; i < 2 * r; i++) yield [x, y + 2 * r - i]
  }
}

/**
 * Calcula a densidade de aldeias para um dado anel.
 * Anéis internos são mais densos, anéis externos mais esparsos —
 * igual ao comportamento do TW original.
 *
 * @param {number} ring
 * @param {object} config  objeto world_configs { speed, production_rate, ... }
 * @returns {number} probabilidade de 0.0 a 1.0 de um tile ter aldeia
 */
export function getDensity(ring, config) {
  const base   = Math.max(0.08, 0.9 * Math.pow(0.992, ring))
  const factor = config?.production_rate ?? 1.0
  return Math.min(1.0, base * Math.sqrt(factor))
}

/**
 * Garante que as coordenadas estejam dentro dos limites do mundo.
 * @param {number} x
 * @param {number} y
 * @param {number} size  tamanho do mundo (ex: 1000 → tiles de 0 a 999)
 * @returns {boolean}
 */
export function isInBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size
}
