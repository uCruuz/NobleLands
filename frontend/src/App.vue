<template>
  <RouterView />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth.js'
import { useVillageStore } from './stores/village.js'

const authStore    = useAuthStore()
const villageStore = useVillageStore()

onMounted(() => {
  // Se já há sessão salva (reload da página), restaura a aldeia do jogador
  if (authStore.user && !villageStore.village) {
    villageStore.init(authStore.user.id, authStore.user.username)
  }
})
</script>
