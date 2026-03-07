/**
 * stores/mapStore.js — estado global do mapa
 */

import { defineStore } from 'pinia'

const MAX_NOTIFICATIONS = 5

export const useMapStore = defineStore('map', {
  state: () => ({
    currentWorldId: null,
    worldConfig:    null,
    worldStats:     null,

    villages:      new Map(),
    highlights:    new Map(),
    notifications: [],
    needsRedraw:   false,

    // Último village recebido via socket — usado pelo watch do MapView
    lastUpdate: null,
  }),

  getters: {
    villageList: (state) => Array.from(state.villages.values()),
    villageById: (state) => (id) => state.villages.get(id)
  },

  actions: {
    setCurrentWorld(worldId) {
      this.currentWorldId = worldId
      if (!worldId) {
        this.villages.clear()
        this.highlights.clear()
        this.notifications = []
        this.lastUpdate    = null
      }
    },

    setWorldConfig(config)  { this.worldConfig = config },
    setWorldStats(stats)    { this.worldStats  = stats  },

    setViewportVillages(villages) {
      for (const v of villages) this.villages.set(v.id, v)
      this.needsRedraw = true
    },

    applyVillageUpdate({ type, village }) {
      if (!village) return

      this.villages.set(village.id, village)

      this.highlights.set(village.id, {
        type,
        expiresAt: Date.now() + 3000
      })

      const messages = {
        assigned:  `${village.name} foi atribuída a ${village.player_name ?? 'um jogador'}`,
        conquered: `${village.name} foi conquistada por ${village.player_name ?? 'desconhecido'}`,
        nobled:    `${village.name} foi nobilizada por ${village.player_name ?? 'desconhecido'}`,
        renamed:   `Aldeia renomeada para ${village.name}`,
        points:    null,
      }

      const message = messages[type]
      if (message) {
        this.addNotification({
          type,
          message,
          coords: { x: village.x, y: village.y },
          sentAt: Date.now()
        })
      }

      // Atualiza lastUpdate — dispara o watch no MapView
      this.lastUpdate  = { ...village, _ts: Date.now() }
      this.needsRedraw = true
    },

    addNotification(notification) {
      this.notifications.unshift(notification)
      if (this.notifications.length > MAX_NOTIFICATIONS) {
        this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS)
      }
    },

    clearNotifications() { this.notifications = [] },

    pruneHighlights() {
      const now = Date.now()
      for (const [id, h] of this.highlights) {
        if (now > h.expiresAt) this.highlights.delete(id)
      }
    },

    markRedrawn() { this.needsRedraw = false }
  }
})
