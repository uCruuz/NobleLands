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

        <table class="buildings-table">
          <thead>
            <tr>
              <th>Pesquisa</th>
              <th>Duração</th>
              <th>Conclusão</th>
              <th>Cancelar *</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in researchQueue" :key="job.unitKey" class="building-row">
              <td class="col-building">
                <img :src="`/units/${UNIT_CONFIGS[job.unitKey]?.img}`" class="building-thumb" alt="" />
                <div class="building-info">
                  <span class="building-link">{{ RESEARCH_CONFIGS[job.unitKey]?.name }}</span>
                  <span class="building-cur-level">Em pesquisa</span>
                </div>
              </td>
              <td class="col-dur">{{ formatBuildTime(RESEARCH_CONFIGS[job.unitKey]?.researchTime ?? 0) }}</td>
              <td class="col-end">{{ formatConclusion(job.endsAt) }}</td>
              <td class="col-cancel">
                <button class="cancel-btn" @click="cancelResearch(job.unitKey)">Cancelar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="queue-refund-note">*(os recursos serão devolvidos ao seu armazém)</p>
      </template>

      <!-- ── Tabela de pesquisas (3 colunas) ── -->
      <table class="buildings-table research-table">
        <thead>
          <tr>
            <th>Infantaria</th>
            <th>Cavalaria</th>
            <th>Armas de cerco</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rowIdx in maxCategoryRows" :key="rowIdx" class="building-row">
            <td
              v-for="cat in categories"
              :key="cat.key"
              class="col-research"
            >
              <template v-if="categoryUnits(cat.key)[rowIdx - 1]">
                <div class="research-unit-info">

                  <!-- Ícone -->
                  <div class="icon-wrap">
                    <img
                      :src="`/units/${UNIT_CONFIGS[categoryUnits(cat.key)[rowIdx - 1].key]?.img}`"
                      class="unit-icon"
                      :class="{
                        'unit-icon--color': isResearched(categoryUnits(cat.key)[rowIdx - 1].key) || isInQueue(categoryUnits(cat.key)[rowIdx - 1].key),
                        'unit-icon--grey':  !isResearched(categoryUnits(cat.key)[rowIdx - 1].key) && !isInQueue(categoryUnits(cat.key)[rowIdx - 1].key),
                      }"
                      alt=""
                    />
                    <div v-if="!isResearched(categoryUnits(cat.key)[rowIdx - 1].key) && !isInQueue(categoryUnits(cat.key)[rowIdx - 1].key)" class="icon-x"></div>
                  </div>

                  <!-- Texto -->
                  <div class="research-unit-text">
                    <span class="research-unit-name">{{ categoryUnits(cat.key)[rowIdx - 1].name }}</span>

                    <template v-if="isResearched(categoryUnits(cat.key)[rowIdx - 1].key)">
                      <span class="research-status--done">Pesquisado</span>
                    </template>

                    <template v-else-if="isInQueue(categoryUnits(cat.key)[rowIdx - 1].key)">
                      <span class="research-status--progress">Pesquisando...</span>
                    </template>

                    <template v-else-if="!canResearch(categoryUnits(cat.key)[rowIdx - 1].key)">
                      <span class="research-status--req">Requisitos em falta:</span>
                      <span
                        v-for="(reqLevel, reqKey) in categoryUnits(cat.key)[rowIdx - 1].requires"
                        :key="reqKey"
                        class="research-req req-unmet"
                      >
                        {{ BUILDING_NAMES[reqKey] }} ({{ reqLevel }})
                      </span>
                    </template>

                    <template v-else>
                      <div class="research-cost">
                        <template v-if="categoryUnits(cat.key)[rowIdx - 1].researchCost.wood">
                          <i class="icon" :style="iconStyle('madeira')"></i>{{ categoryUnits(cat.key)[rowIdx - 1].researchCost.wood }}
                        </template>
                        <template v-if="categoryUnits(cat.key)[rowIdx - 1].researchCost.stone">
                          <i class="icon" :style="iconStyle('argila')"></i>{{ categoryUnits(cat.key)[rowIdx - 1].researchCost.stone }}
                        </template>
                        <template v-if="categoryUnits(cat.key)[rowIdx - 1].researchCost.iron">
                          <i class="icon" :style="iconStyle('ferro')"></i>{{ categoryUnits(cat.key)[rowIdx - 1].researchCost.iron }}
                        </template>
                      </div>
                      <button
                        class="research-btn"
                        :disabled="!!researchQueue.length || !canAffordAll(categoryUnits(cat.key)[rowIdx - 1])"
                        @click="startResearch(categoryUnits(cat.key)[rowIdx - 1].key)"
                      >
                        {{ formatBuildTime(categoryUnits(cat.key)[rowIdx - 1].researchTime) }}
                      </button>
                    </template>
                  </div>

                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

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
import { UNIT_CONFIGS } from '../../../shared/units.js' // spear, sword, axe, archer, spy, light, marcher, heavy, ram, catapult, knight, snob

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

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

const categories = [
  { key: 'infantry', label: 'Infantaria'     },
  { key: 'cavalry',  label: 'Cavalaria'      },
  { key: 'siege',    label: 'Armas de cerco' },
]

// Retorna array de unidades de uma categoria — memoizado por key
const unitsByCategory = computed(() => {
  const result = {}
  for (const cat of categories) {
    result[cat.key] = Object.entries(RESEARCH_CONFIGS)
      .filter(([, u]) => u.category === cat.key)
      .map(([key, u]) => ({ key, ...u }))
  }
  return result
})

function categoryUnits(cat) {
  return unitsByCategory.value[cat] ?? []
}

const maxCategoryRows = computed(() =>
  Math.max(...categories.map(c => categoryUnits(c.key).length))
)

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

const wood  = computed(() => Math.floor(village.value?.resources.wood.current  ?? 0))
const stone = computed(() => Math.floor(village.value?.resources.stone.current ?? 0))
const iron  = computed(() => Math.floor(village.value?.resources.iron.current  ?? 0))

function canAfford(cost, res) {
  if (res === 'wood')  return wood.value  >= cost
  if (res === 'stone') return stone.value >= cost
  if (res === 'iron')  return iron.value  >= cost
  return true
}

function canAffordAll(u) {
  return (
    canAfford(u.researchCost.wood,  'wood')  &&
    canAfford(u.researchCost.stone, 'stone') &&
    canAfford(u.researchCost.iron,  'iron')
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
.main-header-img  { width: 80px; height: 80px; }
.main-header-info { flex: 1; }
.main-title { font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #000; }
.main-desc  { font-size: 12px; color: #000; margin: 0; line-height: 1.5; }
.main-help  { font-size: 11px; color: #8b4513; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.main-help:hover { text-decoration: underline; }

/* ── Tabela base — idêntica ao MainView ── */
.buildings-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 11px;
  background: #ecd8aa;
}
.buildings-table thead th {
  font-size: 9pt;
  text-align: left;
  font-weight: 700;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  padding: 4px 6px;
  white-space: nowrap;
  color: #000;
}
.building-row td {
  background: #f4e4bc;
  vertical-align: middle;
}

/* ── Fila ── */
.queue-next {
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border: 1px solid #8b6535;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: bold;
  color: #000;
}
.col-building {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 4px;
}
.building-thumb     { width: 35px; height: 35px; object-fit: contain; display: block; flex-shrink: 0; }
.building-info      { display: flex; flex-direction: column; gap: 1px; }
.building-link      { font-weight: bold; color: #8b4513; font-size: 11px; }
.building-cur-level { color: #7a6040; font-size: 10px; }
.col-dur, .col-end  { padding: 4px 8px; white-space: nowrap; }
.col-cancel         { padding: 4px 8px; }

.queue-refund-note {
  font-size: 10px;
  color: #7a6040;
  font-style: italic;
  margin: 0;
}

/* ── Tabela de pesquisas ── */
.research-table thead th { width: 33.33%; }

.col-research {
  padding: 6px 8px;
  width: 33.33%;
  vertical-align: middle;
}

.research-unit-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Ícone ── */
.icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 60px;
  height: 60px;
}
.unit-icon          { width: 60px; height: 60px; object-fit: contain; display: block; }
.unit-icon--color   { filter: none; }
.unit-icon--grey    { filter: grayscale(1) opacity(0.5); }

.icon-x { position: absolute; inset: 0; pointer-events: none; }
.icon-x::before,
.icon-x::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 10%;
  width: 80%;
  height: 4px;
  background: #cc1111;
  border-radius: 2px;
  transform-origin: center;
}
.icon-x::before { transform: translateY(-50%) rotate(45deg); }
.icon-x::after  { transform: translateY(-50%) rotate(-45deg); }

/* ── Texto ── */
.research-unit-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.research-unit-name        { font-weight: bold; font-size: 12px; color: #3b2200; }
.research-status--done     { font-size: 11px; color: #555; font-style: italic; }
.research-status--progress { font-size: 11px; color: #8b4513; font-style: italic; }
.research-status--req      { font-size: 10px; color: #7a6040; }
.research-req              { display: block; font-size: 10px; padding-left: 2px; }
.req-unmet                 { color: #9a4020; }
.req-met                   { color: #4a7c2f; }

.research-cost {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #5a3a00;
  flex-wrap: wrap;
}
.research-cost .icon { margin-right: 1px; }

/* ── Botão Pesquisar ── */
.research-btn {
  display: inline-block;
  margin: 2px 0 0 0;
  text-align: center;
  font-family: Verdana, Arial;
  font-size: 11px !important;
  font-weight: bold;
  line-height: normal;
  cursor: pointer;
  border-radius: 5px;
  border: 1px solid #000;
  color: #fff;
  white-space: nowrap;
  width: fit-content;
  padding: 3px 8px 3px 25px;
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px -146px,
    linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.research-btn:hover:not(:disabled) {
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px -146px,
    linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.research-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Botão Cancelar ── */
.cancel-btn {
  display: inline-block;
  margin: 0 2px;
  text-align: center;
  font-family: Verdana, Arial;
  font-size: 12px !important;
  font-weight: bold;
  line-height: normal;
  cursor: pointer;
  border-radius: 5px;
  border: 1px solid #000;
  color: #fff;
  white-space: nowrap;
  padding: 3px 9px 3px 25px;
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px -174px,
    linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.cancel-btn:hover {
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px -174px,
    linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
}
</style>