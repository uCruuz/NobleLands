<template>
  <GameLayout>
    <div class="building-view">
      <div class="building-view-header">
        <h2 class="building-title">{{ buildingConfig?.name ?? buildingKey }}</h2>
        <span class="building-level" v-if="currentLevel > 0">Nível {{ currentLevel }}</span>
      </div>
      <div class="building-view-body">
        <p class="building-placeholder">Em construção — página do edifício <strong>{{ buildingConfig?.name ?? buildingKey }}</strong> em breve.</p>
        <button class="back-btn" @click="router.push(`/game?world=${villageStore.worldId}&village=${villageStore.village.id}&screen=village`)">← Voltar para a aldeia</button>
      </div>
    </div>
  </GameLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameLayout from '../components/GameLayout.vue'
import { useVillageStore } from '../stores/village.js'
import { BUILDING_CONFIGS } from '../../../shared/buildings.js'

const route        = useRoute()
const router       = useRouter()
const villageStore = useVillageStore()

const buildingKey    = computed(() => route.params.key)
const buildingConfig = computed(() => BUILDING_CONFIGS[buildingKey.value])
const currentLevel   = computed(() => villageStore.village?.buildings[buildingKey.value] ?? 0)
</script>

<style scoped>
.building-view {
  padding: 42px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 300px;
}

.building-view-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #8b6535;
  padding-bottom: 8px;
}

.building-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #3b2200;
  font-family: Verdana, Arial, sans-serif;
}

.building-level {
  background: #4a7c2f;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #2a5c10;
}

.building-view-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.building-placeholder {
  margin: 0;
  font-size: 13px;
  color: #7a6040;
  font-style: italic;
  font-family: Verdana, Arial, sans-serif;
}

.back-btn {
  background: #c8a460;
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 12px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  padding: 5px 14px;
  cursor: pointer;
  border-radius: 2px;
}
.back-btn:hover {
  background: #b8944a;
}
</style>
