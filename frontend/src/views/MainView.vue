<template>
  <GameLayout>
    <div class="main-view">

      <!-- ── Cabeçalho ── -->
      <div class="main-header">
        <img :src="headerImg" class="main-header-img" alt="Sede" />
        <div class="main-header-info">
          <h2 class="main-title">Edifício principal (Nível {{ level }})</h2>
          <p class="main-desc">
            Você pode construir ou melhorar edifícios no edifício principal.
            Quanto maior o nível, mais rápida será a construção de edifícios.
            Você poderá demolir edifícios nesta aldeia quando o nível do edifício
            principal for igual ou superior a 15 (requer lealdade em 100%).
          </p>
        </div>
        <a class="main-help" href="#">Ajuda - Edifícios</a>
      </div>

      <!-- ── Fila de construção ── -->
      <table v-if="buildQueue.length" class="buildings-table queue-table">
        <thead>
          <tr>
            <th colspan="2">Construção</th>
            <th>Duração</th>
            <th>Conclusão</th>
            <th>Cancelamento</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="job in buildQueue" :key="job.buildingKey">
            <!-- Linha principal -->
            <tr class="building-row queue-row">
              <td class="col-thumb">
                <img :src="getBuildingThumb(job.buildingKey)" class="building-thumb" alt="" />
              </td>
              <td class="col-name">
                <a href="#" class="building-link" @click.prevent="goToBuilding(job.buildingKey)">
                  {{ BUILDING_CONFIGS[job.buildingKey]?.name }}
                </a>
                <span class="building-cur-level">Nível {{ job.targetLevel }}</span>
              </td>
              <td class="col-queue-duration">{{ formatTimeLeft(job.endsAt) }}</td>
              <td class="col-queue-conclusion">hoje às {{ formatEndTime(job.endsAt) }}</td>
              <td class="col-queue-cancel">
                <button class="cancel-btn" @click="cancelBuild(job.buildingKey)">Cancelar</button>
              </td>
            </tr>
            <!-- Linha da barra de progresso: ocupa toda a largura -->
            <tr class="queue-progress-row">
              <td colspan="5" class="queue-progress-cell">
                <div class="queue-progress-bar">
                  <div class="queue-progress-fill" :style="{ width: getProgress(job) + '%' }"></div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- ── Tabela de edifícios disponíveis ── -->
      <table class="buildings-table" v-if="availableBuildings.length">
        <thead>
          <tr>
            <th colspan="2">Edifícios</th>
            <th colspan="5">Requerimentos</th>
            <th>Construir</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in availableBuildings" :key="b.key" class="building-row">
            <!-- Ícone -->
            <td class="col-thumb">
              <img :src="getBuildingThumb(b.key)" class="building-thumb" alt="" />
            </td>

            <!-- Nome + Nível -->
            <td class="col-name">
              <a href="#" class="building-link" @click.prevent="goToBuilding(b.key)">
                {{ b.config.name }}
              </a>
              <span class="building-cur-level">Nível {{ b.currentLevel }}</span>
            </td>

            <!-- Edifício totalmente construído -->
            <template v-if="b.maxReached">
              <td colspan="7" class="col-res" style="text-align:center;">
                <span class="build-max">Edifício totalmente construído</span>
              </td>
            </template>

            <!-- Em construção -->
            <template v-else-if="b.inQueue">
              <td colspan="7" class="col-res" style="text-align:center;">
                <span class="build-queued">Em construção...</span>
              </td>
            </template>

            <!-- Dados normais: cada info na sua célula -->
            <template v-else-if="b.info">
              <td class="col-res">
                <i class="icon" :style="iconStyle('madeira')"></i>
                <span :class="{ 'res-lacking': !canAfford(b.info.cost.wood, 'wood') }">
                  {{ b.info.cost.wood }}
                </span>
              </td>

              <td class="col-res">
                <i class="icon" :style="iconStyle('argila')"></i>
                <span :class="{ 'res-lacking': !canAfford(b.info.cost.stone, 'stone') }">
                  {{ b.info.cost.stone }}
                </span>
              </td>

              <td class="col-res">
                <i class="icon" :style="iconStyle('ferro')"></i>
                <span :class="{ 'res-lacking': !canAfford(b.info.cost.iron, 'iron') }">
                  {{ b.info.cost.iron }}
                </span>
              </td>

              <td class="col-time">
                <span class="time-val">{{ formatBuildTime(b.info.time) }}</span>
              </td>

              <td class="col-pop">
                <span class="pop-val">
                  <i class="icon" :style="iconStyle('populacao')"></i>
                  {{ b.info.cost.pop }}
                </span>
              </td>

              <td class="col-build">
                <button
                  class="build-btn"
                  :class="{ 'build-btn--active': canBuild(b) }"
                  :disabled="!canBuild(b) || villageStore.isBuildQueueFull"
                  @click="startBuild(b.key)"
                >
                  Nível {{ b.info.nextLevel }}
                </button>
              </td>

              <td class="col-discount">
                <button class="discount-btn">↙ -20%</button>
              </td>
            </template>

            <!-- Fallback sem info -->
            <template v-else>
              <td colspan="7"></td>
            </template>
          </tr>
        </tbody>
      </table>

      <!-- ── Edifícios ainda não disponíveis ── -->
      <table class="buildings-table buildings-table--locked" v-if="lockedBuildings.length">
        <thead>
          <tr>
            <th colspan="2">Ainda não disponível</th>
            <th colspan="4">Requerimentos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in lockedBuildings" :key="b.key" class="building-row building-row--locked">
            <td class="col-thumb">
              <img :src="getBuildingThumb(b.key)" class="building-thumb building-thumb--locked" alt="" />
            </td>
            <td class="col-name">
              <span class="building-link--locked">{{ b.config.name }}</span>
            </td>
            <td class="col-reqs" colspan="4">
              <span
                v-for="(reqLevel, reqKey) in b.config.requires"
                :key="reqKey"
                class="req-item"
                :class="{ 'req-met': (village.buildings[reqKey] ?? 0) >= reqLevel, 'req-unmet': (village.buildings[reqKey] ?? 0) < reqLevel }"
              >
                {{ BUILDING_CONFIGS[reqKey]?.name }} ({{ reqLevel }})
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ── Mudar nome da aldeia ── -->
      <div class="rename-section">
        <label class="rename-label">Mudar nome da aldeia:</label>
        <div class="rename-row">
          <input
            v-model="newName"
            type="text"
            class="rename-input"
            maxlength="30"
            @keyup.enter="saveName"
          />
          <button class="rename-btn" @click="saveName">Alterar</button>
        </div>
        <span v-if="renameMsg" class="rename-msg">{{ renameMsg }}</span>
      </div>

      <!-- ── Erro de construção ── -->
      <div v-if="buildError" class="build-error">{{ buildError }}</div>

    </div>
  </GameLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'
import { BUILDING_CONFIGS, formatBuildTime } from '../../../shared/buildings.js'

const router       = useRouter()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const { iconStyle } = useIcons()

const village    = computed(() => villageStore.village)
const level      = computed(() => village.value?.buildings.main ?? 1)
const buildQueue = computed(() => village.value?.buildQueue ?? [])

// ── Tick reativo para forçar re-render da barra a cada segundo ────────────
const now = ref(Date.now())

// ── Imagem do header baseada no tier do nível atual ───────────────────────
const headerImg = computed(() => {
  const l = level.value
  const tier = l <= 5 ? 1 : l <= 15 ? 2 : 3
  return `/buildings/icons/main${tier}.webp`
})

// ── Thumb de cada edifício na tabela ─────────────────────────────────────
function getBuildingThumb(key) {
  return `/buildings/icons/${key}1.webp`
}

function goToBuilding(key) {
  router.push(`/game?village=${village.value.id}&screen=${key}`)
}

// ── Recursos atuais ───────────────────────────────────────────────────────
const wood  = computed(() => Math.floor(village.value?.resources.wood.current  ?? 0))
const stone = computed(() => Math.floor(village.value?.resources.stone.current ?? 0))
const iron  = computed(() => Math.floor(village.value?.resources.iron.current  ?? 0))

function canAfford(cost, res) {
  if (res === 'wood')  return wood.value  >= cost
  if (res === 'stone') return stone.value >= cost
  if (res === 'iron')  return iron.value  >= cost
  return true
}

function canBuild(b) {
  if (!b.info) return false
  if (villageStore.isBuildQueueFull) return false
  const { wood: w, stone: s, iron: i } = b.info.cost
  return canAfford(w, 'wood') && canAfford(s, 'stone') && canAfford(i, 'iron')
}

// ── Progresso da barra (usa now reativo) ──────────────────────────────────
function getProgress(job) {
  const total   = job.endsAt - job.startedAt
  const elapsed = now.value - job.startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

// ── Hora de conclusão formatada ───────────────────────────────────────────
function formatEndTime(endsAt) {
  const d = new Date(endsAt)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ── Classificação dos edifícios ───────────────────────────────────────────
const HIDDEN_FROM_MAIN = ['wall']

const availableBuildings = computed(() => {
  const buildings = village.value?.buildings ?? {}
  const queue     = buildQueue.value

  return Object.entries(BUILDING_CONFIGS)
    .filter(([key]) => !HIDDEN_FROM_MAIN.includes(key))
    .filter(([key, cfg]) => {
      return Object.entries(cfg.requires ?? {}).every(
        ([reqKey, reqLevel]) => (buildings[reqKey] ?? 0) >= reqLevel
      )
    })
    .map(([key, cfg]) => {
      const currentLevel = buildings[key] ?? 0
      const info         = villageStore.getBuildInfo(key)
      const maxReached   = currentLevel >= cfg.maxLevel
      const inQueue      = queue.some(j => j.buildingKey === key)
      return { key, config: cfg, currentLevel, info, maxReached, inQueue }
    })
})

const lockedBuildings = computed(() => {
  const buildings = village.value?.buildings ?? {}

  return Object.entries(BUILDING_CONFIGS)
    .filter(([key]) => !HIDDEN_FROM_MAIN.includes(key))
    .filter(([, cfg]) => {
      const reqs = cfg.requires ?? {}
      if (Object.keys(reqs).length === 0) return false
      return Object.entries(reqs).some(
        ([reqKey, reqLevel]) => (buildings[reqKey] ?? 0) < reqLevel
      )
    })
    .map(([key, cfg]) => ({ key, config: cfg }))
})

// ── Construção ────────────────────────────────────────────────────────────
const buildError = ref('')

async function startBuild(key) {
  buildError.value = ''
  const err = await villageStore.startBuild(key)
  if (err) buildError.value = err
}

async function cancelBuild(key) {
  buildError.value = ''
  const err = await villageStore.cancelBuild(key)
  if (err) buildError.value = err
}

// ── Timer da fila ─────────────────────────────────────────────────────────
function formatTimeLeft(endsAt) {
  const diff = Math.max(0, Math.floor((endsAt - now.value) / 1000))
  return formatBuildTime(diff)
}

// ── Rename ────────────────────────────────────────────────────────────────
const newName   = ref('')
const renameMsg = ref('')

function saveName() {
  if (!newName.value.trim() || newName.value.trim().length < 2) {
    renameMsg.value = 'Nome deve ter pelo menos 2 caracteres.'
    return
  }
  villageStore.renameVillage(newName.value)
  renameMsg.value = 'Nome alterado com sucesso!'
  setTimeout(() => { renameMsg.value = '' }, 2000)
}

// ── Tick ──────────────────────────────────────────────────────────────────
let tickInterval = null

onMounted(() => {
  if (authStore.user) villageStore.init()
  newName.value = village.value?.name ?? ''
  tickInterval = setInterval(() => {
    now.value = Date.now()
    villageStore.processBuildQueue()
    villageStore.updateResources()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
.main-view {
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

/* ── Tabela base ── */
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
  background-image: url('/assets/tableheader_bg3.webp');
  background-repeat: repeat-x;
  position: relative;
  padding: 4px 6px;
  white-space: nowrap;
  color: #3b2200;
}
.buildings-table--locked thead th {
  background-color: #b0a080;
  background-image: url('/assets/tableheader_bg3.webp');
}
.building-row td {
  background: #fff8e8;
  vertical-align: middle;
}
.building-row:nth-child(even) td { background: #faf0d0; }
.building-row:nth-child(odd)  td { background: #fff8e8; }
.building-row--locked:nth-child(even) td { background: #eee8d0; }
.building-row--locked:nth-child(odd)  td { background: #f5f0e0; }

/* ── Fila de construção ── */
.queue-row td {
  vertical-align: middle;
  padding: 4px 6px;
}

.col-queue-duration {
  white-space: nowrap;
  font-weight: bold;
  color: #3b2200;
}
.col-queue-conclusion {
  white-space: nowrap;
  color: #3b2200;
}
.col-queue-cancel {
  white-space: nowrap;
  text-align: center;
}

/* Linha da barra de progresso */
.queue-progress-row td {
  padding: 0 !important;
  background: #fff8e8;
}
.building-row:nth-child(4n+1) ~ .queue-progress-row td { background: #fff8e8; }
.building-row:nth-child(4n+3) ~ .queue-progress-row td { background: #faf0d0; }

.queue-progress-cell {
  padding: 0 !important;
  height: 5px;
}
.queue-progress-bar {
  width: 100%;
  height: 5px;
  background: #c8a878;
  overflow: hidden;
}
.queue-progress-fill {
  height: 100%;
  background: linear-gradient(to bottom, #6abf40, #4a8c20);
  transition: width 0.9s linear;
}

/* ── Células comuns ── */
.col-thumb { width: 36px; padding: 3px 4px; }
.building-thumb {
  width: 35px;
  height: 35px;
  object-fit: contain;
  display: block;
}
.building-thumb--locked { filter: grayscale(1) opacity(0.5); }

.col-name { padding: 3px 8px; min-width: 130px; }
.building-link {
  display: block;
  font-weight: bold;
  color: #8b4513;
  text-decoration: none;
  font-size: 11px;
}
.building-link:hover { text-decoration: underline; }
.building-link--locked {
  display: block;
  font-weight: bold;
  color: #9a8060;
  font-size: 11px;
}
.building-cur-level {
  display: block;
  color: #7a6040;
  font-size: 10px;
}

.col-res {
  padding: 3px 6px;
  white-space: nowrap;
  text-align: right;
}
.col-res .icon { margin-right: 2px; }
.res-lacking { color: #cc0000; font-weight: bold; }

.col-time { padding: 3px 8px; white-space: nowrap; }
.col-pop  { padding: 3px 6px; white-space: nowrap; text-align: center; }
.time-val { color: #3b2200; }
.pop-val  { display: flex; align-items: center; gap: 2px; color: #5a3a00; }

.col-build    { padding: 3px 6px; text-align: center; min-width: 160px; }
.col-discount { padding: 3px 4px; }

/* ── Botão construir ── */
.build-btn {
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
  text-decoration: none;
  min-width: 90px;
  padding: 3px 9px 3px 25px;
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px 1px,
    linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.build-btn:hover {
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px 1px,
    linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.build-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.build-btn--active {
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px 1px,
    linear-gradient(to bottom, #6a9a4a 0%, #4e7c2e 22%, #6c4824 30%, ##6c4824 100%);
  border-color: #947a62;
}
.build-btn--active:hover {
  background:
    url('https://dsbr.innogamescdn.com/asset/7be0fdc5/graphic/btn/buttons.webp') no-repeat 3px 1px,
    linear-gradient(to bottom, #947a62 0%, #947a62 22%, #947a62 30%, #947a62 100%);
}

.build-max   { color: #7a6040; font-style: italic; font-size: 11px; }
.build-queued { color: #8b4513; font-size: 11px; }

/* ── Botão cancelar ── */
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
  text-decoration: none;
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

.discount-btn {
  background: #8b6535;
  border: 1px solid #5a3a00;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 3px 8px;
  cursor: not-allowed;
  opacity: 0.7;
  white-space: nowrap;
}

/* ── Requerimentos bloqueados ── */
.col-reqs { padding: 3px 8px; }
.req-item {
  display: inline-block;
  margin-right: 10px;
  font-size: 11px;
  padding: 1px 4px;
}
.req-met   { color: #4a7c2f; }
.req-unmet { color: #9a8060; }

/* ── Rename ── */
.rename-section { border-top: 1px solid #c8a878; padding-top: 10px; }
.rename-label   { display: block; font-weight: bold; margin-bottom: 4px; font-size: 12px; }
.rename-row     { display: flex; gap: 6px; align-items: center; }
.rename-input {
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 3px 6px;
  font-size: 12px;
  color: #3b2200;
  width: 200px;
  font-family: Verdana, Arial, sans-serif;
}
.rename-btn {
  background: #c8a460;
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 11px;
  font-weight: bold;
  padding: 3px 10px;
  cursor: pointer;
  font-family: Verdana, Arial, sans-serif;
}
.rename-btn:hover { background: #b8944a; }
.rename-msg { display: block; margin-top: 4px; font-size: 11px; color: #4a7c2f; }

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
}
</style>
