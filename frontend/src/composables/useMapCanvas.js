/**
 * useMapCanvas.js — canvas do mapa estilo Tribal Wars
 * + Smooth drag com sub-pixel offset
 * + Inertia ao soltar o mouse
 * + Terrain via shared/mapNoise.js (floresta, água, grama)
 */

import { ref, shallowRef } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'
import {
  getGrassTile,
  hasWater,
  hasForest,
  getForestKey,
} from '../../../shared/mapNoise.js'

const API       = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'
const TILE_W    = 53
const TILE_H    = 38
const VIEW_W    = 9
const VIEW_H    = 9
const COORD_PAD = 20
const BUFFER    = 4

// ── Village tile ──────────────────────────────────────────────────────────

function getVillageTile(points, playerId) {
  const tier = points < 200  ? 1
             : points < 500  ? 2
             : points < 1000 ? 3
             : points < 3000 ? 4
             : points < 7000 ? 5
             : 6
  return playerId ? `v${tier}` : `v${tier}_left`
}

export function getContinent(wx, wy) {
  const kx = Math.floor(wx / 100)
  const ky = Math.floor(wy / 100)
  return `K${ky}${kx}`
}

// ── Cache de imagens ──────────────────────────────────────────────────────

const imgCache = new Map()
let _drawCb = null

function loadImg(src) {
  if (imgCache.has(src)) return imgCache.get(src)
  const img = new Image()
  imgCache.set(src, img)
  img.onload = () => { if (_drawCb) _drawCb() }
  img.src = src
  return img
}

function preload() {
  for (let i = 1; i <= 4; i++) loadImg(`/map/gras${i}.png`)
  loadImg('/map/see.png')
  for (let i = 1; i <= 6; i++) {
    loadImg(`/map/v${i}.png`)
    loadImg(`/map/v${i}_left.png`)
  }
  for (let m = 0; m < 16; m++) {
    loadImg(`/map/forest${m.toString(2).padStart(4, '0')}.png`)
  }
}

// ── Composable ────────────────────────────────────────────────────────────

export function useMapCanvas(worldId) {
  const canvasRef = shallowRef(null)
  const loading   = ref(false)
  const tooltip   = ref(null)   // hover simples
  const clickedVillage = ref(null) // clique — abre popup
  const centerX   = ref(500)
  const centerY   = ref(500)
  const continent = ref('K55')

  let offsetX = 0
  let offsetY = 0

  const villageMap = new Map()
  let lastFetch = null

  function updateContinent() {
    continent.value = getContinent(centerX.value, centerY.value)
  }

  function getViewport() {
    const hw = Math.floor(VIEW_W / 2) + BUFFER
    const hh = Math.floor(VIEW_H / 2) + BUFFER
    return {
      x1: Math.max(0,   centerX.value - hw),
      y1: Math.max(0,   centerY.value - hh),
      x2: Math.min(999, centerX.value + hw),
      y2: Math.min(999, centerY.value + hh),
    }
  }

  async function fetchViewport() {
    const vp  = getViewport()
    const key = `${vp.x1},${vp.y1},${vp.x2},${vp.y2}`
    if (key === lastFetch) return
    lastFetch = key
    loading.value = true
    try {
      const auth = useAuthStore()
      const { data } = await axios.get(`${API}/map/${worldId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        params: vp,
      })
      for (const v of data.villages) villageMap.set(`${v.x},${v.y}`, v)
    } catch (e) {
      console.error('[Map] fetch error:', e)
    } finally {
      loading.value = false
      draw()
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  function draw() {
    const c = canvasRef.value
    if (!c) return
    const ctx = c.getContext('2d')

    const canvasW = COORD_PAD + VIEW_W * TILE_W
    const canvasH = VIEW_H * TILE_H + COORD_PAD
    c.width  = canvasW
    c.height = canvasH

    ctx.fillStyle = '#4a7a2a'
    ctx.fillRect(0, 0, canvasW, canvasH)

    // ── Fundo das coords antes do clip — tiles não sobrepõem ──────────────
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, COORD_PAD, VIEW_H * TILE_H)
    ctx.fillRect(0, VIEW_H * TILE_H, canvasW, COORD_PAD)

    const ox = ((offsetX % TILE_W) + TILE_W) % TILE_W
    const oy = ((offsetY % TILE_H) + TILE_H) % TILE_H

    const tileOffX = Math.floor(offsetX / TILE_W)
    const tileOffY = Math.floor(offsetY / TILE_H)
    const startX   = centerX.value - Math.floor(VIEW_W / 2) - tileOffX
    const startY   = centerY.value - Math.floor(VIEW_H / 2) - tileOffY

    const extraW = VIEW_W + 4
    const extraH = VIEW_H + 4

    ctx.save()
    ctx.beginPath()
    ctx.rect(COORD_PAD, 0, VIEW_W * TILE_W, VIEW_H * TILE_H)
    ctx.clip()

    for (let ty = -2; ty < extraH - 2; ty++) {
      for (let tx = -2; tx < extraW - 2; tx++) {
        const wx = startX + tx
        const wy = startY + ty
        const px = COORD_PAD + tx * TILE_W + ox
        const py = ty * TILE_H + oy

        if (wx < 0 || wx > 999 || wy < 0 || wy > 999) {
          ctx.fillStyle = '#2a4a1a'
          ctx.fillRect(px, py, TILE_W, TILE_H)
          continue
        }

        // ── Camada base: água ou grama ────────────────────────────────────
        if (hasWater(wx, wy)) {
          const wImg = loadImg('/map/see.png')
          if (wImg.complete && wImg.naturalWidth > 0) {
            ctx.drawImage(wImg, px, py, TILE_W, TILE_H)
          } else {
            ctx.fillStyle = '#4a6a9a'
            ctx.fillRect(px, py, TILE_W, TILE_H)
          }
          // Água não recebe floresta nem aldeia
          continue
        }

        // Grama base
        const grassImg = loadImg(`/map/${getGrassTile(wx, wy)}.png`)
        if (grassImg.complete && grassImg.naturalWidth > 0) {
          ctx.drawImage(grassImg, px, py, TILE_W, TILE_H)
        } else {
          ctx.fillStyle = '#5a8a3a'
          ctx.fillRect(px, py, TILE_W, TILE_H)
        }

        // ── Camada superior: aldeia ou floresta ───────────────────────────
        const village = villageMap.get(`${wx},${wy}`)
        if (village) {
          const vImg = loadImg(`/map/${getVillageTile(village.points, village.player_id)}.png`)
          if (vImg.complete && vImg.naturalWidth > 0) ctx.drawImage(vImg, px, py, TILE_W, TILE_H)
        } else if (hasForest(wx, wy)) {
          const fImg = loadImg(`/map/${getForestKey(wx, wy)}.png`)
          if (fImg.complete && fImg.naturalWidth > 0) ctx.drawImage(fImg, px, py, TILE_W, TILE_H)
        }
      }
    }

    ctx.restore()

    // ── Linhas de continente ──────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth   = 1.5
    for (let tx = -1; tx < extraW - 1; tx++) {
      const wx = startX + tx
      if (wx % 100 === 0) {
        const px = COORD_PAD + tx * TILE_W + ox
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, VIEW_H * TILE_H); ctx.stroke()
      }
    }
    for (let ty = -1; ty < extraH - 1; ty++) {
      const wy = startY + ty
      if (wy % 100 === 0) {
        const py = ty * TILE_H + oy
        ctx.beginPath(); ctx.moveTo(COORD_PAD, py); ctx.lineTo(COORD_PAD + VIEW_W * TILE_W, py); ctx.stroke()
      }
    }

    // ── Grid fino ─────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'
    ctx.lineWidth   = 0.5
    for (let tx = 0; tx <= VIEW_W; tx++) {
      const px = COORD_PAD + tx * TILE_W + ox
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, VIEW_H * TILE_H); ctx.stroke()
    }
    for (let ty = 0; ty <= VIEW_H; ty++) {
      const py = ty * TILE_H + oy
      ctx.beginPath(); ctx.moveTo(COORD_PAD, py); ctx.lineTo(COORD_PAD + VIEW_W * TILE_W, py); ctx.stroke()
    }

    // ── Coords: Y esquerda, X embaixo ─────────────────────────────────────

    ctx.fillStyle    = '#ffffff'
    ctx.font         = 'bold 9px Verdana, Arial, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign    = 'center'

    for (let ty = -1; ty < extraH - 1; ty++) {
      const wy = startY + ty
      const py = ty * TILE_H + oy + TILE_H / 2
      if (py >= 0 && py <= VIEW_H * TILE_H) ctx.fillText(wy, COORD_PAD / 2, py)
    }
    for (let tx = -1; tx < extraW - 1; tx++) {
      const wx = startX + tx
      const px = COORD_PAD + tx * TILE_W + ox + TILE_W / 2
      if (px >= COORD_PAD && px <= canvasW) {
        ctx.fillText(wx, px, VIEW_H * TILE_H + COORD_PAD / 2)
      }
    }
  }

  // ── Smooth Drag + Inertia ─────────────────────────────────────────────────

  let drag       = false
  let dragPX     = 0
  let dragPY     = 0
  let velX       = 0
  let velY       = 0
  let inertiaRaf = null
  let didMove    = false

  const FRICTION = 0.88
  const MIN_VEL  = 0.3

  function stopInertia() {
    if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null }
  }

  function startInertia() {
    stopInertia()
    function step() {
      if (Math.abs(velX) < MIN_VEL && Math.abs(velY) < MIN_VEL) {
      commitOffset()  // ← só commita quando para
      draw()
      fetchViewport()
      return
      }
      offsetX += velX; offsetY += velY
      velX *= FRICTION; velY *= FRICTION
      draw()
      inertiaRaf = requestAnimationFrame(step)
    }
    inertiaRaf = requestAnimationFrame(step)
  }

  function commitOffset() {
    const tilesX = Math.trunc(offsetX / TILE_W)
    const tilesY = Math.trunc(offsetY / TILE_H)
    if (tilesX !== 0 || tilesY !== 0) {
      centerX.value = Math.max(0, Math.min(999, centerX.value - tilesX))
      centerY.value = Math.max(0, Math.min(999, centerY.value - tilesY))
      offsetX -= tilesX * TILE_W; offsetY -= tilesY * TILE_H
      updateContinent(); fetchViewport()
    }
  }

  function onMouseDown(e) {
    stopInertia(); drag = true; didMove = false
    dragPX = e.clientX; dragPY = e.clientY; velX = 0; velY = 0
    canvasRef.value.style.cursor = 'grabbing'
  }

  function getVillageAt(clientX, clientY) {
    const c = canvasRef.value
    if (!c) return null
    const rect = c.getBoundingClientRect()
    const px   = clientX - rect.left - COORD_PAD
    const py   = clientY - rect.top
    if (px < 0 || py < 0 || py > VIEW_H * TILE_H) return null
    if (Math.floor(px / TILE_W) >= VIEW_W || Math.floor(py / TILE_H) >= VIEW_H) return null
    const ox_    = ((offsetX % TILE_W) + TILE_W) % TILE_W
    const oy_    = ((offsetY % TILE_H) + TILE_H) % TILE_H
    const tileOX = Math.floor(offsetX / TILE_W)
    const tileOY = Math.floor(offsetY / TILE_H)
    const wx = centerX.value - Math.floor(VIEW_W / 2) - tileOX + Math.floor((px - ox_ + TILE_W) / TILE_W) - 1
    const wy = centerY.value - Math.floor(VIEW_H / 2) - tileOY + Math.floor((py - oy_ + TILE_H) / TILE_H) - 1
    return villageMap.get(`${wx},${wy}`) ?? null
  }

  function onMouseMove(e) {
    if (drag) {
      didMove = true
      const dx = e.clientX - dragPX; const dy = e.clientY - dragPY
      dragPX = e.clientX; dragPY = e.clientY
      velX = velX * 0.6 + dx * 0.4; velY = velY * 0.6 + dy * 0.4
      offsetX += dx; offsetY += dy
      draw()
      tooltip.value = null
      return
    }
    // Hover
    const v = getVillageAt(e.clientX, e.clientY)
    tooltip.value = v ? { screenX: e.clientX, screenY: e.clientY, village: v } : null
  }

  function onMouseUp() {
    if (!drag) return
    drag = false
    canvasRef.value.style.cursor = 'grab'
    commitOffset()
    if (didMove) startInertia()
  }

  function onClick(e) {
    if (didMove) return
    const v = getVillageAt(e.clientX, e.clientY)
    if (v) {
      // Calcula centro exato do tile no canvas para posicionar popup sobre a aldeia
      const c    = canvasRef.value
      const rect = c.getBoundingClientRect()
      const ox_  = ((offsetX % TILE_W) + TILE_W) % TILE_W
      const oy_  = ((offsetY % TILE_H) + TILE_H) % TILE_H
      const tileOX = Math.floor(offsetX / TILE_W)
      const tileOY = Math.floor(offsetY / TILE_H)
      const startX = centerX.value - Math.floor(VIEW_W / 2) - tileOX
      const startY = centerY.value - Math.floor(VIEW_H / 2) - tileOY
      const tilePX = COORD_PAD + (v.x - startX) * TILE_W + ox_
      const tilePY = (v.y - startY) * TILE_H + oy_
      // Centro do tile em coordenadas da tela
      const screenCX = rect.left + tilePX + TILE_W / 2
      const screenCY = rect.top  + tilePY + TILE_H / 2
      clickedVillage.value = { screenCX, screenCY, village: v }
    } else {
      clickedVillage.value = null
    }
  }

  // ── Init / Destroy ────────────────────────────────────────────────────────

  function init(el, sx, sy) {
    canvasRef.value = el
    centerX.value   = sx ?? 500
    centerY.value   = sy ?? 500
    offsetX = 0; offsetY = 0
    updateContinent()
    _drawCb = draw
    el.style.cursor = 'grab'; el.style.display = 'block'
    preload(); fetchViewport()
    el.addEventListener('mousedown',  onMouseDown)
    el.addEventListener('mousemove',  onMouseMove)
    el.addEventListener('mouseup',    onMouseUp)
    el.addEventListener('mouseleave', onMouseUp)
    el.addEventListener('mouseleave', () => { tooltip.value = null })
    el.addEventListener('click',      onClick)
  }

  function destroy(el) {
    stopInertia(); _drawCb = null
    if (!el) return
    el.removeEventListener('mousedown',  onMouseDown)
    el.removeEventListener('mousemove',  onMouseMove)
    el.removeEventListener('mouseup',    onMouseUp)
    el.removeEventListener('mouseleave', onMouseUp)
    el.removeEventListener('click',      onClick)
  }

  function moveTo(x, y) {
    stopInertia(); offsetX = 0; offsetY = 0
    centerX.value = Math.max(0, Math.min(999, x))
    centerY.value = Math.max(0, Math.min(999, y))
    updateContinent(); fetchViewport()
  }

  function applyVillageUpdate(village) {
    villageMap.set(`${village.x},${village.y}`, village)
    draw()
  }

  return {
    init, destroy, moveTo, applyVillageUpdate, fetchViewport,
    centerX, centerY, continent, loading, tooltip, clickedVillage,
    TILE_W, TILE_H, VIEW_W, VIEW_H, COORD_PAD,
  }
}
