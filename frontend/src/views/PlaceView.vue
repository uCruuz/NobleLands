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
                  <!-- Infantaria -->
                  <td class="orders-col">
                    <div
                      v-for="u in unitColumns.infantry"
                      :key="u.key"
                      class="unit-input-row"
                    >
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number"
                        min="0"
                        :max="units[u.key] ?? 0"
                        class="troop-input"
                        :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>

                  <!-- Cavalaria -->
                  <td class="orders-col">
                    <div
                      v-for="u in unitColumns.cavalry"
                      :key="u.key"
                      class="unit-input-row"
                    >
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number"
                        min="0"
                        :max="units[u.key] ?? 0"
                        class="troop-input"
                        :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>

                  <!-- Armas de cerco -->
                  <td class="orders-col">
                    <div
                      v-for="u in unitColumns.siege"
                      :key="u.key"
                      class="unit-input-row"
                    >
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number"
                        min="0"
                        :max="units[u.key] ?? 0"
                        class="troop-input"
                        :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>

                  <!-- Outros (nobre, paladino, milícia) -->
                  <td class="orders-col">
                    <div
                      v-for="u in unitColumns.other"
                      :key="u.key"
                      class="unit-input-row"
                    >
                      <img :src="`/units/${u.cfg.img}`" class="unit-row-icon" :title="u.cfg.name" />
                      <input
                        v-model.number="troopInputs[u.key]"
                        type="number"
                        min="0"
                        :max="units[u.key] ?? 0"
                        class="troop-input"
                        :disabled="!unitIsAvailable(u.key)"
                      />
                      <span class="troop-available">({{ units[u.key] ?? 0 }})</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Destino + Botões de comando -->
            <div class="destination-command-row">

              <!-- Destino -->
              <div class="destination-box">
                <span class="destination-label">Destino:</span>
                <div class="destination-radios">
                  <label>
                    <input type="radio" v-model="destType" value="coord" /> Coordenada
                  </label>
                  <label>
                    <input type="radio" v-model="destType" value="village" /> Nome da aldeia
                  </label>
                  <label>
                    <input type="radio" v-model="destType" value="player" /> Nome do jogador
                  </label>
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

              <!-- Botões de ação -->
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

            <!-- Erro -->
            <div v-if="commandError" class="build-error">{{ commandError }}</div>
          </div>

          <!-- Painel lateral: modelos de tropas -->
          <div class="templates-panel">
            <div class="templates-header">Modelos de tropas</div>
            <div class="templates-list">
              <!-- TODO: carregar modelos salvos do jogador -->
              <div class="template-row">
                <span class="template-name">Todas as tropas</span>
                <i class="icon" :style="iconStyle('info')"></i>
              </div>
              <!-- Novos modelos serão injetados aqui via prop/store futuramente -->
            </div>
          </div>

        </div>
      </template>

      <!-- ════════════════════════════════════════════
           ABA: TROPAS
      ════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'troops'">

        <!-- Tropas próprias na aldeia -->
        <table class="buildings-table troops-table">
          <thead>
            <tr>
              <th
                v-for="u in allUnits"
                :key="u.key"
                class="troop-th"
              >
                <img :src="`/units/${u.cfg.img}`" class="troop-th-icon" :title="u.cfg.name" :alt="u.cfg.name" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="building-row">
              <td
                v-for="u in allUnits"
                :key="u.key"
                class="troop-td"
              >
                {{ units[u.key] ?? 0 }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Tropas de apoio recebidas (pronto para receber dados) -->
        <template v-if="supportTroops.length">
          <div class="section-title" style="margin-top: 12px;">Tropas de apoio recebidas</div>
          <table class="buildings-table troops-table">
            <thead>
              <tr>
                <th class="support-owner-th">Jogador</th>
                <th
                  v-for="u in allUnits"
                  :key="u.key"
                  class="troop-th"
                >
                  <img :src="`/units/${u.cfg.img}`" class="troop-th-icon" :title="u.cfg.name" :alt="u.cfg.name" />
                </th>
              </tr>
            </thead>
            <tbody>
              <!--
                Estrutura esperada de cada item em supportTroops:
                {
                  playerName: string,
                  villageName: string,
                  units: { spear: 0, sword: 0, ... }
                }
              -->
              <tr
                v-for="(support, idx) in supportTroops"
                :key="idx"
                class="building-row"
              >
                <td class="support-owner-td">
                  <span class="support-player">{{ support.playerName }}</span>
                  <span class="support-village">{{ support.villageName }}</span>
                </td>
                <td
                  v-for="u in allUnits"
                  :key="u.key"
                  class="troop-td"
                >
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
        <!--
          TODO: implementar lista de tropas fora (saques/apoios ativos)
          Estrutura futura esperada:
          outgoingCommands: [{
            type: 'attack' | 'support',
            destination: { x, y, villageName, playerName },
            troops: { spear: 0, ... },
            arrivalTime: timestamp,
            returnTime: timestamp
          }]
        -->
      </template>

      <!-- ════════════════════════════════════════════
           ABA: SIMULADOR
      ════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'simulator'">
        <!--
          TODO: implementar simulador de batalha
        -->
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

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route         = useRoute()
const villageStore  = useVillageStore()
const authStore     = useAuthStore()
const { iconStyle } = useIcons()

// ── Estado da aba ──────────────────────────────────────────────────────────
const activeTab = ref('commands')

// ── Dados da aldeia ────────────────────────────────────────────────────────
const village = computed(() => villageStore.village)

// ── Unidades na aldeia (carregadas via /api/barracks) ──────────────────────
const units = ref({})

// ── Tropas de apoio recebidas (pronto para ser populado via futura rota) ───
// Estrutura: [{ playerName, villageName, units: { spear, sword, ... } }]
const supportTroops = ref([])

// ── Tropas saindo / retornando (pronto para rota futura /api/commands) ─────
// Estrutura: [{ type, destination, troops, arrivalTime, returnTime }]
const outgoingCommands = ref([])

// ── Formulário de comando ──────────────────────────────────────────────────
const destType     = ref('coord')
const destination  = ref('')
const commandError = ref('')

// Inputs de tropas — um campo por unidade
const troopInputs = ref(
  Object.fromEntries(Object.keys(UNIT_CONFIGS).map(k => [k, null]))
)

// ── Listas de unidades por categoria (todas, sem filtro de implemented) ────
const unitColumns = computed(() => {
  const infantry = []
  const cavalry  = []
  const siege    = []
  const other    = []

  for (const [key, cfg] of Object.entries(UNIT_CONFIGS)) {
    const entry = { key, cfg }
    if (cfg.building === 'barracks')                                     infantry.push(entry)
    else if (cfg.building === 'stable')                                  cavalry.push(entry)
    else if (cfg.building === 'workshop' || cfg.building === 'garage')   siege.push(entry)
    else                                                                  other.push(entry)
  }

  return { infantry, cavalry, siege, other }
})

// Todas as unidades em ordem para a tabela de tropas
const allUnits = computed(() => [
  ...unitColumns.value.infantry,
  ...unitColumns.value.cavalry,
  ...unitColumns.value.siege,
  ...unitColumns.value.other,
])

// ── Fetch de unidades (reusa endpoint do quartel) ──────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────

// Input habilitado apenas se a unidade está implementada E o jogador tem ao menos 1
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

// ── Enviar ataque (lógica futura: POST /api/commands/attack) ──────────────
async function sendAttack() {
  commandError.value = ''
  if (!destination.value.trim()) {
    commandError.value = 'Informe o destino.'
    return
  }
  const troops = buildTroopPayload()
  if (!hasTroops(troops)) {
    commandError.value = 'Selecione ao menos uma unidade.'
    return
  }
  /*
   * TODO: implementar quando a rota /api/commands/attack estiver pronta.
   * Payload esperado:
   * {
   *   worldId: villageStore.worldId,
   *   destination: { raw: destination.value, type: destType.value },
   *   troops
   * }
   */
  console.log('[PlaceView] sendAttack', { destination: destination.value, destType: destType.value, troops })
  commandError.value = 'Sistema de ataques ainda não implementado.'
}

// ── Enviar apoio (lógica futura: POST /api/commands/support) ─────────────
async function sendSupport() {
  commandError.value = ''
  if (!destination.value.trim()) {
    commandError.value = 'Informe o destino.'
    return
  }
  const troops = buildTroopPayload()
  if (!hasTroops(troops)) {
    commandError.value = 'Selecione ao menos uma unidade.'
    return
  }
  /*
   * TODO: implementar quando a rota /api/commands/support estiver pronta.
   */
  console.log('[PlaceView] sendSupport', { destination: destination.value, destType: destType.value, troops })
  commandError.value = 'Sistema de apoio ainda não implementado.'
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────
let tickInterval = null

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)
  await fetchUnits()
  tickInterval = setInterval(() => {
    villageStore.updateResources()
  }, 1000)
})

onUnmounted(() => clearInterval(tickInterval))
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

/* ══════════════════════════════════════
   ABA COMANDOS
══════════════════════════════════════ */
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

/* Tabela de distribuição de ordens */
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

.unit-row-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

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
.troop-input:focus {
  box-shadow: 0 0 3px rgba(90,58,26,0.3);
}
.troop-input:disabled {
  opacity: 0.45;
  cursor: no-drag;
}
.troop-available {
  font-size: 10px;
  color: #7a6040;
  white-space: nowrap;
  cursor: pointer;
}

/* Destino + botões de comando */
.destination-command-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.destination-box {
  flex: 1;
  border: 1px solid #c8a460;
  background: #f4e4bc;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.destination-label,
.command-label {
  font-weight: bold;
  font-size: 12px;
  color: #3b2200;
}
.destination-radios {
  display: flex;
  gap: 12px;
  font-size: 11px;
}
.destination-radios label {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}
.destination-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
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
.destination-input:focus {
  box-shadow: 0 0 3px rgba(90,58,26,0.3);
}
.destination-input:focus { outline: 1px solid #8b6535; }
.dest-go-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}
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
.command-btns {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Botões Ataque / Apoio — padrão do projeto */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  text-align: center;
  font-family: Verdana, Arial;
  font-size: 12px;
  font-weight: bold;
  line-height: normal;
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

/* Painel de modelos de tropas */
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

/* ══════════════════════════════════════
   ABA TROPAS
══════════════════════════════════════ */
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
.building-row td {
  background: #f4e4bc;
  vertical-align: middle;
}

.troops-table .troop-th {
  text-align: center;
  padding: 4px 2px;
}
.troop-th-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}
.troop-td {
  text-align: center;
  padding: 5px 4px;
  font-size: 12px;
  font-weight: bold;
  color: #3b2200;
}

/* Coluna do dono do apoio */
.support-owner-th {
  text-align: left;
  padding: 4px 8px;
  min-width: 110px;
}
.support-owner-td {
  padding: 4px 8px;
  background: #f4e4bc;
  vertical-align: middle;
}
.support-player {
  display: block;
  font-weight: bold;
  color: #8b4513;
  font-size: 11px;
}
.support-village {
  display: block;
  font-size: 10px;
  color: #7a6040;
}

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
