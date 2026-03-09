<template>
  <GameLayout>
    <div class="barracks-view">

      <!-- ── Cabeçalho ── -->
      <div class="main-header">
        <img src="/buildings/icons/barracks1.webp" class="main-header-img" alt="Quartel" />
        <div class="main-header-info">
          <h2 class="main-title">Quartel (Nível {{ barracksLevel }})</h2>
          <p class="main-desc">
            No Quartel você pode recrutar sua infantaria.
            Quanto maior o seu nível, mais rapidamente poderão ser recrutadas novas tropas.
          </p>
        </div>
        <a class="main-help" href="#">Ajuda - Edifícios</a>
      </div>

      <!-- ── Abas ── -->
      <div class="tabs-row">
        <button class="tab-btn" :class="{ 'tab-btn--active': tab === 'recruit' }" @click="tab = 'recruit'">Recrutamento</button>
        <button class="tab-btn tab-btn--dim" :class="{ 'tab-btn--active': tab === 'dismiss' }" @click="tab = 'dismiss'">Dispensar</button>
      </div>

      <!-- ── Fila de treino ── -->
      <template v-if="trainQueue.length">
        <!-- Conclusão da próxima unidade -->
        <div class="queue-next">
          Conclusão da próxima unidade ({{ UNIT_CONFIGS[trainQueue[0].unitKey]?.name }}):
          <strong>{{ formatTimeLeft(nextUnitEndsAt) }}</strong>
        </div>

        <table class="queue-table">
          <thead>
            <tr>
              <th>Treinamento</th>
              <th>Duração</th>
              <th>Conclusão</th>
              <th>Cancelar *</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in trainQueue" :key="job.unitKey + job.endsAt" class="queue-row">
              <td class="qcol-unit">
                <img :src="`/units/${UNIT_CONFIGS[job.unitKey]?.img}`" class="queue-thumb" alt="" />
                {{ job.count }} {{ UNIT_CONFIGS[job.unitKey]?.name }}{{ job.count > 1 ? 's' : '' }}
              </td>
              <td class="qcol-dur">{{ formatDuration(job) }}</td>
              <td class="qcol-end">{{ formatConclusion(job.endsAt) }}</td>
              <td class="qcol-cancel">
                <button class="cancel-train-btn" @click="cancelTrain(job)">
                  ✕ Cancelar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="queue-refund-note">*(90% dos recursos serão devolvidos ao seu armazém)</p>
      </template>

      <!-- ── Aba Recrutamento ── -->
      <template v-if="tab === 'recruit'">

        <!-- Tabela de unidades disponíveis -->
        <table class="units-table" v-if="availableUnits.length">
          <thead>
            <tr>
              <th colspan="2">Unidade</th>
              <th colspan="4">Requerimentos</th>
              <th>Na aldeia/total</th>
              <th>Recrutar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in availableUnits" :key="u.key" class="unit-row">
              <!-- Ícone -->
              <td class="col-thumb">
                <img :src="`/units/${u.cfg.img}`" class="unit-thumb" :alt="u.cfg.name" />
              </td>
              <!-- Nome -->
              <td class="col-name">
                <span class="unit-name">{{ u.cfg.name }}</span>
              </td>
              <!-- Custos -->
              <td class="col-res">
                <i class="icon" :style="iconStyle('madeira')"></i>
                <span :class="{ 'res-lacking': !canAfford(u.cfg.wood * (recruitAmounts[u.key] || 1), 'wood') }">{{ u.cfg.wood * (recruitAmounts[u.key] || 1) }}</span>
              </td>
              <td class="col-res">
                <i class="icon" :style="iconStyle('argila')"></i>
                <span :class="{ 'res-lacking': !canAfford(u.cfg.stone * (recruitAmounts[u.key] || 1), 'stone') }">{{ u.cfg.wood * (recruitAmounts[u.key] || 1) }}</span>
              </td>
              <td class="col-res">
                <i class="icon" :style="iconStyle('ferro')"></i>
                <span :class="{ 'res-lacking': !canAfford(u.cfg.iron  * (recruitAmounts[u.key] || 1), 'iron')  }">{{ u.cfg.wood * (recruitAmounts[u.key] || 1) }}</span>
              </td>
              <!-- Pop + Tempo -->
              <td class="col-time">
                <i class="icon" :style="iconStyle('populacao')"></i>
                <span>{{ u.cfg.pop }}</span>
                <span class="train-time">{{ formatTrainTime(getTrainTime(u.key, barracksLevel) * (recruitAmounts[u.key] || 1)) }}</span>
              </td>
              <!-- Na aldeia / total -->
              <td class="col-count">
                {{ units[u.key] ?? 0 }}/{{ (units[u.key] ?? 0) }}
              </td>
              <!-- Input recrutar -->
              <td class="col-recruit">
                <input
                  v-model.number="recruitAmounts[u.key]"
                  type="number"
                  min="0"
                  class="recruit-input"
                  @keyup.enter="recruit(u.key)"
                />
                <span
                  class="recruit-max"
                  @click="recruitAmounts[u.key] = maxRecruitAmount(u)"
                  title="Clique para preencher com o máximo"
                >({{ maxRecruitAmount(u) }})</span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Botão recrutar -->
        <div class="recruit-row" v-if="availableUnits.length">
          <button class="recruit-btn" @click="recruitAll">
            <i class="icon" :style="iconStyle('tropa')"></i>
            Recrutar
          </button>
        </div>

        <!-- Tabela de unidades indisponíveis -->
        <table class="units-table units-table--locked" v-if="lockedUnits.length">
          <thead>
            <tr>
              <th colspan="2">Ainda não disponível</th>
              <th colspan="4">Requerimentos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in lockedUnits" :key="u.key" class="unit-row unit-row--locked">
              <td class="col-thumb">
                <img :src="`/units/${u.cfg.img}`" class="unit-thumb unit-thumb--locked" :alt="u.cfg.name" />
              </td>
              <td class="col-name">
                <span class="unit-name unit-name--locked">{{ u.cfg.name }}</span>
              </td>
              <td class="col-reqs" colspan="4">
                <span
                  v-for="(reqLevel, reqKey) in u.cfg.requires"
                  :key="reqKey"
                  class="req-item"
                  :class="{ 'req-met': (buildings[reqKey] ?? 0) >= reqLevel, 'req-unmet': (buildings[reqKey] ?? 0) < reqLevel }"
                >
                  <img :src="`/buildings/${reqKey}1.webp`" class="req-thumb" alt="" />
                  {{ BUILDING_CONFIGS[reqKey]?.name }} (Nível {{ reqLevel }})
                </span>
              </td>
            </tr>
          </tbody>
        </table>

      </template>

      <!-- ── Aba Dispensar (placeholder) ── -->
      <template v-if="tab === 'dismiss'">
        <div class="dismiss-placeholder">
          <p>Função de dispensar tropas em breve.</p>
        </div>
      </template>

      <!-- ── Erro ── -->
      <div v-if="errorMsg" class="build-error">{{ errorMsg }}</div>

      <!-- ── Hora do servidor ── -->
      <div class="server-time-row">Hora do servidor: {{ serverTime }}</div>

    </div>
  </GameLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'
import { BUILDING_CONFIGS, formatBuildTime } from '../../../shared/buildings.js'
import { UNIT_CONFIGS, getTrainTime, formatTrainTime } from '../../../shared/units.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route        = useRoute()
const router       = useRouter()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const { iconStyle } = useIcons()

const village       = computed(() => villageStore.village)
const barracksLevel = computed(() => village.value?.buildings.barracks ?? 1)

// ── Estado local ──────────────────────────────────────────────────────────
const tab           = ref('recruit')
const units         = ref({})
const buildings     = ref({})
const trainQueue    = ref([])
const errorMsg      = ref('')
const serverTime    = ref('')
const recruitAmounts = reactive({})

// Inicializar amounts
for (const key of Object.keys(UNIT_CONFIGS)) {
  recruitAmounts[key] = 0
}

// ── Recursos atuais ───────────────────────────────────────────────────────
const wood  = computed(() => Math.floor(village.value?.resources.wood.current  ?? 0))
const stone = computed(() => Math.floor(village.value?.resources.stone.current ?? 0))
const iron  = computed(() => Math.floor(village.value?.resources.iron.current  ?? 0))

// Recursos disponíveis descontando tudo que já está digitado nos inputs
const availableWood = computed(() => {
  const spent = Object.entries(recruitAmounts)
    .reduce((sum, [key, qty]) => sum + (UNIT_CONFIGS[key]?.wood ?? 0) * (qty || 0), 0)
  return Math.max(0, wood.value - spent)
})
const availableStone = computed(() => {
  const spent = Object.entries(recruitAmounts)
    .reduce((sum, [key, qty]) => sum + (UNIT_CONFIGS[key]?.stone ?? 0) * (qty || 0), 0)
  return Math.max(0, stone.value - spent)
})
const availableIron = computed(() => {
  const spent = Object.entries(recruitAmounts)
    .reduce((sum, [key, qty]) => sum + (UNIT_CONFIGS[key]?.iron ?? 0) * (qty || 0), 0)
  return Math.max(0, iron.value - spent)
})

function canAfford(cost, res) {
  if (res === 'wood')  return availableWood.value  >= cost
  if (res === 'stone') return availableStone.value >= cost
  if (res === 'iron')  return availableIron.value  >= cost
  return true
}
// ── Classificação das unidades ────────────────────────────────────────────
const availableUnits = computed(() =>
  Object.entries(UNIT_CONFIGS)
    .filter(([, cfg]) =>
      cfg.building === 'barracks' &&
      cfg.implemented === true &&
      Object.entries(cfg.requires ?? {}).every(
        ([reqKey, reqLevel]) => (buildings.value[reqKey] ?? 0) >= reqLevel
      )
    )
    .map(([key, cfg]) => ({ key, cfg }))
)

const lockedUnits = computed(() =>
  Object.entries(UNIT_CONFIGS)
    .filter(([, cfg]) => {
      const reqs = cfg.requires ?? {}
      return cfg.building === 'barracks' &&
        cfg.implemented === true &&
        Object.keys(reqs).length > 0 &&
        Object.entries(reqs).some(([reqKey, reqLevel]) => (buildings.value[reqKey] ?? 0) < reqLevel)
    })
    .map(([key, cfg]) => ({ key, cfg }))
)

// ── Quantidade máxima recrutável com os recursos atuais ───────────────────
function maxRecruitAmount(u) {
  if (!u.cfg.wood && !u.cfg.stone && !u.cfg.iron) return 0
  const byWood  = u.cfg.wood  > 0 ? Math.floor(availableWood.value  / u.cfg.wood)  : Infinity
  const byStone = u.cfg.stone > 0 ? Math.floor(availableStone.value / u.cfg.stone) : Infinity
  const byIron  = u.cfg.iron  > 0 ? Math.floor(availableIron.value  / u.cfg.iron)  : Infinity
  return Math.min(byWood, byStone, byIron)
}

// ── Recrutamento ──────────────────────────────────────────────────────────
async function recruit(unitKey) {
  const qty = recruitAmounts[unitKey]
  if (!qty || qty < 1) return
  errorMsg.value = ''

  try {
    await axios.post(`${API}/barracks/train`, { unitKey, count: qty }, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    recruitAmounts[unitKey] = 0
    await fetchBarracks()
    await villageStore.fetchVillage()
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao recrutar.'
  }
}

async function recruitAll() {
  errorMsg.value = ''
  for (const u of availableUnits.value) {
    if (recruitAmounts[u.key] > 0) {
      await recruit(u.key)
    }
  }
}

// ── Fetch barracks ────────────────────────────────────────────────────────
async function fetchBarracks() {
  try {
    const { data } = await axios.get(`${API}/barracks`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    units.value      = data.units
    buildings.value  = data.buildings
    trainQueue.value = data.trainQueue
  } catch (e) {
    console.error('Erro ao carregar quartel:', e)
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────
function formatTimeLeft(endsAt) {
  const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
  return formatBuildTime(diff)
}

// Tempo até a PRIMEIRA unidade do primeiro job ficar pronta
const nextUnitEndsAt = computed(() => {
  if (!trainQueue.value.length) return 0
  const job = trainQueue.value[0]
  const timePerUnit = getTrainTime(job.unitKey, barracksLevel.value)
  const totalTime   = timePerUnit * job.count
  return job.endsAt - (totalTime - timePerUnit) // endsAt do job - tempo das unidades restantes + 1
})

// Duração total do job formatada
function formatDuration(job) {
  const timePerUnit = getTrainTime(job.unitKey, barracksLevel.value)
  return formatBuildTime(timePerUnit * job.count)
}

// "hoje às HH:MM:SS" ou "amanhã às HH:MM:SS"
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

// ── Cancelar treino ───────────────────────────────────────────────────────
async function cancelTrain(job) {
  errorMsg.value = ''
  try {
    await axios.post(`${API}/barracks/cancel`, { unitKey: job.unitKey, endsAt: job.endsAt }, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { worldId: villageStore.worldId }
    })
    await fetchBarracks()
    await villageStore.fetchVillage()
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao cancelar recrutamento.'
  }
}

function updateServerTime() {
  const now = new Date()
  serverTime.value = now.toLocaleTimeString('pt-BR') + ' ' + now.toLocaleDateString('pt-BR')
}

let tickInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchBarracks()
  updateServerTime()
  tickInterval = setInterval(() => {
    villageStore.updateResources()
    updateServerTime()
    // Re-fetch quando fila tem itens próximos de terminar
    const now = Date.now()
    if (trainQueue.value.some(j => j.endsAt <= now)) fetchBarracks()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
.barracks-view {
  padding: 0px 16px 20px;
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
  position: relative;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 10px;
}
.main-header-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
  flex-shrink: 0;
}
.main-header-info { flex: 1; }
.main-title {
  font-size: 20px;
  font-weight: bold;
  margin: 0 0 6px 0;
  color: #000;
}
.main-desc {
  font-size: 12px;
  color: #000;
  margin: 0;
  line-height: 1.5;
}
.main-help {
  font-size: 11px;
  color: #8b4513;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.main-help:hover { text-decoration: underline; }

/* ── Abas ── */
.tabs-row {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #c8a460;
}
.tab-btn {
  background: #e8d898;
  border: 1px solid #c8a460;
  border-bottom: none;
  color: #8b4513;
  font-size: 12px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 4px 14px;
  cursor: pointer;
}
.tab-btn--active {
  background: #c8a460;
  color: #3b2200;
}
.tab-btn--dim { color: #9a8060; }
.tab-btn:hover:not(.tab-btn--active) { background: #d8c880; }

/* ── Fila de treino ── */
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
  gap: 6px;
  font-weight: bold;
}
.qcol-dur, .qcol-end { padding: 4px 8px; }
.qcol-cancel { padding: 4px 8px; }
.queue-thumb {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
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

/* ── Tabela de unidades ── */
.units-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.units-table thead tr {
  background: #c8a460;
  color: #3b2200;
  font-weight: bold;
}
.units-table thead th {
  padding: 4px 6px;
  text-align: left;
  border: 1px solid #8b6535;
  white-space: nowrap;
}
.units-table--locked thead tr { background: #b0a080; }

.unit-row { border-bottom: 1px solid #ddd0a0; }
.unit-row:nth-child(even) { background: #faf0d0; }
.unit-row:nth-child(odd)  { background: #fff8e8; }
.unit-row--locked:nth-child(even) { background: #eee8d0; }
.unit-row--locked:nth-child(odd)  { background: #f5f0e0; }

.col-thumb { width: 36px; padding: 3px 4px; }
.unit-thumb {
  width: 32px;
  height: 32px;
  object-fit: contain;
  display: block;
}
.unit-thumb--locked { filter: grayscale(1) opacity(0.5); }

.col-name { padding: 3px 8px; min-width: 100px; }
.unit-name { font-weight: bold; color: #3b2200; }
.unit-name--locked { color: #9a8060; }

.col-res {
  padding: 3px 6px;
  white-space: nowrap;
  text-align: right;
}
.col-res .icon { margin-right: 2px; }
.res-lacking { color: #cc0000; font-weight: bold; }

.col-time {
  padding: 3px 8px;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}
.col-time > * { display: flex; align-items: center; gap: 3px; }
.train-time { color: #5a3a00; }

.col-count {
  padding: 3px 10px;
  text-align: center;
  white-space: nowrap;
}

.col-recruit {
  padding: 3px 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.recruit-input {
  width: 52px;
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 2px 4px;
  font-size: 11px;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
  text-align: center;
}
.recruit-max {
  color: #8b4513;
  font-size: 10px;
  cursor: pointer;
  text-decoration: underline;
}
.recruit-max:hover { color: #5a1010; }

/* ── Botão recrutar ── */
.recruit-row {
  display: flex;
  justify-content: flex-end;
}
.recruit-btn {
  background: #8b6535;
  border: 1px solid #5a3a00;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 5px 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.recruit-btn:hover { background: #6a4a20; }

/* ── Requerimentos bloqueados ── */
.col-reqs { padding: 4px 8px; }
.req-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
  font-size: 11px;
}
.req-thumb {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: grayscale(1) opacity(0.6);
}
.req-met   { color: #4a7c2f; }
.req-unmet { color: #9a8060; }

/* ── Placeholder dispensar ── */
.dismiss-placeholder {
  background: #f5e8c8;
  border: 1px solid #c8a878;
  padding: 20px;
  color: #7a6040;
  font-style: italic;
}

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
}

/* ── Hora do servidor ── */
.server-time-row {
  font-size: 10px;
  color: #7a6040;
  text-align: right;
  margin-top: 4px;
}
</style>
