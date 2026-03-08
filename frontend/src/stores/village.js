import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './auth.js'
import {
  getResourceProduction,
  getStorageCapacity,
  getFarmCapacity,
  getHidingCapacity,
  getBuildingCost,
  getBuildingTime,
  BUILDING_CONFIGS
} from '../../../shared/buildings.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

// ── Cache localStorage ─────────────────────────────────────────
function cacheKey(worldId) { return `tl_village_${worldId}` }

function saveCache(worldId, data) {
  try { localStorage.setItem(cacheKey(worldId), JSON.stringify(data)) } catch {}
}

function loadCache(worldId) {
  try { return JSON.parse(localStorage.getItem(cacheKey(worldId)) || 'null') } catch { return null }
}
// ──────────────────────────────────────────────────────────────

function emptyVillage() {
  return {
    id: null,
    name: '',
    points: 0,
    coords: { x: 500, y: 500 },
    resources: {
      wood:  { current: 0 },
      stone: { current: 0 },
      iron:  { current: 0 }
    },
    buildings: {
      main:0, barracks:0, stable:0, garage:0, snob:0, smith:0,
      place:0, statue:0, market:0, wood:0, stone:0, iron:0,
      farm:1, storage:1, hide:0, wall:0, church:0
    },
    buildQueue: []
  }
}

export const useVillageStore = defineStore('village', {
  state: () => ({
    worldId:         null,
    village:         emptyVillage(),
    loading:         false,
    _serverSnapshot: null
  }),

  getters: {
    woodProduction:  (state) => getResourceProduction(state.village.buildings.wood),
    stoneProduction: (state) => getResourceProduction(state.village.buildings.stone),
    ironProduction:  (state) => getResourceProduction(state.village.buildings.iron),
    storageCapacity: (state) => getStorageCapacity(state.village.buildings.storage),
    farmCapacity:    (state) => getFarmCapacity(state.village.buildings.farm),
    hidingCapacity:  (state) => getHidingCapacity(state.village.buildings.hide),

    populationUsed: (state) => {
      let total = 0
      for (const [key, level] of Object.entries(state.village.buildings)) {
        if (level <= 0) continue
        const cost = getBuildingCost(key, level)
        if (cost) total += cost.pop
      }
      return total
    },

    currentBuild:     (state) => state.village.buildQueue[0] || null,
    isBuildQueueFull: (state) => state.village.buildQueue.length >= 2
  },

  actions: {
    async fetchVillage() {
      if (!this.worldId) return
      const auth = useAuthStore()
      this.loading = true
      try {
        const { data } = await axios.get(`${API}/village`, {
          headers: { Authorization: `Bearer ${auth.token}` },
          params:  { worldId: this.worldId }
        })
        this._applyServerState(data)
        saveCache(this.worldId, data) // ← salva cache após resposta do servidor
      } catch (e) {
        console.error('Erro ao carregar aldeia:', e)
      } finally {
        this.loading = false
      }
    },

    _applyServerState(data) {
      this.village.id         = data.id
      this.village.name       = data.name
      this.village.points     = data.points
      this.village.coords     = data.coords
      this.village.buildings  = data.buildings
      this.village.buildQueue = data.buildQueue

      this._serverSnapshot = {
        wood:        data.resources.wood,
        stone:       data.resources.stone,
        iron:        data.resources.iron,
        wood_rate:   data.resources.wood_rate,
        stone_rate:  data.resources.stone_rate,
        iron_rate:   data.resources.iron_rate,
        capacity:    data.resources.capacity,
        received_at: Date.now() / 1000
      }

      this.village.resources.wood.current  = data.resources.wood
      this.village.resources.stone.current = data.resources.stone
      this.village.resources.iron.current  = data.resources.iron
    },

    updateResources() {
      if (!this._serverSnapshot) return
      const snap    = this._serverSnapshot
      const cap     = snap.capacity
      const elapsed = (Date.now() / 1000) - snap.received_at

      this.village.resources.wood.current  = Math.min(cap, snap.wood  + snap.wood_rate  * (elapsed / 3600))
      this.village.resources.stone.current = Math.min(cap, snap.stone + snap.stone_rate * (elapsed / 3600))
      this.village.resources.iron.current  = Math.min(cap, snap.iron  + snap.iron_rate  * (elapsed / 3600))
    },

    processBuildQueue() {
      const now     = Date.now()
      let   changed = false

      while (this.village.buildQueue.length > 0 && this.village.buildQueue[0].endsAt <= now) {
        const job = this.village.buildQueue.shift()
        this.village.buildings[job.buildingKey] = job.targetLevel
        changed = true
      }

      if (changed) this.fetchVillage()
    },

    async startBuild(buildingKey) {
      const auth = useAuthStore()
      try {
        await axios.post(
          `${API}/village/build`,
          { buildingKey },
          {
            headers: { Authorization: `Bearer ${auth.token}` },
            params:  { worldId: this.worldId }
          }
        )
        await this.fetchVillage()
        return null
      } catch (e) {
        return e.response?.data?.error || 'Erro ao iniciar construção.'
      }
    },

    async cancelBuild(buildingKey) {
      const auth = useAuthStore()
      try {
        await axios.post(
          `${API}/village/cancel`,
          { buildingKey },
          {
            headers: { Authorization: `Bearer ${auth.token}` },
            params:  { worldId: this.worldId }
          }
        )
        await this.fetchVillage()
        return null
      } catch (e) {
        return e.response?.data?.error || 'Erro ao cancelar construção.'
      }
    },

    async init(worldId) {
      if (worldId) this.worldId = worldId

      // ── Carrega cache imediatamente para evitar tela vazia ──
      const cached = loadCache(this.worldId)
      if (cached) {
        this._applyServerState(cached)
      }

      // ── Busca servidor em background (atualiza silenciosamente) ──
      await this.fetchVillage()
    },

    getBuildInfo(buildingKey) {
      const config = BUILDING_CONFIGS[buildingKey]
      if (!config) return null
      const currentLevel = this.village.buildings[buildingKey] ?? 0
      const nextLevel    = currentLevel + 1
      if (nextLevel > config.maxLevel) return null
      const cost = getBuildingCost(buildingKey, nextLevel)
      const time = getBuildingTime(buildingKey, nextLevel, this.village.buildings.main)
      return { currentLevel, nextLevel, cost, time, config }
    },

    renameVillage(newName) {
      if (newName && newName.trim().length >= 2) {
        this.village.name = newName.trim()
      }
    }
  }
})