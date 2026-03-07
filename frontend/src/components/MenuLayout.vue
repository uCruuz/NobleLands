<template>
  <div class="page-wrapper">
    <AppHeader />

    <div class="main-bg">
      <div v-if="showKnight" class="knight-anchor">
        <img src="/knight_character.png" alt="Cavaleiro" class="knight-img" />
      </div>

      <slot />

    </div>
  </div>
</template>

<script setup>
import AppHeader from './layout/AppHeader.vue'

defineProps({
  showKnight: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.page-wrapper {
  min-height: 100vh;
  background-color: #cbba99;
  font-family: Verdana, Arial, sans-serif;
  font-size: 13px;
  color: #000;
}
.main-bg {
  background-color: #cbba99;
  background-image: url('/village_scene.jpg');
  background-repeat: repeat-x;
  background-size: auto 120px;
  background-position: left -50px;
  padding: 0 0 30px;
  position: relative;
}
.knight-anchor {
  position: absolute;
  left: calc(50% - 490px);
  top: 0;
  z-index: 20;
  pointer-events: none;
}
.knight-img {
  height: 390px;
  object-fit: contain;
  display: block;
  margin-top: -75px;
}

@media (max-width: 768px) {
  .knight-anchor { display: none; }
  .main-bg {
    padding: 0 0 20px;
	background-position: left 0px;
	min-height: 120px;
  }
}
</style>
