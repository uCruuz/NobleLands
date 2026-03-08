<template>
  <GameLayout>
    <div class="reports-view">

      <!-- ── Cabeçalho ── -->
      <div class="main-header">
        <div class="main-header-info">
          <h2 class="main-title">Relatórios</h2>
        </div>
      </div>

      <div class="reports-layout">

        <!-- ── Sidebar de filtros ── -->
        <div class="sidebar">
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >Todos</div>
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'attack' }"
            @click="activeFilter = 'attack'"
          >Ataques</div>
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'defense' }"
            @click="activeFilter = 'defense'"
          >Defesas</div>
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'support' }"
            @click="activeFilter = 'support'"
          >Suporte</div>
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'trade' }"
            @click="activeFilter = 'trade'"
          >Comércio</div>
          <div
            class="sidebar-item"
            :class="{ 'sidebar-item--active': activeFilter === 'misc' }"
            @click="activeFilter = 'misc'"
          >Diversos</div>
        </div>

        <!-- ── Painel principal ── -->
        <div class="reports-panel">

          <!-- Tabela de relatórios -->
          <table class="reports-table">
            <thead>
              <tr>
                <!-- Checkbox selecionar todos -->
                <th class="col-check">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    :indeterminate.prop="someSelected && !allSelected"
                    @change="toggleAll"
                  />
                </th>
                <th class="col-subject">Assunto</th>
                <th class="col-icons"></th>
                <th class="col-date">Recebido em</th>
              </tr>
            </thead>
            <tbody v-if="filteredReports.length">
              <tr
                v-for="(report, idx) in filteredReports"
                :key="report.id"
                class="report-row"
                :class="idx % 2 === 0 ? 'report-row--a' : 'report-row--b'"
                @click.self="openReport(report)"
              >
                <!-- Checkbox individual -->
                <td class="col-check">
                  <input
                    type="checkbox"
                    :value="report.id"
                    v-model="selected"
                  />
                </td>

                <!-- Assunto -->
                <td class="col-subject" @click="openReport(report)">
                  <!-- Indicador de lido/não lido -->
                  <span
                    class="report-dot"
                    :class="`report-dot--${report.result ?? 'neutral'}`"
                  ></span>
                  <span class="report-subject" :class="{ 'report-subject--unread': !report.read }">
                    {{ report.subject }}
                  </span>
                  <span v-if="!report.read" class="report-new">(novo)</span>
                </td>

                <!-- Ícones de ação (espionagem, etc.) — preparado para futuro -->
                <td class="col-icons">
                  <!--
                    TODO: adicionar ícones de ação por tipo de relatório
                    ex: ícone de espada para ataque, escudo para defesa
                  -->
                </td>

                <!-- Data -->
                <td class="col-date">{{ formatDate(report.createdAt) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr class="report-row report-row--a">
                <td colspan="4" class="col-empty">Nenhum relatório encontrado.</td>
              </tr>
            </tbody>
          </table>

          <!-- Rodapé: selecionar todos + apagar -->
          <div class="reports-footer">
            <label class="footer-select-all">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate.prop="someSelected && !allSelected"
                @change="toggleAll"
              />
              Selecionar todas
            </label>

            <button class="delete-btn" :disabled="selected.length === 0" @click="deleteSelected">
              <span class="delete-btn-icon">✕</span>
              Apagar
            </button>
          </div>

          <!-- Mensagem de erro -->
          <div v-if="errorMsg" class="build-error">{{ errorMsg }}</div>

        </div>
      </div>

      <!-- ── Modal de detalhe do relatório ── -->
      <div v-if="activeReport" class="report-modal-overlay" @click.self="activeReport = null">
        <div class="report-modal">
          <div class="report-modal-header">
            <span class="report-modal-title">{{ activeReport.subject }}</span>
            <button class="report-modal-close" @click="activeReport = null">✕</button>
          </div>
          <div class="report-modal-body">
            <div class="report-meta">
              <span class="report-meta-date">{{ formatDate(activeReport.createdAt) }}</span>
            </div>

            <!--
              TODO: renderizar conteúdo específico por tipo de relatório.
              Estrutura esperada de activeReport:
              {
                id: number,
                type: 'attack' | 'defense' | 'support' | 'trade' | 'misc',
                result: 'green' | 'yellow' | 'red' | 'neutral',
                subject: string,
                read: boolean,
                createdAt: timestamp,
                data: {
                  -- ataque/defesa:
                  attacker: { playerName, villageName, coords },
                  defender: { playerName, villageName, coords },
                  troopsSent: { spear: 0, ... },
                  troopsLost: { spear: 0, ... },
                  loot: { wood: 0, stone: 0, iron: 0 },
                  wall: { before: 0, after: 0 },
                }
              }
            -->
            <div class="report-content">
              <pre style="font-size:11px; color:#3b2200;">{{ JSON.stringify(activeReport.data ?? {}, null, 2) }}</pre>
            </div>
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

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()

// ── Estado ─────────────────────────────────────────────────────────────────
const activeFilter = ref('all')
const selected     = ref([])
const activeReport = ref(null)
const errorMsg     = ref('')

// ── Relatórios (populado via fetchReports quando a rota estiver pronta) ────
/*
  Estrutura esperada de cada item:
  {
    id: number,
    type: 'attack' | 'defense' | 'support' | 'trade' | 'misc',
    result: 'green' | 'yellow' | 'red' | 'neutral',
    subject: string,
    read: boolean,
    createdAt: timestamp (ms),
    data: { ... }
  }
*/
const reports = ref([])

// ── Filtro ─────────────────────────────────────────────────────────────────
const filteredReports = computed(() => {
  if (activeFilter.value === 'all') return reports.value
  return reports.value.filter(r => r.type === activeFilter.value)
})

// ── Seleção ────────────────────────────────────────────────────────────────
const allSelected  = computed(() =>
  filteredReports.value.length > 0 &&
  filteredReports.value.every(r => selected.value.includes(r.id))
)
const someSelected = computed(() =>
  filteredReports.value.some(r => selected.value.includes(r.id))
)

function toggleAll() {
  if (allSelected.value) {
    // desseleciona todos da lista filtrada
    const ids = filteredReports.value.map(r => r.id)
    selected.value = selected.value.filter(id => !ids.includes(id))
  } else {
    // seleciona todos da lista filtrada
    const ids = filteredReports.value.map(r => r.id)
    selected.value = [...new Set([...selected.value, ...ids])]
  }
}

// ── Abrir relatório ────────────────────────────────────────────────────────
function openReport(report) {
  activeReport.value = report
  // marca como lido localmente
  report.read = true
  // TODO: POST /api/reports/:id/read para marcar como lido no servidor
}

// ── Apagar selecionados ────────────────────────────────────────────────────
async function deleteSelected() {
  if (!selected.value.length) return
  errorMsg.value = ''
  try {
    /*
     * TODO: implementar quando a rota estiver pronta.
     * DELETE /api/reports  body: { ids: selected.value }
     */
    reports.value = reports.value.filter(r => !selected.value.includes(r.id))
    selected.value = []
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Erro ao apagar relatórios.'
  }
}

// ── Fetch de relatórios ────────────────────────────────────────────────────
async function fetchReports() {
  try {
    /*
     * TODO: descomentar quando a rota /api/reports estiver pronta.
     *
     * const { data } = await axios.get(`${API}/reports`, {
     *   headers: { Authorization: `Bearer ${authStore.token}` },
     *   params:  { worldId: villageStore.worldId },
     * })
     * reports.value = data.reports ?? []
     */

    // Dados de exemplo para desenvolvimento visual — remover quando a rota existir
    reports.value = []
  } catch (e) {
    console.error('[ReportsView] Erro ao carregar relatórios:', e)
  }
}

// ── Formatação de data ─────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  const isThisYear = d.getFullYear() === now.getFullYear()
  const month = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
  const day   = String(d.getDate()).padStart(2, '0')
  const time  = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return isThisYear
    ? `${month}. ${day}, ${time}`
    : `${d.toLocaleDateString('pt-BR')} ${time}`
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────
let tickInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchReports()
  tickInterval = setInterval(() => {
    villageStore.updateResources()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
</script>

<style scoped>
.reports-view {
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
  border-bottom: 1px solid #c8a878;
  padding-bottom: 10px;
}
.main-title {
  font-size: 20px;
  font-weight: bold;
  margin: 0;
  color: #000;
}

/* ── Layout sidebar + painel ── */
.reports-layout {
  display: flex;
  gap: 0;
  align-items: flex-start;
}

/* ── Sidebar ── */
.sidebar {
  width: 110px;
  flex-shrink: 0;
  border: 1px solid #c8a460;
  background: #f4e4bc;
  font-size: 12px;
}
.sidebar-item {
  padding: 5px 10px;
  cursor: pointer;
  color: #8b4513;
  border-bottom: 1px solid #ddd0a8;
  font-weight: bold;
}
.sidebar-item:last-child { border-bottom: none; }
.sidebar-item:hover { background: #eddcaa; }
.sidebar-item--active {
  background: #fadc9b;
  color: #3b2200;
}

/* ── Painel de relatórios ── */
.reports-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #c8a460;
  border-left: none;
}

/* ── Tabela ── */
.reports-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.reports-table thead tr {
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
}
.reports-table thead th {
  padding: 5px 8px;
  text-align: left;
  font-weight: bold;
  font-size: 11px;
  color: #000;
  white-space: nowrap;
}

.report-row {
  cursor: pointer;
}
.report-row--a { background: #f0e2be; }
.report-row--b { background: #efe5cb; }
.report-row:hover { filter: brightness(0.97); }

.col-check  { width: 24px; padding: 4px 6px; text-align: center; }
.col-subject { padding: 5px 8px; width: 100%; }
.col-icons  { padding: 4px 6px; white-space: nowrap; min-width: 40px; }
.col-date   { padding: 5px 10px; white-space: nowrap; font-size: 11px; color: #5a3a00; }
.col-empty  { padding: 12px 10px; text-align: center; color: #7a6040; font-style: italic; }

/* Dot de resultado */
.report-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
  flex-shrink: 0;
}
.report-dot--green   { background: #4a9c2f; }
.report-dot--yellow  { background: #c8a020; }
.report-dot--red     { background: #cc2020; }
.report-dot--neutral { background: transparent; border: 1px solid #aaa; }

.report-subject {
  vertical-align: middle;
  color: #3b2200;
}
.report-subject--unread {
  font-weight: bold;
  color: #000;
}
.report-new {
  font-size: 10px;
  color: #8b4513;
  margin-left: 4px;
  vertical-align: middle;
}

/* ── Rodapé ── */
.reports-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border-top: 1px solid #b09050;
}

.footer-select-all {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: bold;
  color: #3b2200;
  cursor: pointer;
}

/* Botão Apagar — padrão cancel-btn do projeto */
.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: Verdana, Arial;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 5px;
  border: 1px solid #000;
  color: #fff;
  white-space: nowrap;
  padding: 3px 10px 3px 10px;
  background:
    linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.delete-btn:hover:not(:disabled) {
  background:
    linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.delete-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.delete-btn-icon {
  font-size: 11px;
  color: #ffaaaa;
}

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
}

/* ── Modal de detalhe ── */
.report-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.report-modal {
  background: #f4e4bc;
  border: 2px solid #8b6535;
  min-width: 480px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  font-family: Verdana, Arial, sans-serif;
}
.report-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  border-bottom: 1px solid #8b6535;
}
.report-modal-title {
  font-weight: bold;
  font-size: 12px;
  color: #000;
}
.report-modal-close {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #3b2200;
  font-weight: bold;
  line-height: 1;
}
.report-modal-close:hover { color: #cc0000; }

.report-modal-body {
  padding: 12px 14px;
  overflow-y: auto;
  flex: 1;
}
.report-meta {
  margin-bottom: 10px;
  font-size: 10px;
  color: #7a6040;
}
.report-content {
  font-size: 11px;
  color: #3b2200;
  line-height: 1.6;
}
</style>
