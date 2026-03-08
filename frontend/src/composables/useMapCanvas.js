/**
 * useMapCanvas.js — canvas do mapa estilo Tribal Wars
 * + Smooth drag com sub-pixel offset
 * + Inertia ao soltar o mouse
 * + Terrain via shared/mapNoise.js (floresta, água, grama)
 * + Linhas animadas de comandos ativos (ataque/apoio)
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
  const canvasRef      = shallowRef(null)
  const loading        = ref(false)
  const tooltip        = ref(null)
  const clickedVillage = ref(null)
  const centerX        = ref(500)
  const centerY        = ref(500)
  const continent      = ref('K55')

  let offsetX = 0
  let offsetY = 0

  const villageMap = new Map()
  let lastFetch    = null

  // ── Estado de comandos ativos ─────────────────────────────────────────
  // Cada comando: { id, type, status, troops, origin: {x,y}, target: {x,y},
  //                sentAtMs, arrivesAtMs, returnsAtMs, slowestUnitImg }
  let activeCommands = []
  let animRaf        = null
  let dashOffset     = 0  // offset animado da linha pontilhada

  /**
   * Atualiza a lista de comandos ativos para renderização no mapa.
   * Chamado pelo MapView quando fetchCommands() retorna.
   *
   * @param {Array} commands - array no formato retornado por GET /api/commands
   * @param {Object} unitConfigs - UNIT_CONFIGS do shared/units.js (passado pelo MapView)
   */
  function setCommands(commands, unitConfigs) {
    activeCommands = (commands ?? []).map(cmd => {
      // Encontra a unidade mais lenta para exibir o ícone
      let slowestImg  = null
      let slowestSpeed = 0
      const troops = cmd.troops ?? {}
      for (const [key, qty] of Object.entries(troops)) {
        if (!qty || qty <= 0) continue
        const cfg = unitConfigs?.[key]
        if (!cfg) continue
        if (cfg.speed > slowestSpeed) {
          slowestSpeed = cfg.speed
          slowestImg   = cfg.img ? `/units/${cfg.img}` : null
        }
      }
      return { ...cmd, slowestImg }
    })

    // Garante que o loop de animação está rodando quando há comandos
    if (activeCommands.length > 0) startAnimLoop()
    else stopAnimLoop()
  }

  // ── Loop de animação para os comandos ─────────────────────────────────

  function startAnimLoop() {
    if (animRaf) return
    let last = performance.now()
    function frame(now) {
      const dt  = now - last
      last      = now
      // Avança o dash a ~20px/s
      dashOffset = (dashOffset + dt * 0.02) % 20
      draw()
      animRaf = requestAnimationFrame(frame)
    }
    animRaf = requestAnimationFrame(frame)
  }

  function stopAnimLoop() {
    if (animRaf) { cancelAnimationFrame(animRaf); animRaf = null }
  }

  // ── Converte coordenadas de mundo → pixel no canvas ───────────────────

  function worldToCanvas(wx, wy) {
    const ox_    = ((offsetX % TILE_W) + TILE_W) % TILE_W
    const oy_    = ((offsetY % TILE_H) + TILE_H) % TILE_H
    const tileOX = Math.floor(offsetX / TILE_W)
    const tileOY = Math.floor(offsetY / TILE_H)
    const startX = centerX.value - Math.floor(VIEW_W / 2) - tileOX
    const startY = centerY.value - Math.floor(VIEW_H / 2) - tileOY

    const px = COORD_PAD + (wx - startX) * TILE_W + ox_ + TILE_W / 2
    const py = (wy - startY) * TILE_H + oy_ + TILE_H / 2
    return { px, py }
  }

  // ── Desenha todas as setas de comando ─────────────────────────────────

  function drawCommands(ctx) {
    if (!activeCommands.length) return

    const now         = Date.now()
    const canvasW     = COORD_PAD + VIEW_W * TILE_W
    const canvasH     = VIEW_H * TILE_H + COORD_PAD
    const ICON_RADIUS = 10   // raio do círculo do ícone
    const ICON_SIZE   = 16   // tamanho do ícone dentro do círculo

    ctx.save()
    // Clip na área do mapa (sem coord bar)
    ctx.beginPath()
    ctx.rect(COORD_PAD, 0, VIEW_W * TILE_W, VIEW_H * TILE_H)
    ctx.clip()

    for (const cmd of activeCommands) {
      // Coordenadas de origem e destino
      const ox = cmd.origin.x
      const oy = cmd.origin.y
      const tx = cmd.target.x
      const ty = cmd.target.y

      const { px: x1, py: y1 } = worldToCanvas(ox, oy)
      const { px: x2, py: y2 } = worldToCanvas(tx, ty)

      // Progresso 0→1 de acordo com status
      let progress
      if (cmd.status === 'traveling') {
        const total   = cmd.arrivesAtMs - cmd.sentAtMs
        const elapsed = now - cmd.sentAtMs
        progress = Math.min(1, Math.max(0, elapsed / total))
      } else {
        // returning: anda de target → origin
        const total   = cmd.returnsAtMs - cmd.arrivesAtMs
        const elapsed = now - cmd.arrivesAtMs
        progress = Math.min(1, Math.max(0, elapsed / total))
      }

      // Para 'returning', inverte origem e destino visualmente
      const [sx, sy, ex, ey] = cmd.status === 'returning'
        ? [x2, y2, x1, y1]
        : [x1, y1, x2, y2]

      // Ponto atual da unidade
      const ux = sx + (ex - sx) * progress
      const uy = sy + (ey - sy) * progress

      // Cores por tipo
      const colorAttack  = cmd.type === 'attack'
        ? 'rgba(200, 40, 40, 0.85)'
        : 'rgba(60, 160, 60, 0.85)'
      const colorDashed  = cmd.type === 'attack'
        ? 'rgba(200, 40, 40, 0.40)'
        : 'rgba(60, 160, 60, 0.40)'

      // ── Linha sólida: origem → posição atual ─────────────────────────
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ux, uy)
      ctx.strokeStyle = colorAttack
      ctx.lineWidth   = 2
      ctx.setLineDash([])
      ctx.stroke()

      // ── Linha pontilhada animada: posição atual → destino ────────────
      ctx.beginPath()
      ctx.moveTo(ux, uy)
      ctx.lineTo(ex, ey)
      ctx.strokeStyle = colorDashed
      ctx.lineWidth   = 2
      ctx.setLineDash([6, 6])
      ctx.lineDashOffset = -dashOffset
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0

      // ── Ponto de destino (X para ataque, escudo para apoio) ──────────
      ctx.beginPath()
      ctx.arc(ex, ey, 5, 0, Math.PI * 2)
      ctx.fillStyle = colorAttack
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 1
      ctx.stroke()

      // ── Ícone da unidade mais lenta com círculo ───────────────────────
      // Círculo de fundo
      ctx.beginPath()
      ctx.arc(ux, uy, ICON_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = cmd.type === 'attack'
        ? 'rgba(140, 20, 20, 0.92)'
        : 'rgba(30, 100, 30, 0.92)'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // Ícone da unidade dentro do círculo
      if (cmd.slowestImg) {
        const unitImg = loadImg(cmd.slowestImg)
        if (unitImg.complete && unitImg.naturalWidth > 0) {
          const half = ICON_SIZE / 2
          ctx.save()
          // Clip circular para o ícone não vazar
          ctx.beginPath()
          ctx.arc(ux, uy, ICON_RADIUS - 1, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(unitImg, ux - half, uy - half, ICON_SIZE, ICON_SIZE)
          ctx.restore()
        }
      }
    }

    ctx.restore()
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

        if (hasWater(wx, wy)) {
          const wImg = loadImg('/map/see.png')
          if (wImg.complete && wImg.naturalWidth > 0) {
            ctx.drawImage(wImg, px, py, TILE_W, TILE_H)
          } else {
            ctx.fillStyle = '#4a6a9a'
            ctx.fillRect(px, py, TILE_W, TILE_H)
          }
          continue
        }

        const grassImg = loadImg(`/map/${getGrassTile(wx, wy)}.png`)
        if (grassImg.complete && grassImg.naturalWidth > 0) {
          ctx.drawImage(grassImg, px, py, TILE_W, TILE_H)
        } else {
          ctx.fillStyle = '#5a8a3a'
          ctx.fillRect(px, py, TILE_W, TILE_H)
        }

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

    // ── Coords ────────────────────────────────────────────────────────────
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

    // ── Comandos ativos: desenhados por cima de tudo ──────────────────────
    drawCommands(ctx)
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
        commitOffset()
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
      // Quando arrastando, o animLoop já está redrawando — não precisa draw() aqui
      if (!animRaf) draw()
      tooltip.value = null
      return
    }
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
      const screenCX = rect.left + tilePX + TILE_W / 2
      const screenCY = rect.top  + tilePY + TILE_H / 2
      clickedVillage.value = { screenCX, screenCY, village: v }
    } else {
      clickedVillage.value = null
    }
  }

  // ── Init / Destroy ────────────────────────────────────────────────────────

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
    stopInertia()
    stopAnimLoop()
    _drawCb = null
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
    setCommands,
    centerX, centerY, continent, loading, tooltip, clickedVillage,
    TILE_W, TILE_H, VIEW_W, VIEW_H, COORD_PAD,
  }
}
