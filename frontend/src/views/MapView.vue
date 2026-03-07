<template>
  <GameLayout>
    <div class="map-view">

      <div class="map-title-row">
        <span class="map-title">Continente {{ continent }}</span>
        <span class="map-center-label">Centro: ({{ centerX }}|{{ centerY }})</span>
      </div>

      <div class="map-area">

        <div class="map-outer-box">
          <div class="arrow-row">
            <button class="arrow-btn" @click="move(0, -3)">
              <span class="icon-rotated up"><span :style="iconStyle('seta_direita')" /></span>
            </button>
          </div>

          <div class="map-mid-row">
            <button class="arrow-btn arrow-side" @click="move(-3, 0)">
              <span :style="iconStyle('seta_esquerda')" />
            </button>

            <div class="canvas-wrapper">
              <canvas ref="canvasEl" class="map-canvas" />

              <Teleport to="body">
                <!-- Hover: mini-tooltip -->
                <div
                  v-if="tooltip && !clickedVillage"
                  class="map-hover-tip"
                  :style="{ left: (tooltip.screenX + 14) + 'px', top: (tooltip.screenY - 10) + 'px' }"
                >
                  <strong>{{ tooltip.village.name }}</strong>
                  ({{ tooltip.village.x }}|{{ tooltip.village.y }})
                  {{ getContinent(tooltip.village.x, tooltip.village.y) }}<br/>
                  {{ tooltip.village.player_name ?? 'Bárbara' }} — {{ tooltip.village.points }} pts
                </div>

                <!-- Clique: botão atacar no canto superior esquerdo da aldeia -->
                <div
                  v-if="clickedVillage"
                  class="map-ctx-popup"
                  :style="{
                    left: (clickedVillage.screenCX - 40) + 'px',
                    top:  (clickedVillage.screenCY - 40) + 'px',
                    opacity: popupOpacity,
                    transition: 'opacity 0.3s ease',
                  }"
                >
                  <button class="ctx-btn" title="Atacar" @click="openAttackPanel('attack')">
                    <span class="ctx-icon" :style="ctxIcon('atacar')" />
                  </button>
                </div>
              </Teleport>
            </div>

            <button class="arrow-btn arrow-side" @click="move(3, 0)">
              <span :style="iconStyle('seta_direita')" />
            </button>
          </div>

          <div class="arrow-row">
            <button class="arrow-btn" @click="move(0, 3)">
              <span class="icon-rotated down"><span :style="iconStyle('seta_direita')" /></span>
            </button>
          </div>
        </div>

        <!-- Painel lateral -->
        <div class="map-side">

          <MiniMap
            :centerX="centerX"
            :centerY="centerY"
            :worldId="worldId"
            @moveTo="moveTo"
          />

          <div class="side-box">
            <div class="side-box-header">Centralizar mapa</div>
            <div class="side-box-body">
              <div class="coord-row">
                <label>x: <input v-model.number="inputX" class="coord-input" /></label>
                <label>y: <input v-model.number="inputY" class="coord-input" /></label>
              </div>
              <div class="coord-row">
                <button class="center-btn" @click="goToCoords">Centro</button>
                <button class="center-btn" @click="goToVillage">⌂ Minha aldeia</button>
              </div>
            </div>
          </div>

          <div class="side-box">
            <div class="side-box-header">Procurar</div>
            <div class="side-box-body">
              <input
                v-model="searchQuery"
                class="search-input"
                placeholder="Nome do jogador..."
                @input="onSearch"
              />
              <div v-if="searchResults.length" class="search-dropdown">
                <div
                  v-for="v in searchResults"
                  :key="v.id"
                  class="search-item"
                  @click="goToSearchResult(v)"
                >
                  <span class="search-item-name">{{ v.name }}</span>
                  <span class="search-item-coords">({{ v.x }}|{{ v.y }})</span>
                </div>
              </div>
              <div v-else-if="searchQuery.length >= 2 && !searching" class="search-empty">
                Nenhuma aldeia encontrada.
              </div>
            </div>
          </div>

          <div class="side-box">
            <div class="side-box-header">Legenda</div>
            <div class="side-box-body">
              <div class="legend-row">
                <img src="/map/v1.png" class="legend-img" />
                Jogador
              </div>
              <div class="legend-row">
                <img src="/map/v1_left.png" class="legend-img" />
                Bárbara
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Painel "Distribuir ordens" ────────────────────────────────── -->
      <Teleport to="body">
        <div v-if="attackPanel" class="ap-overlay" @click.self="attackPanel = null">
          <div class="ap-modal">

            <div class="ap-header">
              <span>Distribuir ordens</span>
              <button class="ap-close" @click="attackPanel = null">✕</button>
            </div>

            <div class="ap-body">

              <div class="ap-units-area">
                <div class="ap-col">
                  <div class="ap-col-title">Infantaria</div>
                  <div v-for="key in INFANTRY" :key="key" class="ap-unit-row">
                    <div class="ap-unit-icon-wrap">
                      <img :src="`/units/${UNIT_CONFIGS[key].img}`"
                           :class="['ap-unit-img', { 'ap-unit-gray': !myUnits[key] }]"
                           :title="UNIT_CONFIGS[key].name" />
                    </div>
                    <div class="ap-unit-input-wrap">
                      <input v-model.number="sendUnits[key]" type="number" min="0"
                             :max="myUnits[key] ?? 0" class="ap-input"
                             :disabled="!myUnits[key]" />
                      <div class="ap-unit-count">({{ myUnits[key] ?? 0 }})</div>
                    </div>
                  </div>
                </div>

                <div class="ap-col">
                  <div class="ap-col-title">Cavalaria</div>
                  <div v-for="key in CAVALRY" :key="key" class="ap-unit-row">
                    <div class="ap-unit-icon-wrap">
                      <img :src="`/units/${UNIT_CONFIGS[key].img}`"
                           :class="['ap-unit-img', { 'ap-unit-gray': !myUnits[key] }]"
                           :title="UNIT_CONFIGS[key].name" />
                    </div>
                    <div class="ap-unit-input-wrap">
                      <input v-model.number="sendUnits[key]" type="number" min="0"
                             :max="myUnits[key] ?? 0" class="ap-input"
                             :disabled="!myUnits[key]" />
                      <div class="ap-unit-count">({{ myUnits[key] ?? 0 }})</div>
                    </div>
                  </div>
                </div>

                <div class="ap-col">
                  <div class="ap-col-title">Armas de cerco</div>
                  <div v-for="key in SIEGE" :key="key" class="ap-unit-row">
                    <div class="ap-unit-icon-wrap">
                      <img :src="`/units/${UNIT_CONFIGS[key].img}`"
                           :class="['ap-unit-img', { 'ap-unit-gray': !myUnits[key] }]"
                           :title="UNIT_CONFIGS[key].name" />
                    </div>
                    <div class="ap-unit-input-wrap">
                      <input v-model.number="sendUnits[key]" type="number" min="0"
                             :max="myUnits[key] ?? 0" class="ap-input"
                             :disabled="!myUnits[key]" />
                      <div class="ap-unit-count">({{ myUnits[key] ?? 0 }})</div>
                    </div>
                  </div>
                </div>

  <div class="ap-col">
    <div class="ap-col-title">Outros</div>
    <div v-for="key in OTHER" :key="key" class="ap-unit-row">
      <div class="ap-unit-icon-wrap">
        <img :src="`/units/${UNIT_CONFIGS[key].img}`"
             :class="['ap-unit-img', { 'ap-unit-gray': !myUnits[key] }]"
             :title="UNIT_CONFIGS[key].name" />
      </div>
      <div class="ap-unit-input-wrap">
        <input v-model.number="sendUnits[key]" type="number" min="0"
               :max="myUnits[key] ?? 0" class="ap-input"
               :disabled="!myUnits[key]" />
        <div class="ap-unit-count">({{ myUnits[key] ?? 0 }})</div>
      </div>
    </div>
  </div>

  <div class="ap-col ap-col-models">
    <div class="ap-col-title">Modelos de tropas</div>
    <div class="ap-model-row">Todas as tropas <span class="ap-info">ⓘ</span></div>
    <div class="ap-model-row">Fake <span class="ap-info">ⓘ</span></div>
    <div class="ap-model-row">Nobre <span class="ap-info">ⓘ</span></div>
  </div>
</div>

              <div class="ap-target-info" v-if="attackTarget">
                <img src="/map/v1_left.png" class="ap-target-img" />
                <div class="ap-target-text">
                  <div class="ap-target-name">
                    {{ attackTarget.name }} ({{ attackTarget.x }}|{{ attackTarget.y }})
                  </div>
                  <div>
                    Proprietário: <strong>{{ attackTarget.player_name ?? 'Bárbara' }}</strong>
                    &nbsp; Pontos: {{ attackTarget.points }}
                  </div>
                  <div>Distância: {{ calcDistance() }} campo(s)</div>
                </div>
              </div>

              <div class="ap-buttons">
                <button class="ap-btn ap-btn-attack"  @click="sendOrder('attack')">⚔ Ataque</button>
                <button class="ap-btn ap-btn-support" @click="sendOrder('support')">🛡 Apoio</button>
              </div>

              <div v-if="apError"   class="ap-error">{{ apError }}</div>
              <div v-if="apSuccess" class="ap-success">{{ apSuccess }}</div>

            </div>
          </div>
        </div>
      </Teleport>

    </div>
  </GameLayout>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useMapStore } from '../stores/mapStore.js'
import { useMapCanvas, getContinent } from '../composables/useMapCanvas.js'
import { useMapSocket } from '../composables/useMapSocket.js'
import { initNoise } from '../../../shared/mapNoise.js'
import { useIcons } from '../composables/useIcons.js'
import { UNIT_CONFIGS } from '../../../shared/units.js'
import MiniMap from '../components/MiniMap.vue'

const API          = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'
const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const mapStore     = useMapStore()
const canvasEl     = ref(null)
const worldId      = parseInt(route.query.world)

const {
  init, destroy, moveTo, applyVillageUpdate,
  centerX, centerY, continent, loading, tooltip, clickedVillage,
} = useMapCanvas(worldId)

const inputX = ref(500)
const inputY = ref(500)
const popupOpacity = ref(1)
const { iconStyle } = useIcons()

watch(clickedVillage, (val) => {
  if (val) popupOpacity.value = 1
})

// ── icons_context.png: 24×24px, 15 colunas, linha 0=normal linha 1=hover ─
const CTX_ICONS = {
  recursos: 0, atacar: 1, reservar: 2, favoritar: 3,
  relatorio: 4, perfil: 5, info_aldeia: 6,
  retirar_reserva: 8, retirar_favorito: 9,
  A: 10, B: 11, C: 12, mapa: 13, overview: 14,
}

function ctxIcon(name) {
  const idx = typeof name === 'number' ? name : (CTX_ICONS[name] ?? 0)
  return {
    backgroundImage:    "url('/map/icon/icons_context.png')",
    backgroundRepeat:   'no-repeat',
    backgroundPosition: `-${idx * 24}px 0px`,
    backgroundSize:     'auto',
    width:   '24px',
    height:  '24px',
    display: 'inline-block',
  }
}

function move(dx, dy) { moveTo(centerX.value + dx, centerY.value + dy) }

function goToVillage() {
  const coords = villageStore.village?.coords
  if (coords) {
    inputX.value = coords.x
    inputY.value = coords.y
    moveTo(coords.x, coords.y)
  }
}

function goToCoords() { moveTo(inputX.value, inputY.value) }

// ── Painel de ataque ──────────────────────────────────────────────────────
const attackPanel  = ref(null)
const attackTarget = ref(null)
const myUnits      = reactive({})
const sendUnits    = reactive({})
const apError      = ref('')
const apSuccess    = ref('')

const INFANTRY = ['spear', 'sword', 'axe', 'archer']
const CAVALRY  = ['scout', 'light', 'marcher', 'heavy']
const SIEGE    = ['ram', 'catapult']
const OTHER    = ['knight', 'snob', 'militia']
const ALL_UNITS = [...INFANTRY, ...CAVALRY, ...SIEGE, ...OTHER]

async function openAttackPanel(type) {
  if (!clickedVillage.value) return
  attackTarget.value   = clickedVillage.value.village
  clickedVillage.value = null
  attackPanel.value    = type
  apError.value        = ''
  apSuccess.value      = ''

  for (const k of ALL_UNITS) sendUnits[k] = 0

  try {
    const { data } = await axios.get(`${API}/barracks`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    for (const k of ALL_UNITS) myUnits[k] = data.units?.[k] ?? 0
  } catch {
    apError.value = 'Erro ao carregar unidades.'
  }
}

function calcDistance() {
  if (!attackTarget.value || !villageStore.village?.coords) return '?'
  const dx = attackTarget.value.x - villageStore.village.coords.x
  const dy = attackTarget.value.y - villageStore.village.coords.y
  return Math.sqrt(dx * dx + dy * dy).toFixed(2)
}

async function sendOrder(type) {
  apError.value   = ''
  apSuccess.value = ''

  const units = {}
  for (const k of ALL_UNITS) {
    if (sendUnits[k] > 0) units[k] = sendUnits[k]
  }

  if (!Object.keys(units).length) {
    apError.value = 'Selecione ao menos uma unidade.'
    return
  }

  try {
    await axios.post(
      `${API}/worlds/${worldId}/map/attack`,
      { targetVillageId: attackTarget.value.id, units, type },
      { headers: { Authorization: `Bearer ${authStore.token}` } }
    )
    apSuccess.value = type === 'attack' ? 'Ataque enviado!' : 'Apoio enviado!'
    setTimeout(() => { attackPanel.value = null }, 1200)
  } catch (e) {
    apError.value = e.response?.data?.error ?? 'Erro ao enviar.'
  }
}

// ── Pesquisa ──────────────────────────────────────────────────────────────
const searchQuery   = ref('')
const searchResults = ref([])
const searching     = ref(false)
let   searchTimer   = null

async function onSearch() {
  clearTimeout(searchTimer)
  searchResults.value = []
  if (searchQuery.value.length < 2) return
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const { data } = await axios.get(`${API}/worlds/${worldId}/map/search`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
        params:  { q: searchQuery.value },
      })
      searchResults.value = data.villages ?? []
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

function goToSearchResult(v) {
  moveTo(v.x, v.y)
  inputX.value        = v.x
  inputY.value        = v.y
  searchQuery.value   = ''
  searchResults.value = []
}

// ── Socket ────────────────────────────────────────────────────────────────
const { joinWorld, leaveWorld } = useMapSocket()

watch(() => mapStore.lastUpdate, (village) => {
  if (village) applyVillageUpdate(village)
})

onMounted(async () => {
  const coords = villageStore.village?.coords
  if (coords) { inputX.value = coords.x; inputY.value = coords.y }

  try {
    const { data } = await axios.get(`${API}/worlds/${worldId}/seed`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    initNoise(data.seed)
  } catch (e) {
    console.warn('[MapView] Seed não encontrado, usando padrão:', e)
  }

  init(canvasEl.value, coords?.x, coords?.y)

  if (worldId) {
    mapStore.setCurrentWorld(worldId)
    joinWorld(worldId)
  }

  // Fade-out do popup ao arrastar o mapa
  // Observa centerX/centerY: qualquer movimento do mapa dispara o fade
  watch([centerX, centerY], () => {
    if (clickedVillage.value) {
      popupOpacity.value = 0
      setTimeout(() => { clickedVillage.value = null }, 300)
    }
  })
})
onUnmounted(() => {
  destroy(canvasEl.value)
  if (worldId) leaveWorld(worldId)
})
</script>

<style scoped>
.map-view {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #3b2200;
}

.map-title { font-size: 15px; font-weight: bold; }
.map-center-label { color: #7a6040; }

.map-area {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.map-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.map-outer-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f4e4bc;
  border: 1px solid #8c5f0d;
  flex-shrink: 0;
}

.arrow-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

.map-mid-row {
  display: flex;
  align-items: center;
}

.arrow-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}
.arrow-btn:hover { opacity: 1; }

.icon-rotated {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-rotated.up   { transform: rotate(-90deg); }
.icon-rotated.down { transform: rotate(90deg); }

.canvas-wrapper {
  position: relative;
  line-height: 0;
  border: 1px solid #8c5f0d;
}

.map-canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* ── Hover tip ── */
.map-hover-tip {
  position: fixed;
  background: rgba(20,14,6,0.90);
  color: #fff8e8;
  font-size: 10px;
  font-family: Verdana, Arial, sans-serif;
  padding: 4px 8px;
  border: 1px solid #8b6535;
  z-index: 9998;
  white-space: nowrap;
  pointer-events: none;
  line-height: 1.6;
}

/* ── Context popup ── */
.map-ctx-popup {
  position: fixed;
  z-index: 9999;
}

.ctx-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  width: 24px;
  height: 24px;
}
.ctx-btn:hover .ctx-icon {
  background-position-y: -24px !important;
}
.ctx-icon { display: block; }

/* ── Painel de ataque ── */
.ap-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ap-modal {
  background: #f0e0b0;
  border: 2px solid #8b6535;
  min-width: 420px;
  max-width: 620px;
  font-family: Verdana, Arial, sans-serif;
  font-size: 11px;
  color: #3b2200;
  box-shadow: 4px 4px 16px rgba(0,0,0,0.5);
}

.ap-header {
  background: #c8a460;
  border-bottom: 2px solid #8b6535;
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: bold;
}

.ap-close {
  background: none; border: none; cursor: pointer;
  font-size: 14px; color: #3b2200;
}

.ap-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; }

.ap-units-area {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ap-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 80px;
}

.ap-col-title {
  font-weight: bold;
  font-size: 11px;
  border-bottom: 1px solid #c8a460;
  padding-bottom: 2px;
  margin-bottom: 2px;
  white-space: nowrap;
}

.ap-unit-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ap-unit-icon-wrap {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ap-unit-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.ap-unit-gray {
  filter: grayscale(100%) opacity(0.35);
}

.ap-unit-input-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.ap-input {
  width: 46px;
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 2px 3px;
  font-size: 11px;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
  text-align: center;
}
.ap-input:disabled { background: #e8d8a8; color: #aaa; }

.ap-unit-count { font-size: 10px; color: #7a6040; }

.ap-col-models {
  border-left: 1px solid #c8a460;
  padding-left: 10px;
  min-width: 120px;
}

.ap-model-row {
  padding: 3px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #c8a460;
  background: #fff8e8;
  margin-bottom: 2px;
}
.ap-model-row:hover { background: #f4e4bc; }
.ap-info { color: #7a6040; font-size: 12px; }

.ap-target-info {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff8e8;
  border: 1px solid #c8a460;
  padding: 6px 10px;
}

.ap-target-img { width: 40px; height: 30px; object-fit: contain; }

.ap-target-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}

.ap-target-name { font-weight: bold; font-size: 12px; }

.ap-buttons { display: flex; gap: 8px; }

.ap-btn {
  padding: 5px 16px;
  font-size: 12px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  border: 1px solid #8b6535;
  cursor: pointer;
}

.ap-btn-attack  { background: #c8a460; color: #3b2200; }
.ap-btn-attack:hover  { background: #b8944a; }
.ap-btn-support { background: #7a9a4a; color: #fff; }
.ap-btn-support:hover { background: #6a8a3a; }

.ap-error   { color: #cc0000; font-size: 11px; }
.ap-success { color: #226600; font-size: 11px; font-weight: bold; }

/* ── Painel lateral ── */
.side-box {
  border: 1px solid #8b6535;
  background: #f0e0b0;
  font-size: 11px;
  width: 270px;
}

.side-box-header {
  background: #c8a460;
  border-bottom: 1px solid #8b6535;
  padding: 3px 6px;
  font-weight: bold;
  font-style: italic;
  color: #3b2200;
  font-size: 11px;
}

.side-box-body {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #3b2200;
}

.coord-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.coord-row label {
  display: flex;
  align-items: center;
  gap: 3px;
}

.coord-input {
  width: 46px;
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 2px 4px;
  font-size: 11px;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
}

.center-btn {
  background: #c8a460;
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 11px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.center-btn:hover { background: #b8944a; }

.search-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #8b6535;
  background: #fff8e8;
  padding: 3px 6px;
  font-size: 11px;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
}

.search-dropdown {
  border: 1px solid #8b6535;
  background: #fff8e8;
  max-height: 160px;
  overflow-y: auto;
}

.search-item {
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 4px;
  border-bottom: 1px solid #e8d4a0;
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: #f4e4bc; }
.search-item-name { font-weight: bold; color: #3b2200; }
.search-item-coords { color: #7a6040; font-size: 10px; }

.search-empty {
  color: #7a6040;
  font-style: italic;
  font-size: 11px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #3b2200;
}

.legend-img {
  width: 32px;
  height: 24px;
  object-fit: contain;
  border: 1px solid #8b6535;
}
</style>
