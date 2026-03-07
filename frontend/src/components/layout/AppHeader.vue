<template>
  <div class="header-area">
    <AppPortalBar />
    <AppNavbar />
    <div class="header-banner">
      <img src="/header_banner_bg.jpg" alt="" class="banner-bg-img" />
      <div class="logo-container">
        <img src="/logo_tribal_wars.png" alt="Tribal Lords" class="logo-img" />
      </div>
    </div>
  </div>
</template>

<script setup>
import AppPortalBar from './AppPortalBar.vue'
import AppNavbar from './AppNavbar.vue'
</script>

<style scoped>
.header-area {
  position: relative;
  background-image: url('/village_scene.jpg');
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: left 25px;
  border-top: none;
}
.header-banner {
  position: relative;
  height: 145px;
  overflow: hidden;
  background: transparent;
}
.banner-bg-img {
  display: block;
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: auto;
  height: 80%;
  z-index: 1;
}
.logo-container {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -55%);
  z-index: 4;
  text-align: center;
}
.logo-img { max-height: 90px; display: block; }

@media (max-width: 768px) {
  .header-banner {
    height: 100px;
  }
  .logo-img {
    max-height: 70px;
  }
}
</style>
