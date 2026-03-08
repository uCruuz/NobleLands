<template>
  <GameLayout>
    <div class="village-view">

      <!-- ── Notificações ── -->
      <div v-if="notifications.length" class="notifications">
        <div v-for="(n, i) in notifications" :key="i" class="notif-row">
          <i class="icon" :style="iconStyle('info')"></i>
          <span v-html="n.text"></span>
          <button class="notif-close" @click="notifications.splice(i,1)">
            <i class="icon" :style="iconStyle('error')"></i>
          </button>
        </div>
      </div>

      <!-- ── Layout principal ── -->
      <div class="village-main">

        <!-- ── Caixa do mapa ── -->
        <div class="map-box">
          <div class="map-box-header">
            <span class="map-box-title">{{ village.name }} ({{ village.points }} pontos)</span>
            <button class="map-box-collapse" @click="mapCollapsed = !mapCollapsed">−</button>
          </div>

          <div v-show="!mapCollapsed" class="map-scene-wrapper">
            <div class="map-scene" :style="{ backgroundImage: `url('/back_none.png')` }">

              <template v-for="b in buildingSpots" :key="b.key">
                <div
                  v-if="village.buildings[b.key] !== undefined && (village.buildings[b.key] > 0 || getBuildingImage(b.key))"
                  class="building-spot"
                  :class="{ 'building-spot--wall': b.key === 'wall' }"
                  :data-spot="b.key"
                  :style="{
                    top: b.top, left: b.left, width: b.w, height: b.h,
                    zIndex: b.zIndex !== undefined ? b.zIndex : 1
                  }"
                  :title="b.name"
                  @click="b.key !== 'wall' ? openBuilding(b.key) : null"
                >
                  <img
                    v-if="getBuildingImage(b.key)"
                    :src="getBuildingImage(b.key)"
                    :alt="b.name"
                    class="building-img"
                    :class="{ 'building-img--wall': b.key === 'wall' }"
                    @error="onImgError($event, b.key)"
                  />
                  <button
                    v-if="b.key !== 'wall'"
                    class="img-error-btn"
                    @click.stop="showErrorPopup(b)"
                    title="Imagem não encontrada — clique para detalhes"
                  >
                    <i class="icon" :style="iconStyle('error')"></i>
                  </button>
                  <span v-if="village.buildings[b.key] > 0 && b.key !== 'wall'" class="level-badge">
                    {{ village.buildings[b.key] }}
                  </span>
                </div>
              </template>

              <template v-for="anim in animSpots" :key="'anim-' + anim.animKey">
                <div
                  v-if="getBuildingAnim(anim.animKey)"
                  class="building-anim"
                  :class="`building-anim--${anim.animKey}`"
                  :style="{
                    top: anim.top, left: anim.left, width: anim.w, height: anim.h,
                    backgroundImage: `url('${getBuildingAnim(anim.animKey)}')`,
                    backgroundSize: `${anim.frames * 100}% 100%`,
                    animationDuration: `${anim.frames * anim.fps}ms`,
                    animationTimingFunction: `steps(${anim.frames})`
                  }"
                ></div>
              </template>

            </div>
          </div>
        </div>

        <!-- ── Painel direito ── -->
        <div class="side-panel">

          <div class="side-box">
            <div class="side-box-header">
              <span>Produção</span>
              <button class="side-box-collapse">−</button>
            </div>
            <div class="side-box-body">
              <div class="prod-row">
                <i class="icon" :style="iconStyle('madeira')"></i>
                <span>Madeira</span>
                <strong>{{ woodProduction }} por hora</strong>
              </div>
              <div class="prod-row">
                <i class="icon" :style="iconStyle('argila')"></i>
                <span>Argila</span>
                <strong>{{ stoneProduction }} por hora</strong>
              </div>
              <div class="prod-row">
                <i class="icon" :style="iconStyle('ferro')"></i>
                <span>Ferro</span>
                <strong>{{ ironProduction }} por hora</strong>
              </div>
            </div>
          </div>

          <div v-if="villageStore.currentBuild" class="side-box">
            <div class="side-box-header">
              <span>Em construção</span>
            </div>
            <div class="side-box-body">
              <div class="queue-row" v-for="job in village.buildQueue" :key="job.buildingKey">
                <span>{{ BUILDING_CONFIGS[job.buildingKey]?.name }}</span>
                <span class="queue-level">→ Nível {{ job.targetLevel }}</span>
                <span class="queue-timer">{{ formatTimeLeft(job.endsAt) }}</span>
              </div>
            </div>
          </div>

          <div class="side-box">
            <div class="side-box-header">
              <span>Unidades</span>
              <button class="side-box-collapse">−</button>
            </div>
            <div class="side-box-body">
              <div class="units-nav">
                <button class="unit-nav-btn">◄</button>
                <span>Todos</span>
                <button class="unit-nav-btn">►</button>
              </div>
              <div class="units-grid">
                <div v-for="u in unitList" :key="u.key" class="unit-item" :title="u.name">
                  <img :src="`/units/${u.img}`" :alt="u.name" class="unit-icon" />
                  <span class="unit-count">{{ u.count }}</span>
                </div>
              </div>
              <a href="#" class="recrutar-link">» recrutar</a>
            </div>
          </div>

          <div class="side-box">
            <div class="side-box-header">
              <span>Efeitos ativos</span>
              <button class="side-box-collapse">−</button>
            </div>
            <div class="side-box-body side-box-empty">
              <span class="empty-msg">Nenhum efeito ativo.</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Comandos ativos ── -->
      <div class="commands-section">
        <div class="commands-header">
          <span>Movimentos de tropas</span>
          <span v-if="commandsLoading" class="commands-loading">carregando...</span>
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
              <th>Status</th>
              <th>Tempo restante</th>
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

              <!-- Status -->
              <td class="cmd-col-status">
                <span class="cmd-status" :class="`cmd-status--${cmd.status}`">
                  {{ cmd.status === 'traveling' ? '➜ Indo' : '↩ Voltando' }}
                </span>
              </td>

              <!-- Tempo restante + barra -->
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
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Modal de erro de imagem ── -->
      <div v-if="errorPopup" class="error-modal-overlay" @click.self="errorPopup = null">
        <div class="error-modal">
          <div class="error-modal-header">
            <i class="icon" :style="iconStyle('error')"></i>
            <span>Imagem não encontrada</span>
            <button class="error-modal-close" @click="errorPopup = null">✕</button>
          </div>
          <div class="error-modal-body">
            <p><strong>Edifício:</strong> {{ errorPopup.name }}</p>
            <p><strong>Arquivo esperado:</strong></p>
            <code class="error-modal-path">{{ errorPopup.expected }}</code>
            <p class="error-modal-hint">Coloque o arquivo WebP neste caminho para exibir a imagem do edifício.</p>
          </div>
        </div>
      </div>

    </div>
  </GameLayout>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'
import { BUILDING_CONFIGS, formatBuildTime } from '../../../shared/buildings.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const route         = useRoute()
const router        = useRouter()
const villageStore  = useVillageStore()
const authStore     = useAuthStore()
const { iconStyle } = useIcons()

const village         = computed(() => villageStore.village)
const woodProduction  = computed(() => villageStore.woodProduction)
const stoneProduction = computed(() => villageStore.stoneProduction)
const ironProduction  = computed(() => villageStore.ironProduction)

const mapCollapsed  = ref(false)
const notifications = ref([])

// ── Comandos ativos ───────────────────────────────────────────────────────
const activeCommands  = ref([])
const commandsLoading = ref(false)
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
    // Sincroniza o now com o servidor para evitar drift
    if (data.serverTime) now.value = data.serverTime
  } catch (e) {
    console.error('[VillageView] Erro ao carregar comandos:', e)
  } finally {
    commandsLoading.value = false
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
    // returning: progresso de volta (de arrivesAt até returnsAt)
    const total   = cmd.returnsAtMs - cmd.arrivesAtMs
    const elapsed = now.value - cmd.arrivesAtMs
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }
}

// ── Building configs (mantidos do original) ───────────────────────────────
const BUILDING_IMAGE_CONFIG = {
  main:     { imgKey: 'main',     hasLevel0: false, tiers: 3 },
  barracks: { imgKey: 'barracks', hasLevel0: true,  tiers: 3 },
  stable:   { imgKey: 'stable',   hasLevel0: true,  tiers: 3 },
  garage:   { imgKey: 'garage',   hasLevel0: true,  tiers: 3 },
  snob:     { imgKey: 'snob',     hasLevel0: true,  tiers: 1 },
  smith:    { imgKey: 'smith',    hasLevel0: false, tiers: 3 },
  place:    { imgKey: 'place',    hasLevel0: false, tiers: 1 },
  statue:   { imgKey: 'statue',   hasLevel0: true,  tiers: 1 },
  market:   { imgKey: 'market',   hasLevel0: true,  tiers: 3 },
  wood:     { imgKey: 'wood',     hasLevel0: false, tiers: 3 },
  stone:    { imgKey: 'stone',    hasLevel0: false, tiers: 3 },
  iron:     { imgKey: 'iron',     hasLevel0: false, tiers: 3 },
  farm:     { imgKey: 'farm',     hasLevel0: false, tiers: 3 },
  storage:  { imgKey: 'storage',  hasLevel0: true,  tiers: 3 },
  hide:     { imgKey: 'hide',     hasLevel0: false, tiers: 1 },
  wall:     { imgKey: 'wall',     hasLevel0: true,  tiers: 1 },
  church:   { imgKey: 'church',   hasLevel0: true,  tiers: 3 },
}

const BUILDING_ANIMS = {
  farm:  'anim-building-farm-prod.png',
  iron:  'anim-building-iron-prod.png',
  stone: 'anim-building-stone-prod.png',
  wood:  'anim-building-wood-prod.png',
  main:  'anim-building-main-prod.png',
  wall:  'anim-building-wall-0.png',
}

function getImageTier(level, tiers) {
  if (level <= 0) return null
  if (level <= 5)  return 1
  if (level <= 15) return Math.min(2, tiers)
  return Math.min(3, tiers)
}

function getBuildingImage(key) {
  const level = village.value?.buildings[key] ?? 0
  const cfg   = BUILDING_IMAGE_CONFIG[key]
  if (!cfg) return null
  if (level <= 0) {
    if (!cfg.hasLevel0) return null
    const isBuilding = (village.value?.buildQueue ?? []).some(j => j.buildingKey === key)
    return isBuilding ? `/buildings/${cfg.imgKey}0.webp` : null
  }
  const tier = getImageTier(level, cfg.tiers)
  return `/buildings/${cfg.imgKey}${tier}.webp`
}

function getBuildingAnim(key) {
  const level = village.value?.buildings[key] ?? 0
  if (level <= 0) return null
  return BUILDING_ANIMS[key] ? `/buildings/${BUILDING_ANIMS[key]}` : null
}

const errorPopup = ref(null)

function onImgError(event, key) {
  const level  = village.value?.buildings[key] ?? 0
  const cfg    = BUILDING_IMAGE_CONFIG[key]
  const tier   = level <= 0 ? 0 : getImageTier(level, cfg?.tiers ?? 3)
  const imgKey = cfg?.imgKey ?? key
  const expected = `/assets/buildings/${imgKey}${tier}.webp`
  event.target.style.display = 'none'
  event.target.parentElement.dataset.imgError = expected
}

function showErrorPopup(b) {
  const wrapper  = document.querySelector(`[data-spot="${b.key}"]`)
  const expected = wrapper?.dataset.imgError
  if (expected) errorPopup.value = { key: b.key, name: b.name, expected }
}

const buildingSpots = [
  { key: 'iron',     name: 'Mina de Ferro',      top: '9.0%',  left: '7.0%',  w: '13.0%', h: '13.0%' },
  { key: 'farm',     name: 'Fazenda',            top: '09.0%', left: '82.0%', w: '13.0%', h: '13.0%' },
  { key: 'main',     name: 'Edificio Principal', top: '23.0%', left: '52.0%', w: '15.0%', h: '15.0%' },
  { key: 'barracks', name: 'Quartel',            top: '52.0%', left: '63.0%', w: '15.0%', h: '15.8%' },
  { key: 'stone',    name: 'Mina de Argila',     top: '71.0%', left: '3.0%',  w: '19.7%', h: '22.6%' },
  { key: 'wood',     name: 'Bosque',             top: '68.8%', left: '71.2%', w: '23.5%', h: '24.7%' },
  { key: 'wall',     name: 'Muralha',            top: '0%',    left: '0%',    w: '100%',  h: '100%', zIndex: 0 },
  { key: 'place',    name: 'Praça de Reunião',   top: '48.0%', left: '51.0%', w: '15.0%', h: '15.0%' },
  { key: 'statue',   name: 'Estátua',            top: '52.0%', left: '40.0%', w: '15.0%', h: '15.0%' },
  { key: 'smith',    name: 'Ferraria',           top: '65.0%', left: '35.0%', w: '15.0%', h: '15.0%' },
  { key: 'stable',   name: 'Estábulo',           top: '51.0%', left: '21.0%', w: '15.0%', h: '15.0%' },
  { key: 'market',   name: 'Mercado',            top: '33.0%', left: '39.0%', w: '14.0%', h: '14.0%' },
  { key: 'storage',  name: 'Armazém',            top: '34.0%', left: '22.0%', w: '15.0%', h: '15.0%' },
  { key: 'garage',   name: 'Oficina',            top: '64.0%', left: '52.5%', w: '15.0%', h: '15.0%' },
  { key: 'snob',     name: 'Academia',           top: '20.0%', left: '25.0%', w: '18.0%', h: '18.0%', zIndex: 0 },
  { key: 'hide',     name: 'Esconderijo',        top: '21.0%', left: '40.0%', w: '9.0%',  h: '9.0%' },
  { key: 'church',   name: 'Igreja',             top: '10.0%', left: '20.0%', w: '13.0%', h: '15.0%' },
]

const animSpots = [
  { animKey: 'farm',  top: '9.0%',  left: '95.5%', w: '4.5%', h: '6.0%', frames: 7,  fps: 120 },
  { animKey: 'iron',  top: '20.5%', left: '7.0%',  w: '6.5%', h: '6.5%', frames: 24, fps: 80  },
  { animKey: 'stone', top: '63.0%', left: '22.5%', w: '6.0%', h: '6.0%', frames: 7,  fps: 120 },
  { animKey: 'wood',  top: '62.0%', left: '68.0%', w: '5.0%', h: '5.0%', frames: 4,  fps: 150 },
  { animKey: 'main',  top: '42.0%', left: '55.5%', w: '6.5%', h: '6.5%', frames: 17, fps: 100 },
  { animKey: 'wall',  top: '88.0%', left: '1.0%',  w: '5.5%', h: '5.5%', frames: 2,  fps: 500 },
]

function openBuilding(key) {
  router.push(`/game?world=${villageStore.worldId}&village=${village.value.id}&screen=${key}`)
}

const unitList = [
  { key: 'spear',    name: 'Lanceiro',         img: 'unit_spear.webp',    count: 0 },
  { key: 'sword',    name: 'Espadachim',       img: 'unit_sword.webp',    count: 0 },
  { key: 'axe',      name: 'Machado',          img: 'unit_axe.webp',      count: 0 },
  { key: 'spy',      name: 'Espião',           img: 'unit_spy.webp',      count: 0 },
  { key: 'light',    name: 'Cavalaria Leve',   img: 'unit_light.webp',    count: 0 },
  { key: 'heavy',    name: 'Cavalaria Pesada', img: 'unit_heavy.webp',    count: 0 },
  { key: 'ram',      name: 'Aríete',           img: 'unit_ram.webp',      count: 0 },
  { key: 'catapult', name: 'Catapulta',        img: 'unit_catapult.webp', count: 0 },
  { key: 'knight',   name: 'Paladino',         img: 'unit_knight.webp',   count: 0 },
  { key: 'snob',     name: 'Nobre',            img: 'unit_snob.webp',     count: 0 },
]

let tickInterval    = null
let commandInterval = null
let lastTick        = Date.now()

function tick() {
  const n     = Date.now()
  const delta = (n - lastTick) / 1000
  lastTick    = n
  now.value   = n
  villageStore.processBuildQueue()
  villageStore.updateResources(delta)
}

function formatTimeLeft(endsAt) {
  const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
  return formatBuildTime(diff)
}

onMounted(async () => {
  const worldId = parseInt(route.query.world)
  if (authStore.user && worldId) villageStore.init(worldId)

  tickInterval = setInterval(tick, 1000)

  // Carrega comandos imediatamente e depois a cada 10s
  await fetchCommands()
  commandInterval = setInterval(fetchCommands, 10_000)
})

onUnmounted(() => {
  clearInterval(tickInterval)
  clearInterval(commandInterval)
})
</script>

<style scoped>
.village-view {
  padding: 0 8px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Notificações ── */
.notifications {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.notif-row {
  background: #fff8dc;
  border: 1px solid #c8a030;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #3b2200;
}
.notif-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

/* ── Layout principal ── */
.village-main {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

/* ── Caixa do mapa ── */
.map-box {
  flex: 1;
  border: 1px solid #8b6535;
  background: #c8a878;
  min-width: 0;
}
.map-box-header {
  background: #b8944a;
  border-bottom: 1px solid #8b6535;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;
  font-style: italic;
  color: #3b2200;
}
.map-box-collapse {
  background: #c8a460;
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 11px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.map-scene-wrapper { overflow: hidden; }
.map-scene {
  position: relative;
  width: 100%;
  aspect-ratio: 660 / 465;
  background-size: cover;
  background-position: center;
  cursor: default;
  user-select: none;
}

.building-spot {
  position: absolute;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.building-spot--wall {
  pointer-events: none;
  cursor: default;
  z-index: 0 !important;
}
.building-spot:not(.building-spot--wall):hover { filter: brightness(1.05); }
.building-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.building-img--wall {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.95;
  pointer-events: none;
}

@keyframes sprite-play {
  from { background-position-x: 0%; }
  to   { background-position-x: 100%; }
}
.building-anim {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  image-rendering: pixelated;
  background-repeat: no-repeat;
  background-position-x: 0%;
  background-position-y: 0%;
  animation-name: sprite-play;
  animation-iteration-count: infinite;
}
.level-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #4a7c2f;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2a5c10;
  pointer-events: none;
}

.img-error-btn {
  display: none;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.55);
  border: 1px dashed #e00;
  border-radius: 3px;
  padding: 4px 6px;
  cursor: pointer;
  z-index: 5;
}
[data-img-error] .img-error-btn { display: flex; align-items: center; justify-content: center; }
[data-img-error] .building-img  { display: none !important; }

/* ── Painel direito ── */
.side-panel {
  width: 185px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.side-box {
  border: 1px solid #8b6535;
  background: #f0e0b0;
}
.side-box-header {
  background: #c8a460;
  border-bottom: 1px solid #8b6535;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;
  font-style: italic;
  color: #3b2200;
}
.side-box-collapse {
  background: none;
  border: none;
  color: #3b2200;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
.side-box-body {
  padding: 6px 8px;
  font-size: 11px;
  color: #3b2200;
}
.side-box-empty { color: #7a6040; font-style: italic; }
.empty-msg { font-size: 11px; }

.prod-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
}
.prod-row span { flex: 1; }
.prod-row strong { font-size: 11px; }

.queue-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 3px 0;
  border-bottom: 1px solid #c8a878;
  font-size: 11px;
}
.queue-row:last-child { border-bottom: none; }
.queue-level { color: #5a3a00; }
.queue-timer { color: #8b4513; font-weight: bold; }

.units-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: bold;
  color: #3b2200;
}
.unit-nav-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #8b4513;
  font-size: 13px;
  padding: 0;
}
.units-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-bottom: 6px;
}
.unit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 30px;
}
.unit-icon {
  width: 25px;
  height: 25px;
  object-fit: contain;
}
.unit-count { font-size: 10px; color: #3b2200; }
.recrutar-link {
  display: block;
  font-size: 11px;
  color: #8b4513;
  font-weight: bold;
  text-decoration: none;
}
.recrutar-link:hover { text-decoration: underline; }

/* ── Comandos ativos ── */
.commands-section {
  border: 1px solid #8b6535;
  background: #f0e0b0;
  font-family: Verdana, Arial, sans-serif;
  font-size: 11px;
}

.commands-header {
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

/* Badge de tipo */
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

/* Colunas */
.cmd-col-type   { width: 100px; }
.cmd-col-village {
  white-space: nowrap;
}
.cmd-col-status { white-space: nowrap; }
.cmd-col-timer  { min-width: 130px; }

.cmd-village-name {
  display: block;
  font-weight: bold;
  color: #3b2200;
  font-size: 11px;
}
.cmd-coords {
  display: block;
  font-size: 10px;
  color: #7a6040;
}
.cmd-player {
  display: block;
  font-size: 10px;
  color: #8b4513;
}

.cmd-status {
  font-size: 11px;
  font-weight: bold;
}
.cmd-status--traveling { color: #8b1a1a; }
.cmd-status--returning { color: #2a5c10; }

.cmd-timer {
  display: block;
  font-weight: bold;
  color: #3b2200;
  font-size: 11px;
  margin-bottom: 3px;
}

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

/* ── Modal de erro ── */
.error-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.error-modal {
  background: #fff8e8;
  border: 2px solid #8b6535;
  border-radius: 4px;
  min-width: 340px;
  max-width: 480px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  font-family: Verdana, Arial, sans-serif;
  font-size: 12px;
  color: #3b2200;
}
.error-modal-header {
  background: #c8a460;
  border-bottom: 1px solid #8b6535;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  font-size: 13px;
}
.error-modal-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #3b2200;
  font-weight: bold;
}
.error-modal-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.error-modal-body p { margin: 0; }
.error-modal-path {
  display: block;
  background: #2a1a00;
  color: #ffcc88;
  padding: 6px 10px;
  border-radius: 3px;
  font-size: 11px;
  word-break: break-all;
  font-family: monospace;
}
.error-modal-hint {
  color: #7a6040;
  font-style: italic;
  font-size: 11px;
}
</style>
