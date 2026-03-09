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
        <div class="queue-next">
          Conclusão da próxima unidade ({{ UNIT_CONFIGS[trainQueue[0].unitKey]?.name }}):
          <strong>{{ formatTimeLeft(nextUnitEndsAt) }}</strong>
        </div>

        <table class="buildings-table">
          <thead>
            <tr>
              <th>Treinamento</th>
              <th>Duração</th>
              <th>Conclusão</th>
              <th>Cancelar *</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in trainQueue" :key="job.unitKey + job.endsAt" class="building-row">
              <td class="col-building">
                <img :src="`/units/${UNIT_CONFIGS[job.unitKey]?.img}`" class="building-thumb" alt="" />
                <div class="building-info">
                  <span class="building-link">{{ job.count }} {{ UNIT_CONFIGS[job.unitKey]?.name }}{{ job.count > 1 ? 's' : '' }}</span>
                  <span class="building-cur-level">Em treinamento</span>
                </div>
              </td>
              <td class="col-dur">{{ formatDuration(job) }}</td>
              <td class="col-end">{{ formatConclusion(job.endsAt) }}</td>
              <td class="col-cancel">
                <button class="cancel-btn" @click="cancelTrain(job)">Cancelar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="queue-refund-note">*(90% dos recursos serão devolvidos ao seu armazém)</p>
      </template>

      <!-- ── Aba Recrutamento ── -->
      <template v-if="tab === 'recruit'">

        <!-- Grid de 4 tabelas independentes, alinhadas por linha -->
        <div class="recruit-grid" v-if="availableUnits.length">

          <!-- Coluna 1: Unidade -->
          <table class="buildings-table col-table col-table--unit">
            <thead><tr><th>Unidade</th></tr></thead>
            <tbody>
              <tr v-for="u in availableUnits" :key="u.key" class="building-row">
                <td class="col-building">
                  <img :src="`/units/${u.cfg.img}`" class="building-thumb" :alt="u.cfg.name" />
                  <span class="building-link">{{ u.cfg.name }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Coluna 2: Requerimentos -->
          <table class="buildings-table col-table col-table--reqs">
            <thead><tr><th>Requerimentos</th></tr></thead>
            <tbody>
              <tr v-for="u in availableUnits" :key="u.key" class="building-row">
                <td class="col-reqs-cell">
                  <span class="res-pair">
                    <i class="icon" :style="iconStyle('madeira')"></i>
                    <span :class="{ 'res-lacking': !canAfford(u.cfg.wood * (recruitAmounts[u.key] || 1), 'wood') }">{{ u.cfg.wood * (recruitAmounts[u.key] || 1) }}</span>
                  </span>
                  <span class="res-pair">
                    <i class="icon" :style="iconStyle('argila')"></i>
                    <span :class="{ 'res-lacking': !canAfford(u.cfg.stone * (recruitAmounts[u.key] || 1), 'stone') }">{{ u.cfg.stone * (recruitAmounts[u.key] || 1) }}</span>
                  </span>
                  <span class="res-pair">
                    <i class="icon" :style="iconStyle('ferro')"></i>
                    <span :class="{ 'res-lacking': !canAfford(u.cfg.iron * (recruitAmounts[u.key] || 1), 'iron') }">{{ u.cfg.iron * (recruitAmounts[u.key] || 1) }}</span>
                  </span>
                  <span class="res-pair">
                    <i class="icon" :style="iconStyle('populacao')"></i>
                    <span>{{ u.cfg.pop }}</span>
                  </span>
                  <span class="res-pair res-pair--time">
                    <i class="icon" :style="iconStyle('relogio')"></i>
                    <span class="train-time">{{ formatTrainTime(getTrainTime(u.key, barracksLevel) * (recruitAmounts[u.key] || 1)) }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Coluna 3: Na aldeia/total -->
          <table class="buildings-table col-table col-table--count">
            <thead><tr><th>Na aldeia/total</th></tr></thead>
            <tbody>
              <tr v-for="u in availableUnits" :key="u.key" class="building-row">
                <td class="col-count">
                  {{ units[u.key] ?? 0 }}/{{ units[u.key] ?? 0 }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Coluna 4: Recrutar -->
          <table class="buildings-table col-table col-table--recruit">
            <thead><tr><th>Recrutar</th></tr></thead>
            <tbody>
              <tr v-for="u in availableUnits" :key="u.key" class="building-row">
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

        </div>

        <!-- Botão recrutar -->
        <div class="recruit-row" v-if="availableUnits.length">
          <button class="recruit-btn" @click="recruitAll">
            <i class="icon" :style="iconStyle('atacar')"></i>
            Recrutar
          </button>
        </div>

        <!-- Grid de tabelas bloqueadas -->
        <div class="recruit-grid recruit-grid--locked" v-if="lockedUnits.length">

          <!-- Coluna 1: Ainda não disponível -->
          <table class="buildings-table buildings-table--locked col-table col-table--unit">
            <thead><tr><th>Ainda não disponível</th></tr></thead>
            <tbody>
              <tr v-for="u in lockedUnits" :key="u.key" class="building-row building-row--locked">
                <td class="col-building">
                  <img :src="`/units/${u.cfg.img}`" class="building-thumb building-thumb--locked" :alt="u.cfg.name" />
                  <span class="building-link--locked">{{ u.cfg.name }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Coluna 2: Requerimentos bloqueados -->
          <table class="buildings-table buildings-table--locked col-table col-table--reqs">
            <thead><tr><th>Requerimentos</th></tr></thead>
            <tbody>
              <tr v-for="u in lockedUnits" :key="u.key" class="building-row building-row--locked">
                <td class="col-reqs-cell">
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

        </div>

      </template>

      <!-- ── Aba Dispensar (placeholder) ── -->
      <template v-if="tab === 'dismiss'">
        <div class="dismiss-placeholder">
          <p>Função de dispensar tropas em breve.</p>
        </div>
      </template>

      <!-- ── Erro ── -->
      <div v-if="errorMsg" class="build-error">{{ errorMsg }}</div>

    </div>
  </GameLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'
import { BUILDING_CONFIGS, formatBuildTime } from '../../../shared/buildings.js'
import { UNIT_CONFIGS, getTrainTime, formatTrainTime } from '../../../shared/units.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const { iconStyle } = useIcons()

const village       = computed(() => villageStore.village)
const barracksLevel = computed(() => village.value?.buildings.barracks ?? 1)

// ── Estado local ──────────────────────────────────────────────────────────
const tab            = ref('recruit')
const units          = ref({})
const buildings      = ref({})
const trainQueue     = ref([])
const errorMsg       = ref('')
const recruitAmounts = reactive({})

for (const key of Object.keys(UNIT_CONFIGS)) {
  recruitAmounts[key] = 0
}

// ── Recursos ──────────────────────────────────────────────────────────────
const wood  = computed(() => Math.floor(village.value?.resources.wood.current  ?? 0))
const stone = computed(() => Math.floor(village.value?.resources.stone.current ?? 0))
const iron  = computed(() => Math.floor(village.value?.resources.iron.current  ?? 0))

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

// ── Máximo recrutável ─────────────────────────────────────────────────────
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
    if (recruitAmounts[u.key] > 0) await recruit(u.key)
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────
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

// ── Timers ────────────────────────────────────────────────────────────────
function formatTimeLeft(endsAt) {
  return formatBuildTime(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)))
}

const nextUnitEndsAt = computed(() => {
  if (!trainQueue.value.length) return 0
  const job = trainQueue.value[0]
  const timePerUnit = getTrainTime(job.unitKey, barracksLevel.value)
  return job.endsAt - (timePerUnit * job.count - timePerUnit)
})

function formatDuration(job) {
  return formatBuildTime(getTrainTime(job.unitKey, barracksLevel.value) * job.count)
}

function formatConclusion(endsAt) {
  const d   = new Date(endsAt)
  const now = new Date()
  const time = d.toLocaleTimeString('pt-BR')
  if (d.toDateString() === now.toDateString()) return `hoje às ${time}`
  if (d.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return `amanhã às ${time}`
  return d.toLocaleDateString('pt-BR') + ' às ' + time
}

// ── Cancelar ──────────────────────────────────────────────────────────────
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

let tickInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchBarracks()
  tickInterval = setInterval(() => {
    villageStore.updateResources()
    if (trainQueue.value.some(j => j.endsAt <= Date.now())) fetchBarracks()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
.barracks-view {
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
.main-header-img    { width: 120px; height: 120px; object-fit: contain; flex-shrink: 0; }
.main-header-info   { flex: 1; }
.main-title         { font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #000; }
.main-desc          { font-size: 12px; color: #000; margin: 0; line-height: 1.5; }
.main-help          { font-size: 11px; color: #8b4513; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.main-help:hover    { text-decoration: underline; }

/* ── Abas ── */
.tabs-row {
  display: flex;
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
.tab-btn--active             { background: #c8a460; color: #3b2200; }
.tab-btn--dim                { color: #9a8060; }
.tab-btn:hover:not(.tab-btn--active) { background: #d8c880; }

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
.queue-refund-note {
  font-size: 10px;
  color: #7a6040;
  font-style: italic;
  margin: 0;
}

/* ── Tabela base ── */
.buildings-table {
  border-collapse: separate;
  border-spacing: 1px;
  font-size: 11px;
  background: #ecd8aa;
}
/* tabela da fila de treino ocupa largura total */
.buildings-table:not(.col-table) {
  width: 100%;
}
.buildings-table thead th {
  font-size: 9pt;
  text-align: left;
  font-weight: 700;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  padding: 4px 8px;
  white-space: nowrap;
  color: #000;
}
.buildings-table--locked thead th {
  background-color: #b0a080;
  background-image: url('/tableheader_bg3.webp');
}
.building-row td         { background: #f4e4bc; vertical-align: middle; }
.building-row--locked td { background: #f4e4bc; vertical-align: middle; }

/* ── Grid: 4 tabelas lado a lado, linhas alinhadas por altura ── */
.recruit-grid {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
}

/* Cada tabela-coluna não tem largura própria — o flex determina */
.col-table { flex-shrink: 0; }

/* Unidade cresce para preencher o restante */
.col-table--unit    { flex: 1 1 auto; min-width: 140px; }
/* Requerimentos cresce bastante */
.col-table--reqs { flex: 0 0 450px; width: fit-content; }
/* Na aldeia/total — só o conteúdo */
.col-table--count   { flex: 0 0 auto; }
/* Recrutar — só o conteúdo */
.col-table--recruit { flex: 0 0 120px; width: fit-content; table-layout: fixed; }
/* Reqs locked — cresce para o restante */
.col-table--reqs-locked { flex: 1 1 auto; }
.col-table--reqs table { table-layout: fixed; }

/* Todas as tr das col-tables têm altura igual entre si via display:table padrão */
.col-table .building-row td { height: 44px; }

/* ── Células da fila de treino ── */
.col-building {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 4px;
  white-space: nowrap;
}
.building-thumb          { width: 35px; height: 35px; object-fit: contain; display: block; flex-shrink: 0; }
.building-thumb--locked  { filter: grayscale(1) opacity(0.5); }
.building-info           { display: flex; flex-direction: column; gap: 1px; }
.building-link           { font-weight: bold; color: #8b4513; font-size: 11px; }
.building-link--locked   { font-weight: bold; color: #9a8060; font-size: 11px; }
.building-cur-level      { color: #7a6040; font-size: 10px; }
.col-dur, .col-end       { padding: 4px 8px; white-space: nowrap; }
.col-cancel              { padding: 4px 8px; }

/* ── Célula de requerimentos ── */
.col-reqs-cell {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  padding: 4px 8px;
  white-space: nowrap;
  width: 100%;
}

/* Cada par ícone+número tem largura mínima fixa — absorve de 2 a 5 dígitos sem deformar */
.res-pair {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}
/* Tempo no formato H:MM:SS precisa de mais espaço */
.res-pair--time {
}

.res-lacking { color: #cc0000; font-weight: bold; }
.train-time  { color: #5a3a00; }

/* ── Célula Na aldeia/total ── */
.col-count {
  padding: 4px 14px;
  text-align: center;
  white-space: nowrap;
}

/* ── Célula Recrutar ── */
.col-recruit {
  padding: 4px 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.recruit-input {
  width: 60px;
  flex-shrink: auto;
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 2px 4px;
  font-size: 11px;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
  text-align: center;
}
.recruit-max       { color: #8b4513; font-size: 10px; cursor: pointer; text-decoration: underline; }
.recruit-max:hover { color: #5a1010; }

/* ── Botão Recrutar ── */
.recruit-row { display: flex; justify-content: flex-end; }
.recruit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: Verdana, Arial;
  font-size: 12px !important;
  font-weight: bold;
  cursor: pointer;
  border-radius: 5px;
  border: 1px solid #000;
  color: #fff;
  white-space: nowrap;
  padding: 3px 9px;
  background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.recruit-btn:hover {
  background: linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}

/* ── Botão Cancelar ── */
.cancel-btn {
  display: inline-block;
  font-family: Verdana, Arial;
  font-size: 12px !important;
  font-weight: bold;
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

/* ── Requerimentos bloqueados ── */
.req-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 10px;
  font-size: 11px;
}
.req-thumb { width: 20px; height: 20px; object-fit: contain; filter: grayscale(1) opacity(0.6); }
.req-met   { color: #4a7c2f; }
.req-unmet { color: #9a4020; }

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
</style>
