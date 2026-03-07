// src/composables/useIcons.js
//
// Spritesheet: /icons/icons.png
// Cada ícone: 18x18px com 1px de gap entre eles (step = 19px)
// Layout:
//   Linha 1 (y=1 ):  índices  0– 9
//   Linha 2 (y=20):  índices 10–19
//   Linha 3 (y=39):  índices 20–29
//   Linha 4 (y=58):  índices 30–38
//   Especiais (y=77, canto dir): configuracoes=39, error=40

const STEP = 19   // 18px ícone + 1px gap
const SIZE = 18   // tamanho visual do ícone

function gridPos(index) {
  // configuracoes (39) e error (40) ficam no canto inferior direito
  if (index === 49) return { x: 153, y: 77 }
  if (index === 50) return { x: 172, y: 77 }

  const col = index % 10
  const row = Math.floor(index / 10)
  const rowOffsets = [1, 20, 39, 58]
  return {
    x: 1 + col * STEP,
    y: rowOffsets[row] ?? 1,
  }
}

// ── Mapa de nomes ────────────────────────────────────────────
export const ICONS = {
  // Linha 1 (0–9)
  armazem:              0,
  madeira:              1,
  argila:               2,
  ferro:                3,
  populacao:            4,
  tropa:                5,
  seta_esquerda:        6,
  seta_direita:         7,
  nova_mensagem:        8,
  sem_mensagem:         9,

  // Linha 2 (10–19)
  novo_relatorio:      10,
  sem_relatorio:       11,
  slide_down:          12,
  slide_up:            13,
  paladino:            14,
  nova_msg_tribo:      15,
  sem_msg_tribo:       16,
  bandeiras:           17,
  nova_bandeira:       18,
  relogio:             19,

  // Linha 3 (20–29)
  mapa1:               20,
  mapa2:               21,
  aldeia:              22,
  favorito:            23,
  remover_favorito:    24,
  cidade:              25,
  pontos_premium:      26,
  reservado:           27, // reservado — sem uso definido
  mercado:             28,
  inventario:          29,

  // Linha 4 (30–38)
  overview:            30,
  perfil:              31,
  assistente_conta:    32,
  assistente_saque:    33,
  noite:               34,
  apoio:               35,
  village_context:     36,
  village_context_sel: 37,
  info:                38,

  // Especiais — canto inferior direito
  configuracoes:       49,
  error:               50,
}

// ── Função de estilo ─────────────────────────────────────────
export function useIcons() {
  function iconStyle(indexOrName) {
    const index = typeof indexOrName === 'string'
      ? (ICONS[indexOrName] ?? 0)
      : indexOrName

    const { x, y } = gridPos(index)

    return {
      backgroundImage:    "url('/icons/icons.png')",
      backgroundRepeat:   'no-repeat',
      backgroundPosition: `-${x}px -${y}px`,
      backgroundSize:     'auto',
      width:              `${SIZE}px`,
      height:             `${SIZE}px`,
      display:            'inline-block',
      verticalAlign:      'middle',
      flexShrink:         '0',
    }
  }

  return { ICONS, iconStyle }
}