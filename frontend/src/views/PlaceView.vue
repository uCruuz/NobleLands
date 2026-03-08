<template>
  <GameLayout>
    <div class="place-view">

      <!-- ── Cabeçalho ── -->
      <div class="main-header">
        <img src="/buildings/icons/place1.webp" class="main-header-img" alt="Praça de Reunião" />
        <div class="main-header-info">
          <h2 class="main-title">Praça de reunião</h2>
          <p class="main-desc">
            Na Praça de Reuniões encontram-se seus guerreiros antes da batalha.
            Aqui você poderá comandar ataques e mover suas tropas.
          </p>
        </div>
        <a class="main-help" href="#">Ajuda - Edifícios</a>
      </div>

      <!-- ── Menu de abas ── -->
      <div class="tab-nav">
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'commands' }"
          @click="activeTab = 'commands'"
        >Comandos</button>
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'troops' }"
          @click="activeTab = 'troops'"
        >Tropas</button>
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'gathering' }"
          @click="activeTab = 'gathering'"
        >Coletando</button>
        <button
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'simulator' }"
          @click="activeTab = 'simulator'"
        >Simulador</button>
      </div>

      <!-- ════════════════════════════════════════════
           ABA: COMANDOS
      ════════════════════════════════════════════ -->
      <template v-if="activeTab === 'commands'">
        <div class="commands-wrapper">

          <!-- Painel principal: distribuir ordens -->
          <div class="orders-panel">
            <h3 class="section-title">Distribuir ordens</h3>

            <table class="orders-table">
              <thead>
                <tr>
                  <th>Infantaria</th>
                  <th>Cavalaria</th>
                  <th>Armas de cerco</th>
                  <th>Outros</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="orders-col">
                    <div v-for="u in unitColumns.infantry" :key="u.key" class="unit-input-row">
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number" min="0" :max="units[u.key] ?? 0"
                        class="troop-input" :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>
                  <td class="orders-col">
                    <div v-for="u in unitColumns.cavalry" :key="u.key" class="unit-input-row">
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number" min="0" :max="units[u.key] ?? 0"
                        class="troop-input" :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>
                  <td class="orders-col">
                    <div v-for="u in unitColumns.siege" :key="u.key" class="unit-input-row">
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number" min="0" :max="units[u.key] ?? 0"
                        class="troop-input" :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>
                  <td class="orders-col">
                    <div v-for="u in unitColumns.other" :key="u.key" class="unit-input-row">
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number" min="0" :max="units[u.key] ?? 0"
                        class="troop-input" :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Destino + Botões de comando -->
            <div class="destination-command-row">
              <div class="destination-box">
                <span class="destination-label">Destino:</span>
                <div class="destination-radios">
                  <label><input type="radio" v-model="destType" value="coord" /> Coordenada</label>
                  <label><input type="radio" v-model="destType" value="village" /> Nome da aldeia</label>
                  <label><input type="radio" v-model="destType" value="player" /> Nome do jogador</label>
                </div>
                <div class="destination-input-row">
                  <input
                    v-model="destination"
                    type="text"
                    class="destination-input"
                    :placeholder="destType === 'coord' ? '000|000' : destType === 'village' ? 'Nome da aldeia' : 'Nome do jogador'"
                  />
                  <button class="dest-go-btn">
                    <i class="icon" :style="iconStyle('voltar')" title="anterior"></i>
                  </button>
                </div>
              </div>

              <div class="command-box">
                <span class="command-label">Comando:</span>
                <div class="command-btns">
                  <button class="action-btn" @click="sendAttack">
                    <i class="icon" :style="iconStyle('ataque')"></i>
                    Ataque
                  </button>
                  <button class="action-btn" @click="sendSupport">
                    <i class="icon" :style="iconStyle('apoio')"></i>
                    Apoio
                  </button>
                </div>
              </div>
            </div>

            <div v-if="commandError" class="build-error">{{ commandError }}</div>
          </div>

          <!-- Painel lateral: modelos de tropas -->
          <div class="templates-panel">
            <div class="templates-header">Modelos de tropas</div>
            <div class="templates-list">
              <div class="template-row">
                <span class="template-name">Todas as tropas</span>
                <i class="icon" :style="iconStyle('info')"></i>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Comandos ativos (abaixo do formulário) ── -->
        <div class="active-commands-section">
          <div class="active-commands-header">
            <span>Movimentos de tropas</span>
            <span v-if="commandsLoading" class="commands-loading">carregando...</span>
            <button class="refresh-btn" @click="fetchCommands" title="Atualizar">↻</button>
          </div>

          <div v-if="!commandsLoading && !activeCommands.length" class="commands-empty">
            Nenhum movimento de tropas em andamento.
          </div>

          <table v-else-if="activeCommands.length" class="commands-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Tropas</th>
                <th>Status</th>
                <th>Tempo restante</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cmd in activeCommands"
                :key="cmd.id"
                class="command-row"
                :class="`command-row--${cmd.type}`"
              >
                <!-- Tipo -->
                <td class="cmd-col-type">
                  <span class="cmd-badge" :class="`cmd-badge--${cmd.type}`">
                    {{ cmd.type === 'attack' ? '⚔ Ataque' : '🛡 Apoio' }}
                  </span>
                  <span v-if="cmd.cancelled" class="cmd-cancelled">(cancelado)</span>
                </td>

                <!-- Origem -->
                <td class="cmd-col-village">
                  <span class="cmd-village-name">{{ cmd.origin.name }}</span>
                  <span class="cmd-coords">({{ cmd.origin.x }}|{{ cmd.origin.y }})</span>
                </td>

                <!-- Destino -->
                <td class="cmd-col-village">
                  <span class="cmd-village-name">{{ cmd.target.name }}</span>
                  <span class="cmd-coords">({{ cmd.target.x }}|{{ cmd.target.y }})</span>
                  <span class="cmd-player">{{ cmd.target.playerName }}</span>
                </td>

                <!-- Resumo de tropas -->
                <td class="cmd-col-troops">
                  <div class="cmd-troops-list">
                    <span
                      v-for="(qty, key) in cmd.troops"
                      :key="key"
                      v-if="qty > 0"
                      class="cmd-troop-item"
                      :title="key"
                    >
                      <img :src="`/units/unit_${key}.webp`" class="cmd-troop-icon" />
                      {{ qty }}
                    </span>
                  </div>
                </td>

                <!-- Status -->
                <td class="cmd-col-status">
                  <span class="cmd-status" :class="`cmd-status--${cmd.status}`">
                    {{ cmd.status === 'traveling' ? '➜ Indo' : '↩ Voltando' }}
                  </span>
                </td>

                <!-- Tempo + barra -->
                <td class="cmd-col-timer">
                  <span class="cmd-timer">{{ formatCommandTime(cmd) }}</span>
                  <div class="cmd-progress-bar">
                    <div
                      class="cmd-progress-fill"
                      :class="`cmd-progress-fill--${cmd.type}`"
                      :style="{ width: getCommandProgress(cmd) + '%' }"
                    ></div>
                  </div>
                </td>

                <!-- Cancelar (só se ainda indo e não cancelado) -->
                <td class="cmd-col-action">
                  <button
                    v-if="cmd.status === 'traveling' && !cmd.cancelled"
                    class="cancel-cmd-btn"
                    @click="cancelCommand(cmd.id)"
                    :disabled="cancelling === cmd.id"
                  >
                    {{ cancelling === cmd.id ? '...' : 'Cancelar' }}
                  </button>
                  <span v-else class="cmd-no-action">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="cancelError" class="build-error">{{ cancelError }}</div>
        </div>
      </template>

      <!-- ════════════════════════════════════════════
           ABA: TROPAS
      ════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'troops'">
        <table class="buildings-table troops-table">
          <thead>
            <tr>
              <th v-for="u in allUnits" :key="u.key" class="troop-th">
                <img :src="`/units/${u.cfg.img}`" class="troop-th-icon" :title="u.cfg.name" :alt="u.cfg.name" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="building-row">
              <td v-for="u in allUnits" :key="u.key" class="troop-td">
                {{ units[u.key] ?? 0 }}
              </td>
            </tr>
          </tbody>
        </table>

        <template v-if="supportTroops.length">
          <div class="section-title" style="margin-top: 12px;">Tropas de apoio recebidas</div>
          <table class="buildings-table troops-table">
            <thead>
              <tr>
                <th class="support-owner-th">Jogador</th>
                <th v-for="u in allUnits" :key="u.key" class="troop-th">
                  <img :src="`/units/${u.cfg.img}`" class="troop-th-icon" :title="u.cfg.name" :alt="u.cfg.name" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(support, idx) in supportTroops" :key="idx" class="building-row">
                <td class="support-owner-td">
                  <span class="support-player">{{ support.playerName }}</span>
                  <span class="support-village">{{ support.villageName }}</span>
                </td>
                <td v-for="u in allUnits" :key="u.key" class="troop-td">
                  {{ support.units[u.key] ?? 0 }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </template>

      <!-- ════════════════════════════════════════════
           ABA: COLETANDO
      ════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'gathering'">
        <!-- TODO: tropas fora em saques/apoios -->
      </template>

      <!-- ════════════════════════════════════════════
           ABA: SIMULADOR
      ════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'simulator'">
        <!-- TODO: simulador de batalha -->
      </template>

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
import { UNIT_CONFIGS } from '../../../shared/units.js'
import { formatBuildTime } from '../../../shared/buildings.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route         = useRoute()
const villageStore  = useVillageStore()
const authStore     = useAuthStore()
const { iconStyle } = useIcons()

const activeTab = ref('commands')
const village   = computed(() => villageStore.village)

// ── Unidades ───────────────────────────────────────────────────────────────
const units       = ref({})
const supportTroops = ref([])

async function fetchUnits() {
  try {
    const { data } = await axios.get(`${API}/barracks`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params:  { worldId: villageStore.worldId },
    })
    units.value = data.units ?? {}
  } catch (e) {
    console.error('[PlaceView] Erro ao carregar unidades:', e)
  }
}

// ── Comandos ativos ────────────────────────────────────────────────────────
const activeCommands  = ref([])
const commandsLoading = ref(false)
const cancelError     = ref('')
const cancelling      = ref(null)
const now             = ref(Date.now())

async function fetchCommands() {
  if (!authStore.token || !villageStore.worldId) return
  commandsLoading.value = true
  try {
    const { data } = await axios.get(`${API}/commands`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params:  { worldId: villageStore.worldId },
    })
    activeCommands.value = data.commands ?? []
    if (data.serverTime) now.value = data.serverTime
  } catch (e) {
    console.error('[PlaceView] Erro ao carregar comandos:', e)
  } finally {
    commandsLoading.value = false
  }
}

async function cancelCommand(commandId) {
  cancelError.value = ''
  cancelling.value  = commandId
  try {
    await axios.post(
      `${API}/commands/cancel`,
      { commandId },
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
        params:  { worldId: villageStore.worldId },
      }
    )
    await fetchCommands()
  } catch (e) {
    cancelError.value = e.response?.data?.error ?? 'Erro ao cancelar comando.'
  } finally {
    cancelling.value = null
  }
}

function formatCommandTime(cmd) {
  const target = cmd.status === 'traveling' ? cmd.arrivesAtMs : cmd.returnsAtMs
  const diff   = Math.max(0, Math.floor((target - now.value) / 1000))
  return formatBuildTime(diff)
}

function getCommandProgress(cmd) {
  if (cmd.status === 'traveling') {
    const total   = cmd.arrivesAtMs - cmd.sentAtMs
    const elapsed = now.value - cmd.sentAtMs
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  } else {
    const total   = cmd.returnsAtMs - cmd.arrivesAtMs
    const elapsed = now.value - cmd.arrivesAtMs
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }
}

// ── Formulário de comando ──────────────────────────────────────────────────
const destType     = ref('coord')
const destination  = ref('')
const commandError = ref('')

const troopInputs = ref(
  Object.fromEntries(Object.keys(UNIT_CONFIGS).map(k => [k, null]))
)

const unitColumns = computed(() => {
  const infantry = [], cavalry = [], siege = [], other = []
  for (const [key, cfg] of Object.entries(UNIT_CONFIGS)) {
    const entry = { key, cfg }
    if (cfg.building === 'barracks')                                   infantry.push(entry)
    else if (cfg.building === 'stable')                                cavalry.push(entry)
    else if (cfg.building === 'workshop' || cfg.building === 'garage') siege.push(entry)
    else                                                               other.push(entry)
  }
  return { infantry, cavalry, siege, other }
})

const allUnits = computed(() => [
  ...unitColumns.value.infantry,
  ...unitColumns.value.cavalry,
  ...unitColumns.value.siege,
  ...unitColumns.value.other,
])

function unitIsAvailable(key) {
  return UNIT_CONFIGS[key]?.implemented && (units.value[key] ?? 0) > 0
}

function buildTroopPayload() {
  const payload = {}
  for (const [key, qty] of Object.entries(troopInputs.value)) {
    if (qty && qty > 0) payload[key] = qty
  }
  return payload
}

function hasTroops(payload) {
  return Object.values(payload).some(v => v > 0)
}

async function sendAttack() {
  commandError.value = ''
  if (!destination.value.trim()) { commandError.value = 'Informe o destino.'; return }
  const troops = buildTroopPayload()
  if (!hasTroops(troops)) { commandError.value = 'Selecione ao menos uma unidade.'; return }
  console.log('[PlaceView] sendAttack', { destination: destination.value, destType: destType.value, troops })
  commandError.value = 'Sistema de ataques ainda não implementado nesta tela.'
}

async function sendSupport() {
  commandError.value = ''
  if (!destination.value.trim()) { commandError.value = 'Informe o destino.'; return }
  const troops = buildTroopPayload()
  if (!hasTroops(troops)) { commandError.value = 'Selecione ao menos uma unidade.'; return }
  console.log('[PlaceView] sendSupport', { destination: destination.value, destType: destType.value, troops })
  commandError.value = 'Sistema de apoio ainda não implementado nesta tela.'
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────
let tickInterval    = null
let commandInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)

  await fetchUnits()
  await fetchCommands()

  tickInterval = setInterval(() => {
    now.value = Date.now()
    villageStore.updateResources()
  }, 1000)

  commandInterval = setInterval(fetchCommands, 10_000)
})

onUnmounted(() => {
  clearInterval(tickInterval)
  clearInterval(commandInterval)
})
</script>

<style scoped>
.place-view {
  padding: 0 16px 20px;
  color: #3b2200;
  font-size: 12px;
  font-family: Verdana, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Header ── */
.main-header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 10px;
  margin-bottom: 0;
}
.main-header-img  { width: 80px; height: 80px; object-fit: contain; }
.main-header-info { flex: 1; }
.main-title { font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #000; }
.main-desc  { font-size: 12px; color: #000; margin: 0; line-height: 1.5; }
.main-help  { font-size: 11px; color: #8b4513; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.main-help:hover { text-decoration: underline; }

/* ── Abas ── */
.tab-nav {
  display: flex;
  gap: 2px;
  margin-top: 10px;
  border-bottom: 1px solid #c8a460;
}
.tab-btn {
  background: #f4e4bc;
  border: 1px solid #c8a460;
  border-bottom: none;
  color: #8b4513;
  font-size: 12px;
  font-family: Verdana, Arial, sans-serif;
  padding: 4px 12px;
  cursor: pointer;
  position: relative;
  bottom: -1px;
}
.tab-btn--active {
  background: #fadc9b;
  color: #3b2200;
  font-weight: bold;
  border-bottom: 1px solid #fadc9b;
  z-index: 1;
}
.tab-btn:hover:not(.tab-btn--active) { background: #f9edcc; }

/* ── Título de seção ── */
.section-title {
  font-size: 13px;
  font-weight: bold;
  color: #3b2200;
  margin: 0 0 6px 0;
  padding: 0;
}

/* ── ABA COMANDOS ── */
.commands-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 10px;
  width: fit-content;
}

.orders-panel {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.orders-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 11px;
  background: #ecd8aa;
}
.orders-table thead th {
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
.orders-col {
  background: #f4e4bc;
  padding: 6px 8px;
  vertical-align: top;
  width: 25%;
}
.unit-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.unit-input-row:last-child { margin-bottom: 0; }
.unit-row-icon { width: 18px; height: 18px; object-fit: contain; flex-shrink: 0; }

.troop-input {
  width: 52px;
  background: none;
  border: 3px solid transparent;
  border-image: url('/border_input.jpg') 3 fill stretch;
  padding: 2px 4px;
  font-size: 11px;
  font-family: Verdana, Arial, sans-serif;
  color: #3b2200;
  outline: none;
}
.troop-input:focus { box-shadow: 0 0 3px rgba(90,58,26,0.3); }
.troop-input:disabled { opacity: 0.45; cursor: no-drag; }
.troop-available { font-size: 10px; color: #7a6040; white-space: nowrap; cursor: pointer; }

.destination-command-row { display: flex; gap: 8px; align-items: flex-start; }
.destination-box {
  flex: 1;
  border: 1px solid #c8a460;
  background: #f4e4bc;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.destination-label, .command-label { font-weight: bold; font-size: 12px; color: #3b2200; }
.destination-radios { display: flex; gap: 12px; font-size: 11px; }
.destination-radios label { display: flex; align-items: center; gap: 3px; cursor: pointer; }
.destination-input-row { display: flex; align-items: center; gap: 4px; }
.destination-input {
  flex: 1;
  background: none;
  border: 3px solid transparent;
  border-image: url('/border_input.jpg') 3 fill stretch;
  padding: 4px 6px;
  font-size: 11px;
  font-family: Verdana, Arial, sans-serif;
  color: #3b2200;
  outline: none;
  min-width: 80px;
}
.destination-input:focus { box-shadow: 0 0 3px rgba(90,58,26,0.3); }
.dest-go-btn { background: none; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center; }
.dest-go-btn:hover { opacity: 0.75; }

.command-box {
  border: 1px solid #c8a460;
  background: #f4e4bc;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}
.command-btns { display: flex; flex-direction: column; gap: 4px; }

.action-btn {
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
  padding: 4px 12px;
  background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.action-btn:hover {
  background: linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}

.templates-panel {
  width: 160px;
  flex-shrink: 0;
  border: 1px solid #c8a460;
  background: #f4e4bc;
  font-size: 11px;
}
.templates-header {
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  padding: 4px 8px;
  font-weight: bold;
  font-size: 11px;
  color: #000;
}
.templates-list { padding: 4px 0; }
.template-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 8px;
  cursor: pointer;
  color: #8b4513;
}
.template-row:hover { background: #eddcaa; }
.template-name { font-size: 11px; }

/* ── Comandos ativos (abaixo do formulário) ── */
.active-commands-section {
  margin-top: 14px;
  border: 1px solid #8b6535;
  background: #f0e0b0;
  font-size: 11px;
}

.active-commands-header {
  background: #c8a460;
  border-bottom: 1px solid #8b6535;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: bold;
  font-style: italic;
  color: #3b2200;
  display: flex;
  align-items: center;
  gap: 8px;
}

.commands-loading {
  font-size: 10px;
  font-weight: normal;
  font-style: normal;
  color: #7a6040;
}

.refresh-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #8b4513;
  padding: 0 2px;
  font-style: normal;
}
.refresh-btn:hover { color: #3b2200; }

.commands-empty {
  padding: 10px 12px;
  color: #7a6040;
  font-style: italic;
  font-size: 11px;
}

.commands-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 11px;
  background: #ecd8aa;
}
.commands-table thead th {
  text-align: left;
  font-weight: 700;
  font-size: 10pt;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  padding: 4px 8px;
  white-space: nowrap;
  color: #000;
}

.command-row td {
  background: #f4e4bc;
  vertical-align: middle;
  padding: 5px 8px;
}
.command-row:nth-child(even) td { background: #eeddb8; }

.cmd-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 2px;
  white-space: nowrap;
}
.cmd-badge--attack  { background: #8b1a1a; color: #fff; }
.cmd-badge--support { background: #2a5c10; color: #fff; }

.cmd-cancelled {
  display: block;
  font-size: 10px;
  color: #7a6040;
  font-style: italic;
  margin-top: 2px;
}

.cmd-col-type   { width: 100px; }
.cmd-col-village { white-space: nowrap; }
.cmd-col-status  { white-space: nowrap; }
.cmd-col-timer   { min-width: 130px; }
.cmd-col-action  { white-space: nowrap; text-align: center; }

.cmd-col-troops  { max-width: 160px; }
.cmd-troops-list { display: flex; flex-wrap: wrap; gap: 4px; }
.cmd-troop-item  { display: flex; align-items: center; gap: 2px; font-size: 10px; color: #3b2200; }
.cmd-troop-icon  { width: 16px; height: 16px; object-fit: contain; }

.cmd-village-name { display: block; font-weight: bold; color: #3b2200; font-size: 11px; }
.cmd-coords       { display: block; font-size: 10px; color: #7a6040; }
.cmd-player       { display: block; font-size: 10px; color: #8b4513; }

.cmd-status { font-size: 11px; font-weight: bold; }
.cmd-status--traveling { color: #8b1a1a; }
.cmd-status--returning { color: #2a5c10; }

.cmd-timer { display: block; font-weight: bold; color: #3b2200; font-size: 11px; margin-bottom: 3px; }

.cmd-progress-bar {
  width: 100%;
  height: 4px;
  background: #c8a878;
  border-radius: 2px;
  overflow: hidden;
}
.cmd-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s linear;
}
.cmd-progress-fill--attack  { background: linear-gradient(to right, #8b1a1a, #cc3030); }
.cmd-progress-fill--support { background: linear-gradient(to right, #2a5c10, #4a9c20); }

/* Botão cancelar */
.cancel-cmd-btn {
  display: inline-block;
  font-family: Verdana, Arial;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid #000;
  color: #fff;
  padding: 2px 8px;
  background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
}
.cancel-cmd-btn:hover:not(:disabled) {
  background: linear-gradient(to bottom, #a08870 0%, #8b6c4d 22%, #7c5834 30%, #7c5834 100%);
}
.cancel-cmd-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cmd-no-action { color: #7a6040; font-size: 11px; }

/* ── ABA TROPAS ── */
.buildings-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 11px;
  background: #ecd8aa;
  margin-top: 10px;
}
.buildings-table thead th {
  font-size: 9pt;
  text-align: center;
  font-weight: 700;
  background-color: #c1a264;
  background-image: url('/tableheader_bg3.webp');
  background-repeat: repeat-x;
  padding: 4px 4px;
  white-space: nowrap;
  color: #000;
}
.building-row td { background: #f4e4bc; vertical-align: middle; }

.troops-table .troop-th { text-align: center; padding: 4px 2px; }
.troop-th-icon { width: 32px; height: 32px; object-fit: contain; display: block; margin: 0 auto; }
.troop-td { text-align: center; padding: 5px 4px; font-size: 12px; font-weight: bold; color: #3b2200; }

.support-owner-th { text-align: left; padding: 4px 8px; min-width: 110px; }
.support-owner-td { padding: 4px 8px; background: #f4e4bc; vertical-align: middle; }
.support-player   { display: block; font-weight: bold; color: #8b4513; font-size: 11px; }
.support-village  { display: block; font-size: 10px; color: #7a6040; }

/* ── Erro ── */
.build-error {
  background: #fff0f0;
  border: 1px solid #cc0000;
  color: #cc0000;
  font-size: 11px;
  padding: 6px 10px;
  margin-top: 4px;
}
</style>
