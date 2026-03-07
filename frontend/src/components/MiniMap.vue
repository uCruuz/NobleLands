<template>
  <div class="minimap-wrapper">

    <!-- Botão cima -->
    <button class="minimap-arrow-btn" @click="navigate(0, -STEP)">
      <span class="icon-rotated-up"><span :style="iconStyle('seta_direita')" /></span>
    </button>

    <div class="minimap-mid-row">
      <!-- Botão esquerda -->
      <button class="minimap-arrow-btn minimap-arrow-side" @click="navigate(-STEP, 0)">
        <span :style="iconStyle('seta_esquerda')" />
      </button>

      <!-- Canvas -->
      <div class="minimap-canvas-box">
        <canvas
          ref="miniCanvasEl"
          :width="CANVAS_SIZE"
          :height="CANVAS_SIZE"
          class="minimap-canvas"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @click="onClick"
        />
      </div>

      <!-- Botão direita -->
      <button class="minimap-arrow-btn minimap-arrow-side" @click="navigate(STEP, 0)">
        <span :style="iconStyle('seta_direita')" />
      </button>
    </div>

    <!-- Botão baixo -->
    <button class="minimap-arrow-btn" @click="navigate(0, STEP)">
      <span class="icon-rotated-down"><span :style="iconStyle('seta_direita')" /></span>
    </button>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { hasForest, hasWater } from '../../../shared/mapNoise.js'
import { useIcons } from '../composables/useIcons.js'
import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  centerX: { type: Number, required: true },
  centerY: { type: Number, required: true },
  worldId: { type: Number, required: true },
})

const emit = defineEmits(['moveTo'])

// ── Constantes — customize aqui ───────────────────────────────────────────
const TILE_PX     = 5                    // pixels por tile (aumente para zoom maior)
const TILES       = 50                   // tiles visíveis NxN (diminua para zoom maior)
const HALF        = Math.floor(TILES / 2)
const CANVAS_SIZE = TILES * TILE_PX      // 50 * 5 = 250px
const STEP        = 10                   // tiles movidos por clique nos botões

// Cores
const COLOR_BG       = '#58761b'
const COLOR_FOREST   = '#2d5a1a'
const COLOR_WATER    = '#4a6a9a'
const COLOR_PLAYER   = '#823c0a'
const COLOR_BARB     = '#969696'
const COLOR_GRID     = '#2d5a1a'
const COLOR_K        = '#000000'
const COLOR_VIEWPORT = '#ffffff'

// Tiles visíveis no mapa grande
const VIEW_TILES = 9

const miniCanvasEl  = ref(null)
const authStore     = useAuthStore()
const API           = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'
const { iconStyle } = useIcons()

let miniVillages = []

// ── Busca aldeias ─────────────────────────────────────────────────────────
async function fetchMiniVillages() {
  const x1 = Math.max(0,   props.centerX - HALF)
  const y1 = Math.max(0,   props.centerY - HALF)
  const x2 = Math.min(999, props.centerX + HALF)
  const y2 = Math.min(999, props.centerY + HALF)
  try {
    const { data } = await axios.get(`${API}/worlds/${props.worldId}/map`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      params: { x1, y1, x2, y2 },
    })
    miniVillages = data.villages ?? []
  } catch (e) {
    console.error('[MiniMap] fetch error:', e)
  }
  draw()
}

// ── Draw ──────────────────────────────────────────────────────────────────
function draw() {
  const c = miniCanvasEl.value
  if (!c) return
  const ctx = c.getContext('2d')

  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  const startX = props.centerX - HALF
  const startY = props.centerY - HALF

  const villageMap = new Map()
  for (const v of miniVillages) villageMap.set(`${v.x},${v.y}`, v)

  // ── Terrain + aldeias ────────────────────────────────────────────────────
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const wx = startX + tx
      const wy = startY + ty
      const px = tx * TILE_PX
      const py = ty * TILE_PX

      if (wx < 0 || wx > 999 || wy < 0 || wy > 999) continue

      const village = villageMap.get(`${wx},${wy}`)
      if (village) {
        ctx.fillStyle = village.player_id ? COLOR_PLAYER : COLOR_BARB
        ctx.fillRect(px, py, TILE_PX, TILE_PX)
      } else if (hasWater(wx, wy)) {
        ctx.fillStyle = COLOR_WATER
        ctx.fillRect(px, py, TILE_PX, TILE_PX)
      } else if (hasForest(wx, wy)) {
        ctx.fillStyle = COLOR_FOREST
        ctx.fillRect(px, py, TILE_PX, TILE_PX)
      }
    }
  }

  // ── Grid de tiles ────────────────────────────────────────────────────────
  ctx.strokeStyle = COLOR_GRID
  ctx.lineWidth   = 0.5
  ctx.globalAlpha = 0.35
  for (let t = 0; t <= TILES; t++) {
    const p = t * TILE_PX
    ctx.beginPath(); ctx.moveTo(p, 0);         ctx.lineTo(p, CANVAS_SIZE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p);         ctx.lineTo(CANVAS_SIZE, p); ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ── Grid de chunks (5 tiles) ─────────────────────────────────────────────
  ctx.strokeStyle = COLOR_GRID
  ctx.lineWidth   = 1
  ctx.globalAlpha = 0.6
  const chunks = Math.floor(TILES / 5)
  for (let ch = 0; ch <= chunks; ch++) {
    const p = ch * 5 * TILE_PX
    ctx.beginPath(); ctx.moveTo(p, 0);         ctx.lineTo(p, CANVAS_SIZE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p);         ctx.lineTo(CANVAS_SIZE, p); ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ── Divisões de K ────────────────────────────────────────────────────────
  ctx.strokeStyle = COLOR_K
  ctx.lineWidth   = 1.5
  for (let t = 0; t < TILES; t++) {
    if ((startX + t) % 100 === 0) {
      const p = t * TILE_PX
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CANVAS_SIZE); ctx.stroke()
    }
    if ((startY + t) % 100 === 0) {
      const p = t * TILE_PX
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CANVAS_SIZE, p); ctx.stroke()
    }
  }

  // ── Viewport invertido — área fora escurecida ─────────────────────────────
  const vpLeft = (props.centerX - startX - Math.floor(VIEW_TILES / 2)) * TILE_PX
  const vpTop  = (props.centerY - startY - Math.floor(VIEW_TILES / 2)) * TILE_PX
  const vpW    = VIEW_TILES * TILE_PX
  const vpH    = VIEW_TILES * TILE_PX

  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0,           0,            CANVAS_SIZE, vpTop)
  ctx.fillRect(0,           vpTop + vpH,  CANVAS_SIZE, CANVAS_SIZE - vpTop - vpH)
  ctx.fillRect(0,           vpTop,        vpLeft,      vpH)
  ctx.fillRect(vpLeft + vpW, vpTop,       CANVAS_SIZE - vpLeft - vpW, vpH)

  ctx.strokeStyle = COLOR_VIEWPORT
  ctx.lineWidth   = 1.5
  ctx.strokeRect(vpLeft, vpTop, vpW, vpH)
}

// ── Navegação pelos botões ────────────────────────────────────────────────
function navigate(dx, dy) {
  emit('moveTo',
    Math.max(0, Math.min(999, props.centerX + dx)),
    Math.max(0, Math.min(999, props.centerY + dy))
  )
}

// ── Drag / Click ──────────────────────────────────────────────────────────
let dragging = false
let didDrag  = false

function canvasToWorld(cx, cy) {
  const startX = props.centerX - HALF
  const startY = props.centerY - HALF
  return {
    x: Math.max(0, Math.min(999, startX + Math.floor(cx / TILE_PX))),
    y: Math.max(0, Math.min(999, startY + Math.floor(cy / TILE_PX))),
  }
}

let lastMouseX = 0
let lastMouseY = 0

function onMouseDown(e) {
  dragging = true
  didDrag  = false
  lastMouseX = e.clientX
  lastMouseY = e.clientY
}
function onMouseMove(e) {
  if (!dragging) return
  didDrag = true

  const dx = e.clientX - lastMouseX
  const dy = e.clientY - lastMouseY
  lastMouseX = e.clientX
  lastMouseY = e.clientY

  // Converte delta de pixels para tiles e inverte
  const tilesDx = Math.round(dx / TILE_PX)
  const tilesDy = Math.round(dy / TILE_PX)

  if (tilesDx !== 0 || tilesDy !== 0) {
    emit('moveTo',
      Math.max(0, Math.min(999, props.centerX - tilesDx)),
      Math.max(0, Math.min(999, props.centerY - tilesDy))
    )
  }
}
function onMouseUp()  { dragging = false }

function onClick(e) {
  if (didDrag) return
  const rect = miniCanvasEl.value.getBoundingClientRect()
  const { x, y } = canvasToWorld(e.clientX - rect.left, e.clientY - rect.top)
  emit('moveTo', x, y)
}

// ── Watch ─────────────────────────────────────────────────────────────────
watch(() => [props.centerX, props.centerY], () => {
  fetchMiniVillages()
})

onMounted(() => {
  fetchMiniVillages()
})
</script>

<style scoped>
.minimap-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f4e4bc;
  border: 1px solid #8c5f0d;
  padding: 0 0;
  width: fit-content;
}

.minimap-arrow-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

.minimap-mid-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.minimap-canvas-box {
  border: 1px solid #8c5f0d;
  line-height: 0;
}

.minimap-canvas {
  display: block;
  cursor: crosshair;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.minimap-arrow-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}
.minimap-arrow-btn:hover { opacity: 1; }
.icon-rotated-up   { display: inline-flex; transform: rotate(-90deg); }
.icon-rotated-down { display: inline-flex; transform: rotate(90deg); }
</style>
