<template>
  <component :is="currentScreen" />
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import VillageView  from './VillageView.vue'
import MainView     from './MainView.vue'
import BuildingView from './BuildingView.vue'
import BarracksView from './BarracksView.vue'
import SmithView    from './SmithView.vue'
import MapView      from './MapView.vue'
import PlaceView    from './PlaceView.vue'
import ReportsView  from './ReportsView.vue'

const route        = useRoute()
const villageStore = useVillageStore()
const authStore    = useAuthStore()

// Recupera worldId da URL após F5 — quando o store foi resetado
watch(() => route.query.world, (worldId) => {
  if (worldId && authStore.user && !villageStore.worldId) {
    villageStore.init(parseInt(worldId))
  }
}, { immediate: true })

const screens = {
  overview: VillageView,
  main:     MainView,
  barracks: BarracksView,
  wood:     BuildingView,
  stone:    BuildingView,
  iron:     BuildingView,
  farm:     BuildingView,
  storage:  BuildingView,
  stable:   BuildingView,
  market:   BuildingView,
  smith:    SmithView,
  map:      MapView,
  garage:   BuildingView,
  snob:     BuildingView,
  place:    PlaceView,
  statue:   BuildingView,
  hide:     BuildingView,
  church:   BuildingView,
  wall:     BuildingView,
  reports:  ReportsView,
}

const currentScreen = computed(() =>
  screens[route.query.screen] ?? VillageView
)
</script>
