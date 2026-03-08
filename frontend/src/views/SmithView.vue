<template>
  <GameLayout>
    <div class="smith-view">

      <!-- ── Cabeçalho ── -->
      <div class="main-header">
        <img src="/buildings/icons/smith1.webp" class="main-header-img" alt="Ferreiro" />
        <div class="main-header-info">
          <h2 class="main-title">Ferreiro (Nível {{ smithLevel }})</h2>
          <p class="main-desc">
            No ferreiro você pode pesquisar e melhorar suas armas.
            Quanto maior o nível do Ferreiro melhores serão as armas
            que você poderá pesquisar e menores serão as durações de tais pesquisas.
          </p>
        </div>
        <a class="main-help" href="#">Ajuda - Edifícios</a>
      </div>

      <!-- ── Pesquisa em andamento ── -->
      <template v-if="researchQueue.length">
        <div class="queue-next">
          Conclusão da pesquisa ({{ RESEARCH_CONFIGS[researchQueue[0].unitKey]?.name }}):
          <strong>{{ formatTimeLeft(researchQueue[0].endsAt) }}</strong>
        </div>

        <table class="queue-table">
          <thead>
            <tr>
              <th>Pesquisa</th>
              <th>Duração</th>
             <th>Conclusão</th>
              <th>Cancelar *</th>
            </tr>
          </thead>
         <tbody>
            <tr v-for="job in researchQueue" :key="job.unitKey" class="queue-row">
              <td class="qcol-unit">
                <div class="unit-sprite" :style="spriteStyle(job.unitKey, true)"></div>
                {{ RESEARCH_CONFIGS[job.unitKey]?.name }}
              </td>
              <td class="qcol-dur">{{ formatBuildTime(RESEARCH_CONFIGS[job.unitKey]?.researchTime ?? 0) }}</td>
              <td class="qcol-end">{{ formatConclusion(job.endsAt) }}</td>
              <td class="qcol-cancel">
                <button class="cancel-train-btn" @click="cancelResearch(job.unitKey)">
                  ✕ Cancelar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="queue-refund-note">*(os recursos serão devolvidos ao seu armazém)</p>
      </template>

      <!-- ── Tabela de pesquisas ── -->
      <div class="research-columns">

        <div v-for="cat in categories" :key="cat.key" class="research-category">
          <div class="category-header">{{ cat.label }}</div>

          <div
            v-for="u in categoryUnits(cat.key)"
            :key="u.key"
            class="research-row"
            :class="{
              'research-row--researched':  isResearched(u.key),
              'research-row--unavailable': !isResearched(u.key) && !canResearch(u.key),
            }"
          >
            <div class="research-unit-info">

              <!-- Ícone sprite -->
              <div class="sprite-wrap">
                <div
                  class="unit-sprite"
                  :style="spriteStyle(u.key, isResearched(u.key) || isInQueue(u.key))"
                ></div>
                <div
                  v-if="!isResearched(u.key) && !isInQueue(u.key)"
                  class="sprite-x"
                ></div>
              </div>

              <!-- Texto -->
              <div class="research-unit-text">
                <span class="research-unit-name">{{ u.name }}</span>

                <template v-if="isResearched(u.key)">
                  <span class="research-status--done">Pesquisado</span>
                </template>

                <template v-else-if="isInQueue(u.key)">
                  <span class="research-status--progress">Pesquisando...</span>
                </template>

                <template v-else-if="!canResearch(u.key)">
                  <span class="research-status--req">Requisitos em falta:</span>
                  <span
                    v-for="(reqLevel, reqKey) in u.requires"
                    :key="reqKey"
                    class="research-req req-unmet"
                  >
                    {{ BUILDING_NAMES[reqKey] }} ({{ reqLevel }})
                  </span>
                </template>

                <template v-else>
                  <div class="research-cost">
                    <template v-if="u.researchCost.wood">
                      <i class="icon" :style="iconStyle('madeira')"></i>{{ u.researchCost.wood }}
                    </template>
                    <template v-if="u.researchCost.stone">
                      <i class="icon" :style="iconStyle('argila')"></i>{{ u.researchCost.stone }}
                    </template>
                    <template v-if="u.researchCost.iron">
                      <i class="icon" :style="iconStyle('ferro')"></i>{{ u.researchCost.iron }}
                    </template>
                  </div>
                  <button
                    class="research-btn"
                    :disabled="!!researchQueue.length"
                    @click="startResearch(u.key)"
                  >
                    Pesquisar
                  </button>
                </template>
              </div>

            </div>
          </div>
        </div>

      </div>

      <!-- ── Erro ── -->
      <div v-if="errorMsg" class="build-error">{{ errorMsg }}</div>

    </div>
  </GameLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'
import { formatBuildTime } from '../../../shared/buildings.js'

const API = 'http://localhost:9999/api'

const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const { iconStyle } = useIcons()

const village    = computed(() => villageStore.village)
const smithLevel = computed(() => village.value?.buildings.smith ?? 1)

const researched    = ref({})
const researchQueue = ref([])
const buildings     = ref({})
const errorMsg      = ref('')

const BUILDING_NAMES = {
  main:     'Edifício Principal',
  barracks: 'Quartel',
  stable:   'Estábulo',
  garage:   'Oficina',
  smith:    'Ferreiro',
}

const RESEARCH_CONFIGS = {
  spear: {
    name: 'Lanceiro', category: 'infantry',
    researchCost: { wood: 0, stone: 0, iron: 0 },
    researchTime: 0, requires: {}, defaultResearched: true,
  },
  sword: {
    name: 'Espadachim', category: 'infantry',
    researchCost: { wood: 0, stone: 0, iron: 0 },
    researchTime: 0, requires: {}, defaultResearched: true,
  },
  axe: {
    name: 'Bárbaro', category: 'infantry',
    researchCost: { wood: 200, stone: 0, iron: 100 },
    researchTime: 1800, requires: { smith: 2 },
  },
  archer: {
    name: 'Arqueiro', category: 'infantry',
    researchCost: { wood: 400, stone: 200, iron: 100 },
    researchTime: 3600, requires: { barracks: 5, smith: 5 },
  },
  spy: {
    name: 'Explorador', category: 'cavalry',
    researchCost: { wood: 0, stone: 0, iron: 400 },
    researchTime: 2700, requires: { stable: 1 },
  },
  light: {
    name: 'Cavalaria leve', category: 'cavalry',
    researchCost: { wood: 0, stone: 0, iron: 2000 },
    researchTime: 7200, requires: { stable: 3 },
  },
  marcher: {
    name: 'Arqueiro a cavalo', category: 'cavalry',
    researchCost: { wood: 1200, stone: 0, iron: 1200 },
    researchTime: 7200, requires: { stable: 5 },
  },
  heavy: {
    name: 'Cavalaria pesada', category: 'cavalry',
    researchCost: { wood: 0, stone: 0, iron: 4000 },
    researchTime: 18000, requires: { stable: 10, smith: 15 },
  },
  ram: {
    name: 'Aríete', category: 'siege',
    researchCost: { wood: 800, stone: 300, iron: 0 },
    researchTime: 7200, requires: { garage: 1 },
  },
  catapult: {
    name: 'Catapulta', category: 'siege',
    researchCost: { wood: 1400, stone: 800, iron: 400 },
    researchTime: 18000, requires: { garage: 2, smith: 12 },
  },
}

const SPRITE_MAP = {
  sword:    { grey: [0, 0],  color: [0, 1]  },
  spear:    { grey: [0, 3],  color: [0, 4]  },
  ram:      { grey: [0, 6],  color: [0, 7]  },
  marcher:  { grey: [0, 8],  color: [0, 9]  },
  knight:   { grey: [0, 11], color: [0, 11] },
  catapult: { grey: [0, 13], color: [0, 14] },
  archer:   { grey: [0, 16], color: [0, 17] },
  spy:      { grey: [1, 2],  color: [1, 3]  },
  snob:     { grey: [1, 4],  color: [1, 5]  },
  light:    { grey: [1, 9],  color: [1, 10] },
  heavy:    { grey: [1, 11], color: [1, 12] },
  axe:      { grey: [1, 14], color: [1, 15] },
}

const FRAME = 60
const COLS  = 18
const ROWS  = 2

function spriteStyle(key, isColor) {
  const entry = SPRITE_MAP[key]
  if (!entry) return {}
  const [row, col] = isColor ? entry.color : entry.grey
  return {
    width:              `${FRAME}px`,
    height:             `${FRAME}px`,
    backgroundImage:    `url('/assets/units/unit_big.webp')`,
    backgroundSize:     `${COLS * FRAME}px ${ROWS * FRAME}px`,
    backgroundPosition: `-${col * FRAME}px -${row * FRAME}px`,
    backgroundRepeat:   'no-repeat',
    display:            'inline-block',
    flexShrink:         '0',
  }
}

const categories = [
  { key: 'infantry', label: 'Infantaria'     },
  { key: 'cavalry',  label: 'Cavalaria'      },
  { key: 'siege',    label: 'Armas de cerco' },
]

function categoryUnits(cat) {
  return Object.entries(RESEARCH_CONFIGS)
    .filter(([, u]) => u.category === cat)
    .map(([key, u]) => ({ key, ...u }))
}

function isResearched(key) {
  if (RESEARCH_CONFIGS[key]?.defaultResearched) return true
  return !!researched.value[key]
}

function isInQueue(key) {
  return researchQueue.value.some(j => j.unitKey === key)
}

function canResearch(key) {
  if (isResearched(key) || isInQueue(key)) return false
  const reqs = RESEARCH_CONFIGS[key]?.requires ?? {}
  return Object.entries(reqs).every(
    ([reqKey, reqLevel]) => (buildings.value[reqKey] ?? 0) >= reqLevel
  )
}

function formatTimeLeft(endsAt) {
  const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
  return formatBuildTime(diff)
}

async function fetchSmith() {
  try {
    const { data } = await axios.get(`${API}/smith`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    researched.value    = data.researched    ?? {}
    researchQueue.value = data.researchQueue ?? []
    buildings.value     = data.buildings     ?? {}
  } catch (e) {
    console.error('Erro ao carregar ferreiro:', e)
  }
}

function formatConclusion(endsAt) {
  const d   = new Date(endsAt)
  const now = new Date()
  const time = d.toLocaleTimeString('pt-BR')
  const isToday    = d.toDateString() === now.toDateString()
  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()
  if (isToday)    return `hoje às ${time}`
  if (isTomorrow) return `amanhã às ${time}`
  return d.toLocaleDateString('pt-BR') + ' às ' + time
}

async function cancelResearch(unitKey) {
  errorMsg.value = ''
  try {
    await axios.post(`${API}/smith/cancel`, { unitKey }, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    await fetchSmith()
    await villageStore.fetchVillage()
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao cancelar pesquisa.'
  }
}

async function startResearch(unitKey) {
  errorMsg.value = ''
  try {
    await axios.post(`${API}/smith/research`, { unitKey }, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    await fetchSmith()
    await villageStore.fetchVillage()
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao iniciar pesquisa.'
  }
}

let tickInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchSmith()
  tickInterval = setInterval(() => {
    villageStore.updateResources()
    const now = Date.now()
    if (researchQueue.value.some(j => j.endsAt <= now)) fetchSmith()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
.smith-view {
  padding: 0 16px 20px;
  color: #3b2200;
  font-size: 12px;
  font-family: Verdana, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Header ── */
.main-header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 10px;
}
.main-header-img { width: 120px; height: 120px; object-fit: contain; flex-shrink: 0; }
.main-header-info { flex: 1; }
.main-title { font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #000; }
.main-desc  { font-size: 12px; color: #000; margin: 0; line-height: 1.5; }
.main-help  { font-size: 11px; color: #8b4513; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.main-help:hover { text-decoration: underline; }

/* ── Fila de pesquisa ── */
.queue-next {
  background: #c8a460;
  border: 1px solid #8b6535;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: bold;
  color: #3b2200;
}
.queue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.queue-table thead tr {
  background: #c8a460;
  color: #3b2200;
  font-weight: bold;
}
.queue-table thead th {
  padding: 4px 8px;
  text-align: left;
  border: 1px solid #8b6535;
}
.queue-row { border-bottom: 1px solid #ddd0a0; background: #fff8e8; }
.qcol-unit {
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}
.qcol-dur, .qcol-end { padding: 4px 8px; }
.qcol-cancel { padding: 4px 8px; }
.cancel-train-btn {
  background: #8b2020;
  border: 1px solid #5a1010;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 2px 10px;
  cursor: pointer;
}
.cancel-train-btn:hover { background: #6a1010; }
.queue-refund-note {
  font-size: 10px;
  color: #7a6040;
  font-style: italic;
  margin: 0;
}

.queue-item { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.queue-name { flex: 1; font-weight: bold; }
.queue-timer { color: #8b4513; font-weight: bold; }

/* ── Grid ── */
.research-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border: 1px solid #8b6535;
}
.research-category { border-right: 1px solid #8b6535; }
.research-category:last-child { border-right: none; }

.category-header {
  background: #c8a460;
  border-bottom: 1px solid #8b6535;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: bold;
  color: #3b2200;
}

/* ── Linha ── */
.research-row {
  border-bottom: 1px solid #ddd0a0;
  padding: 6px 8px;
  min-height: 72px;
  background: #fff8e8;
  display: flex;
  align-items: stretch;
}
.research-row:nth-child(even)    { background: #f4e4bc; }
.research-row:last-child         { border-bottom: none; }
.research-row--researched        { background: #f4e4bc !important; }
.research-row--unavailable       { background: #f4e4bc !important; }

.research-unit-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

/* ── Sprite + X ── */
.sprite-wrap {
  position: relative;
  flex-shrink: 0;
  width: 60px;
  height: 60px;
}

.sprite-x {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sprite-x::before,
.sprite-x::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 15%;
  width: 70%;
  height: 5px;
  background: #cc1111;
  border-radius: 2px;
  transform-origin: center;
}
.sprite-x::before { transform: translateY(-50%) rotate(45deg); }
.sprite-x::after  { transform: translateY(-50%) rotate(-45deg); }

/* ── Texto ── */
.research-unit-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
  min-width: 0;
}
.research-unit-name { font-weight: bold; font-size: 12px; color: #3b2200; }

.research-status--done     { font-size: 11px; color: #555; font-style: italic; }
.research-status--progress { font-size: 11px; color: #8b4513; font-style: italic; }
.research-status--req      { font-size: 10px; color: #7a6040; }

.research-req { display: block; font-size: 10px; padding-left: 2px; }
.req-unmet    { color: #9a4020; }
.req-met      { color: #4a7c2f; }

.research-cost {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #5a3a00;
  flex-wrap: wrap;
}
.research-cost .icon { margin-right: 1px; }

.research-btn {
  background: #c8a460;
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 11px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 2px 10px;
  cursor: pointer;
  width: fit-content;
  margin-top: 2px;
}
.research-btn:hover:not(:disabled) { background: #b8944a; }
.research-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
}
</style>