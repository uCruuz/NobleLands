/**
 * Dados oficiais das unidades do Tribal Wars
 * Fonte: wiki oficial + interface.php?func=get_unit_info
 *
 * trainTime: segundos base por unidade (nível 1 do edifício produtor)
 * speed: minutos por campo
 * carry: capacidade de carga por unidade
 * pop: população consumida
 * attack / defInf / defCav / defArch: valores de combate
 * building: onde é produzida
 * implemented: false = unidade ainda não implementada no jogo (exibida em branco/cinza)
 * requires: { buildingKey: minLevel } para poder recrutar
 */

export const UNIT_CONFIGS = {

  // ── Quartel (barracks) ────────────────────────────────────────────────────

  spear: {
    name:        'Lanceiro',
    img:         'unit_spear.png',
    building:    'barracks',
    implemented: true,
    wood:  50,  stone: 30,  iron: 10,
    pop:   1,
    trainTime: 658,
    attack:  10,
    defInf:  15, defCav: 45, defArch: 20,
    speed:   18, carry: 25,
    requires: {},
  },

  sword: {
    name:        'Espadachim',
    img:         'unit_sword.png',
    building:    'barracks',
    implemented: true,
    wood:  30,  stone: 30,  iron: 70,
    pop:   1,
    trainTime: 968,
    attack:  25,
    defInf:  50, defCav: 25, defArch: 40,
    speed:   22, carry: 15,
    requires: { smith: 1 },
  },

  axe: {
    name:        'Bárbaro',
    img:         'unit_axe.png',
    building:    'barracks',
    implemented: true,
    wood:  60,  stone: 30,  iron: 40,
    pop:   1,
    trainTime: 880,
    attack:  40,
    defInf:  10, defCav: 5,  defArch: 10,
    speed:   18, carry: 10,
    requires: { smith: 2 },
  },

  archer: {
    name:        'Arqueiro',
    img:         'unit_archer.png',
    building:    'barracks',
    implemented: true,
    wood:  100, stone: 30,  iron: 60,
    pop:   1,
    trainTime: 1200,
    attack:  15,
    defInf:  50, defCav: 5,  defArch: 80,
    speed:   18, carry: 10,
    requires: { main: 5, barracks: 5, smith: 5 },
  },

  // ── Estábulo (stable) ─────────────────────────────────────────────────────

  scout: {
    name:        'Espião',
    img:         'unit_spy.png',
    building:    'stable',
    implemented: false,
    wood:  50,  stone: 50,  iron: 20,
    pop:   2,
    trainTime: 900,
    attack:  0,
    defInf:  2,  defCav: 1,  defArch: 2,
    speed:   9,  carry: 0,
    requires: { stable: 1 },
  },

  light: {
    name:        'Cavalaria Leve',
    img:         'unit_light.png',
    building:    'stable',
    implemented: false,
    wood:  125, stone: 100, iron: 250,
    pop:   4,
    trainTime: 1800,
    attack:  130,
    defInf:  30, defCav: 40, defArch: 30,
    speed:   10, carry: 80,
    requires: { stable: 3, smith: 3 },
  },

  marcher: {
    name:        'Arqueiro Montado',
    img:         'unit_marcher.png',
    building:    'stable',
    implemented: false,
    wood:  250, stone: 100, iron: 150,
    pop:   5,
    trainTime: 2200,
    attack:  120,
    defInf:  40, defCav: 30, defArch: 50,
    speed:   10, carry: 50,
    requires: { stable: 5, smith: 5 },
  },

  heavy: {
    name:        'Cavalaria Pesada',
    img:         'unit_heavy.png',
    building:    'stable',
    implemented: false,
    wood:  200, stone: 150, iron: 600,
    pop:   6,
    trainTime: 3600,
    attack:  150,
    defInf:  200, defCav: 80, defArch: 180,
    speed:   11,  carry: 50,
    requires: { stable: 10, smith: 15 },
  },

  // ── Oficina (workshop) ────────────────────────────────────────────────────

  ram: {
    name:        'Aríete',
    img:         'unit_ram.png',
    building:    'workshop',
    implemented: false,
    wood:  300, stone: 200, iron: 200,
    pop:   5,
    trainTime: 4800,
    attack:  2,
    defInf:  20, defCav: 50, defArch: 20,
    speed:   30, carry: 0,
    requires: { workshop: 1, smith: 10 },
  },

  catapult: {
    name:        'Catapulta',
    img:         'unit_catapult.png',
    building:    'workshop',
    implemented: false,
    wood:  320, stone: 400, iron: 100,
    pop:   8,
    trainTime: 7200,
    attack:  100,
    defInf:  100, defCav: 50, defArch: 100,
    speed:   30,  carry: 0,
    requires: { workshop: 2, smith: 12 },
  },

  // ── Academia (snob) / Estátua (knight) ────────────────────────────────────

  knight: {
    name:        'Paladino',
    img:         'unit_knight.png',
    building:    'statue',
    implemented: false,
    wood:  20,  stone: 20,  iron: 40,
    pop:   10,
    trainTime: 0,   // único, não tem fila
    attack:  150,
    defInf:  250, defCav: 400, defArch: 150,
    speed:   10,  carry: 100,
    requires: { statue: 1 },
  },

  snob: {
    name:        'Nobre',
    img:         'unit_snob.png',
    building:    'snob',
    implemented: false,
    wood:  40000, stone: 50000, iron: 50000,
    pop:   100,
    trainTime: 18000,
    attack:  30,
    defInf:  100, defCav: 50, defArch: 100,
    speed:   35,  carry: 0,
    requires: { snob: 1, smith: 20, main: 20 },
  },

  // ── Milícia (defesa de aldeia, não recrutável normalmente) ────────────────

  militia: {
    name:        'Milícia',
    img:         'unit_militia.png',
    building:    'barracks',
    implemented: false,
    wood:  0,   stone: 0,   iron: 0,
    pop:   0,
    trainTime: 0,
    attack:  0,
    defInf:  15, defCav: 45, defArch: 15,
    speed:   0,  carry: 0,
    requires: {},
  },
}

/**
 * Calcula o tempo de treino de uma unidade em segundos,
 * reduzido pelo nível do edifício produtor.
 * Fórmula: time * 1.026^(-level)
 */
export function getTrainTime(unitKey, buildingLevel = 1) {
  const u = UNIT_CONFIGS[unitKey]
  if (!u) return 0
  return Math.round(u.trainTime * Math.pow(1.026, -buildingLevel))
}

/**
 * Formata segundos em string legível (ex: "0:10:42")
 */
export function formatTrainTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
