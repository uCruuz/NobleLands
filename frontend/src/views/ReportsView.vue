<template>
  <GameLayout>
    <div class="reports-view">

      <div class="main-header">
        <div class="main-header-info">
          <h2 class="main-title">Relatórios</h2>
        </div>
      </div>

      <div class="reports-layout">

        <!-- ── Sidebar ── -->
        <div class="sidebar">
          <div v-for="f in FILTERS" :key="f.key"
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === f.key }"
            @click="activeFilter = f.key"
          >{{ f.label }}</div>
        </div>

        <!-- ── Painel ── -->
        <div class="reports-panel">
          <table class="reports-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input type="checkbox"
                    :checked="allSelected"
                    :indeterminate.prop="someSelected && !allSelected"
                    @change="toggleAll" />
                </th>
                <th class="col-subject">Assunto</th>
                <th class="col-icons"></th>
                <th class="col-date">Recebido em</th>
              </tr>
            </thead>
            <tbody v-if="filteredReports.length">
              <tr v-for="(report, idx) in filteredReports" :key="report.id"
                class="report-row"
                :class="idx % 2 === 0 ? 'report-row--a' : 'report-row--b'"
                @click.self="openReport(report)"
              >
                <td class="col-check">
                  <input type="checkbox" :value="report.id" v-model="selected" />
                </td>
                <td class="col-subject" @click="openReport(report)">
                  <span class="report-dot" :class="`report-dot--${report.result ?? 'neutral'}`"></span>
                  <span class="report-subject-text" :class="{ 'report-subject--unread': !report.read }">
                    {{ report.subject }}
                  </span>
                  <span v-if="!report.read" class="report-new">(novo)</span>
                </td>
                <td class="col-icons"></td>
                <td class="col-date">{{ formatDate(report.createdAt) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr class="report-row report-row--a">
                <td colspan="4" class="col-empty">
                  {{ loading ? 'Carregando...' : 'Nenhum relatório encontrado.' }}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="reports-footer">
            <label class="footer-select-all">
              <input type="checkbox"
                :checked="allSelected"
                :indeterminate.prop="someSelected && !allSelected"
                @change="toggleAll" />
              Selecionar todas
            </label>
            <button class="delete-btn" :disabled="selected.length === 0" @click="deleteSelected">
              <span class="delete-btn-icon">✕</span> Apagar
            </button>
          </div>

          <div v-if="errorMsg" class="build-error">{{ errorMsg }}</div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════
           MODAL estilo Tribal Wars
      ══════════════════════════════════════════════════ -->
      <div v-if="activeReport" class="rm-overlay" @click.self="activeReport = null">
        <div class="rm-modal">

          <!-- Barra superior -->
          <div class="rm-topbar">
            <button class="rm-topbtn">Encaminhar</button>
            <button class="rm-topbtn rm-topbtn--danger" @click="deleteOne(activeReport)">Apagar</button>
          </div>

          <!-- Assunto -->
          <div class="rm-subject-row">
            <span class="report-dot" :class="`report-dot--${activeReport.result ?? 'neutral'}`"></span>
            <span class="rm-subject-text">{{ activeReport.subject }}</span>
          </div>

          <!-- Data -->
          <div class="rm-date-row">
            <span class="rm-date-label">Data da batalha</span>
            <span class="rm-date-value">{{ formatDate(activeReport.createdAt) }}</span>
          </div>

          <!-- Corpo scrollável -->
          <div class="rm-body">

            <!-- Título resultado -->
            <div class="rm-result-title" :class="`rm-result--${activeReport.result ?? 'neutral'}`">
              {{ resultTitle(activeReport) }}
            </div>

            <!-- Bloco Atacante -->
            <template v-if="activeReport.type === 'attack' || activeReport.type === 'defense'">

              <div class="rm-block">
                <div class="rm-block-header rm-block-header--attack">
                  <strong>Atacante:</strong>
                  <span class="rm-block-player">{{ activeReport.data?.attacker?.playerName ?? '—' }}</span>
                </div>
                <div class="rm-block-body">
                  <div class="rm-info-row">
                    <span class="rm-info-label">Origem:</span>
                    <span class="rm-village-link">
                      {{ activeReport.data?.attacker?.villageName ?? '?' }}
                      ({{ activeReport.data?.attacker?.coords?.x ?? '?' }}|{{ activeReport.data?.attacker?.coords?.y ?? '?' }})
                      {{ villageContinent(activeReport.data?.attacker?.coords) }}
                    </span>
                  </div>

                  <!-- Grade de unidades -->
                  <div class="unit-grid">
                    <div class="ug-icons-row">
                      <div v-for="key in UNIT_ORDER" :key="key" class="ug-cell">
                        <img
                          :src="`/units/${UNIT_IMGS[key]}`"
                          :class="['ug-icon', { 'ug-icon--zero': !hasTroop(activeReport.data?.attacker?.troopsSent, key) }]"
                          :title="key"
                        />
                      </div>
                    </div>
                    <div class="ug-label-col">Quantidade:</div>
                    <div class="ug-qty-row">
                      <div v-for="key in UNIT_ORDER" :key="key"
                        :class="['ug-cell', { 'ug-cell--zero': !hasTroop(activeReport.data?.attacker?.troopsSent, key) }]">
                        {{ activeReport.data?.attacker?.troopsSent?.[key] ?? 0 }}
                      </div>
                    </div>
                    <div class="ug-label-col">Perdas:</div>
                    <div class="ug-lost-row">
                      <div v-for="key in UNIT_ORDER" :key="key"
                        :class="['ug-cell', { 'ug-cell--zero': !hasTroop(activeReport.data?.attacker?.troopsLost, key) }]">
                        {{ activeReport.data?.attacker?.troopsLost?.[key] ?? 0 }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bloco Defensor -->
              <div class="rm-block">
                <div class="rm-block-header rm-block-header--defense">
                  <strong>Defensor:</strong>
                  <span class="rm-block-player">{{ activeReport.data?.defender?.playerName ?? '—' }}</span>
                </div>
                <div class="rm-block-body">
                  <div class="rm-info-row">
                    <span class="rm-info-label">Destino:</span>
                    <span class="rm-village-link">
                      {{ activeReport.data?.defender?.villageName ?? '?' }}
                      ({{ activeReport.data?.defender?.coords?.x ?? '?' }}|{{ activeReport.data?.defender?.coords?.y ?? '?' }})
                      {{ villageContinent(activeReport.data?.defender?.coords) }}
                    </span>
                  </div>

                  <div class="unit-grid">
                    <div class="ug-icons-row">
                      <div v-for="key in UNIT_ORDER" :key="key" class="ug-cell">
                        <img
                          :src="`/units/${UNIT_IMGS[key]}`"
                          :class="['ug-icon', { 'ug-icon--zero': !hasTroop(activeReport.data?.defender?.troopsSent, key) }]"
                          :title="key"
                        />
                      </div>
                    </div>
                    <div class="ug-label-col">Quantidade:</div>
                    <div class="ug-qty-row">
                      <div v-for="key in UNIT_ORDER" :key="key"
                        :class="['ug-cell', { 'ug-cell--zero': !hasTroop(activeReport.data?.defender?.troopsSent, key) }]">
                        {{ activeReport.data?.defender?.troopsSent?.[key] ?? 0 }}
                      </div>
                    </div>
                    <div class="ug-label-col">Perdas:</div>
                    <div class="ug-lost-row">
                      <div v-for="key in UNIT_ORDER" :key="key"
                        :class="['ug-cell', { 'ug-cell--zero': !hasTroop(activeReport.data?.defender?.troopsLost, key) }]">
                        {{ activeReport.data?.defender?.troopsLost?.[key] ?? 0 }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Saque -->
              <div v-if="activeReport.data?.loot" class="rm-block">
                <div class="rm-block-header rm-block-header--loot">Saque:</div>
                <div class="rm-block-body rm-loot-body">
                  <span v-for="res in lootResources" :key="res.key" class="rm-loot-item">
                    <span :style="iconStyle(res.icon)" />
                    {{ activeReport.data.loot[res.key] ?? 0 }}
                  </span>
                </div>
              </div>

            </template>

            <!-- Fallback outros tipos -->
            <div v-else class="rm-raw">
              <pre>{{ JSON.stringify(activeReport.data ?? {}, null, 2) }}</pre>
            </div>

          </div><!-- /rm-body -->

          <!-- Rodapé -->
          <div class="rm-footer">
            <span class="rm-footer-link">» Publicar relatório</span>
            <button class="delete-btn" @click="deleteOne(activeReport)">Apagar</button>
          </div>

        </div>
      </div>

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
import { getContinent } from '../composables/useMapCanvas.js'
import { useIcons } from '../composables/useIcons.js'

const { iconStyle } = useIcons()

const lootResources = [
  { key: 'wood',  icon: 'madeira' },
  { key: 'stone', icon: 'argila'  },
  { key: 'iron',  icon: 'ferro'   },
]

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()

// ── Ordem canônica das unidades ───────────────────────────────────────────
const UNIT_ORDER = [
  'spear', 'sword', 'axe', 'archer',
  'scout', 'light', 'marcher', 'heavy',
  'ram', 'catapult', 'knight', 'snob',
]

const UNIT_IMGS = {
  spear:    'unit_spear.webp',
  sword:    'unit_sword.webp',
  axe:      'unit_axe.webp',
  archer:   'unit_archer.webp',
  scout:    'unit_spy.webp',
  light:    'unit_light_cavalry.webp',
  marcher:  'unit_marcher.webp',
  heavy:    'unit_heavy.webp',
  ram:      'unit_ram.webp',
  catapult: 'unit_catapult.webp',
  knight:   'unit_knight.webp',
  snob:     'unit_snob.webp',
}

const FILTERS = [
  { key: 'all',     label: 'Todos'    },
  { key: 'attack',  label: 'Ataques'  },
  { key: 'defense', label: 'Defesas'  },
  { key: 'support', label: 'Suporte'  },
  { key: 'trade',   label: 'Comércio' },
  { key: 'misc',    label: 'Diversos' },
]

const activeFilter = ref('all')
const selected     = ref([])
const activeReport = ref(null)
const errorMsg     = ref('')
const loading      = ref(false)
const reports      = ref([])
let   worldId      = null

function authHeaders() {
  return { Authorization: `Bearer ${authStore.token}` }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function hasTroop(troopsObj, key) {
  return troopsObj && (troopsObj[key] ?? 0) > 0
}

function villageContinent(coords) {
  if (!coords?.x || !coords?.y) return ''
  return getContinent(coords.x, coords.y)
}

function resultTitle(report) {
  const attacker = report.data?.attacker?.playerName ?? 'Atacante'
  if (report.result === 'green')  return `${attacker} venceu`
  if (report.result === 'red')    return `${attacker} foi derrotado`
  if (report.result === 'yellow') return 'Combate indeciso'
  return 'Relatório de visita'
}

// ── Filtro e seleção ──────────────────────────────────────────────────────
const filteredReports = computed(() => {
  if (activeFilter.value === 'all') return reports.value
  return reports.value.filter(r => r.type === activeFilter.value)
})

const allSelected  = computed(() =>
  filteredReports.value.length > 0 &&
  filteredReports.value.every(r => selected.value.includes(r.id))
)
const someSelected = computed(() =>
  filteredReports.value.some(r => selected.value.includes(r.id))
)

function toggleAll() {
  const ids = filteredReports.value.map(r => r.id)
  if (allSelected.value) {
    selected.value = selected.value.filter(id => !ids.includes(id))
  } else {
    selected.value = [...new Set([...selected.value, ...ids])]
  }
}

// ── Abrir / marcar lido ───────────────────────────────────────────────────
async function openReport(report) {
  activeReport.value = report
  if (!report.read) {
    report.read = true
    try {
      await axios.post(
        `${API}/reports/${report.id}/read`, {},
        { headers: authHeaders(), params: { worldId } }
      )
    } catch (e) { console.error('[ReportsView] erro ao marcar lido:', e) }
  }
}

// ── Apagar ────────────────────────────────────────────────────────────────
async function deleteOne(report) {
  try {
    await axios.delete(`${API}/reports`, {
      headers: authHeaders(),
      params:  { worldId },
      data:    { ids: [report.id] },
    })
    reports.value      = reports.value.filter(r => r.id !== report.id)
    activeReport.value = null
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao apagar.'
  }
}

async function deleteSelected() {
  if (!selected.value.length) return
  errorMsg.value = ''
  try {
    await axios.delete(`${API}/reports`, {
      headers: authHeaders(),
      params:  { worldId },
      data:    { ids: selected.value },
    })
    reports.value  = reports.value.filter(r => !selected.value.includes(r.id))
    selected.value = []
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao apagar relatórios.'
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchReports() {
  loading.value = true
  try {
    const { data } = await axios.get(`${API}/reports`, {
      headers: authHeaders(),
      params:  { worldId },
    })
    reports.value = data.reports ?? []
  } catch (e) {
    console.error('[ReportsView] erro ao carregar:', e)
    errorMsg.value = 'Erro ao carregar relatórios.'
  } finally {
    loading.value = false
  }
}

// ── Formatação ────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  const month = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
  const day   = String(d.getDate()).padStart(2, '0')
  const time  = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return d.getFullYear() === now.getFullYear()
    ? `${month}. ${day}, ${time}`
    : `${d.toLocaleDateString('pt-BR')} ${time}`
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
let tickInterval = null

onMounted(async () => {
  worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchReports()
  tickInterval = setInterval(() => villageStore.updateResources(), 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
/* ─── Layout base ─────────────────────────────────────────────────── */
.reports-view {
  padding: 0 16px 20px;
  color: #3b2200;
  font-size: 12px;
  font-family: Verdana, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.main-header { border-bottom: 1px solid #c8a878; padding-bottom: 10px; }
.main-title  { font-size: 20px; font-weight: bold; margin: 0; color: #000; }
.reports-layout { display: flex; gap: 0; align-items: flex-start; }

.sidebar {
  width: 110px; flex-shrink: 0;
  border: 1px solid #c8a460; background: #f4e4bc; font-size: 12px;
}
.sidebar-item {
  padding: 5px 10px; cursor: pointer;
  color: #8b4513; border-bottom: 1px solid #ddd0a8; font-weight: bold;
}
.sidebar-item:last-child { border-bottom: none; }
.sidebar-item:hover { background: #eddcaa; }
.sidebar-item--active { background: #fadc9b; color: #3b2200; }

.reports-panel {
  flex: 1; display: flex; flex-direction: column;
  border: 1px solid #c8a460; border-left: none;
}
.reports-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.reports-table thead tr {
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
}
.reports-table thead th {
  padding: 5px 8px; text-align: left;
  font-weight: bold; font-size: 11px; color: #000; white-space: nowrap;
}
.report-row { cursor: pointer; }
.report-row--a { background: #f0e2be; }
.report-row--b { background: #efe5cb; }
.report-row:hover { filter: brightness(0.97); }
.col-check   { width: 24px; padding: 4px 6px; text-align: center; }
.col-subject { padding: 5px 8px; width: 100%; }
.col-icons   { padding: 4px 6px; min-width: 40px; }
.col-date    { padding: 5px 10px; white-space: nowrap; font-size: 11px; color: #5a3a00; }
.col-empty   { padding: 12px 10px; text-align: center; color: #7a6040; font-style: italic; }

.report-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  margin-right: 5px; vertical-align: middle;
}
.report-dot--green   { background: #4a9c2f; }
.report-dot--yellow  { background: #c8a020; }
.report-dot--red     { background: #cc2020; }
.report-dot--neutral { background: transparent; border: 1px solid #aaa; }

.report-subject-text { vertical-align: middle; color: #3b2200; }
.report-subject--unread { font-weight: bold; color: #000; }
.report-new { font-size: 10px; color: #8b4513; margin-left: 4px; }

.reports-footer {
  display: flex; align-items: center; gap: 12px; padding: 6px 10px;
  background: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border-top: 1px solid #b09050;
}
.footer-select-all {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: bold; color: #3b2200; cursor: pointer;
}
.delete-btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: Verdana, Arial; font-size: 12px; font-weight: bold;
  cursor: pointer; border-radius: 5px; border: 1px solid #000;
  color: #fff; white-space: nowrap; padding: 3px 10px;
  background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.delete-btn:hover:not(:disabled) {
  background: linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.delete-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.delete-btn-icon { font-size: 11px; color: #ffaaaa; }
.build-error {
  background: #fff0f0; border: 1px solid #cc0000;
  color: #cc0000; font-size: 11px; padding: 6px 10px;
}

/* ─── MODAL TRIBAL WARS ───────────────────────────────────────────── */
.rm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.rm-modal {
  background: #f4e4bc;
  border: 2px solid #8b6535;
  width: 640px; max-width: 96vw; max-height: 88vh;
  display: flex; flex-direction: column;
  font-family: Verdana, Arial, sans-serif; font-size: 12px;
  box-shadow: 0 6px 32px rgba(0,0,0,0.45);
}

/* Topbar */
.rm-topbar {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border-bottom: 1px solid #8b6535;
  flex-shrink: 0;
}
.rm-topbtn {
  font-family: Verdana, Arial; font-size: 11px; font-weight: bold;
  cursor: pointer; border-radius: 4px; border: 1px solid #4a3010;
  color: #fff; padding: 2px 10px;
  background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.rm-topbtn:hover {
  background: linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.rm-topbtn--danger {
  background: linear-gradient(to bottom, #b06050 0%, #903030 30%, #7a1a1a 100%);
  border-color: #5a1010;
}
.rm-topbtn--danger:hover {
  background: linear-gradient(to bottom, #c07060 0%, #a04040 30%, #8a2a2a 100%);
}

/* Assunto */
.rm-subject-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: #efe0b0;
  border-bottom: 1px solid #c8a460;
  font-weight: bold; font-size: 12px;
  flex-shrink: 0;
}
.rm-subject-text { flex: 1; color: #3b2200; }

/* Data */
.rm-date-row {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 10px;
  border-bottom: 1px solid #ddd0a8;
  font-size: 11px; flex-shrink: 0;
}
.rm-date-label { color: #7a6040; font-weight: bold; min-width: 100px; }
.rm-date-value { color: #3b2200; }

/* Corpo scrollável */
.rm-body { overflow-y: auto; flex: 1; }

/* Título resultado */
.rm-result-title {
  padding: 8px 12px;
  font-size: 14px; font-weight: bold;
  border-bottom: 2px solid #c8a460;
  font-style: italic;
}
.rm-result--green   { color: #2a7a10; }
.rm-result--red     { color: #aa1010; }
.rm-result--yellow  { color: #8a6800; }
.rm-result--neutral { color: #3b2200; }

/* Blocos */
.rm-block {
  border: 1px solid #c8a460;
  margin: 8px 10px;
}
.rm-block-header {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 8px;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  font-size: 11px; font-weight: bold; color: #000;
}
.rm-block-header--defense { background-color: #96b468; background-image: none; }
.rm-block-header--loot    { background-color: #c1a264; }
.rm-block-player { color: #3b2200; font-weight: normal; }

.rm-block-body { padding: 8px; background: #fdf5e0; }

.rm-info-row {
  display: flex; align-items: baseline; gap: 6px;
  margin-bottom: 8px; font-size: 11px;
}
.rm-info-label { color: #7a6040; min-width: 55px; }
.rm-village-link { font-weight: bold; color: #8b2500; cursor: pointer; }
.rm-village-link:hover { text-decoration: underline; }

/* ─── Grade de unidades ───────────────────────────────────────────── */
.unit-grid {
  width: 100%;
  font-size: 11px;
  color: #3b2200;
}

.ug-icons-row,
.ug-qty-row,
.ug-lost-row {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
}

.ug-icons-row { margin-bottom: 2px; }

.ug-qty-row  { background: #f0e8cc; border-top: 1px solid #d8c898; border-bottom: 1px solid #d8c898; }
.ug-lost-row { background: #fde8e0; }

.ug-cell {
  text-align: center;
  padding: 1px 0;
}

.ug-cell--zero {
  opacity: 0.3;
  color: #999;
}

.ug-icon {
  display: block;
  margin: 0 auto;
  width: 32px;
  height: 32px;
}

.ug-icon--zero {
  opacity: 0.2;
  filter: grayscale(80%);
}

.ug-label-col {
  font-weight: bold;
  font-size: 10px;
  color: #5a3a00;
  padding: 2px 0 1px;
}

/* Loot */
.rm-loot-body {
  display: flex; align-items: center; gap: 20px;
  padding: 8px 10px !important;
}
.rm-loot-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 14px; font-weight: bold; color: #3b2200;
}

/* Raw fallback */
.rm-raw { padding: 12px; }
.rm-raw pre { font-size: 11px; color: #3b2200; white-space: pre-wrap; }

/* Rodapé modal */
.rm-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; flex-shrink: 0;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border-top: 1px solid #8b6535;
}
.rm-footer-link {
  font-size: 11px; color: #3b2200; cursor: pointer; font-weight: bold;
}
.rm-footer-link:hover { text-decoration: underline; }
</style>
