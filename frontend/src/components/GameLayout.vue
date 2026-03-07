<template>
  <div class="game-wrapper">

    <!-- ── Topbar ─────────────────────────────────────────────── -->
    <div class="topbar">
      <img src="/topbar-left.png" class="topbar-edge topbar-edge-left" alt="" />
      <div class="topbar-inner">
        <button
          v-for="btn in navButtons"
          :key="btn.label"
          class="top-btn"
          @click="btn.action && btn.action()"
        >
          <span class="top-btn-left"></span>
          <span class="top-btn-mid">{{ btn.label }}</span>
          <span class="top-btn-right"></span>
        </button>
      </div>
      <img src="/topbar-right.png" class="topbar-edge topbar-edge-right" alt="" />
    </div>

    <!-- ── Conteúdo principal ─────────────────────────────────── -->
    <div class="game-bg">
      <div class="game-content-wrapper">

        <!-- Cantos -->
        <img src="/border_corner.png" class="border-corner corner-bl" alt="" />
        <img src="/border_corner.png" class="border-corner corner-br" alt="" />

        <!-- Bordas laterais -->
        <div class="border-left-edge">
          <img src="/border_left.png" class="border-edge-img" alt="" />
        </div>
        <div class="border-right-edge">
          <img src="/border_left.png" class="border-edge-img" alt="" />
        </div>

        <!-- Borda inferior -->
        <div class="border-bottom-edge">
          <img src="/border_top.png" class="border-edge-img" alt="" />
        </div>

        <!-- ── Statusbar ── -->
        <div class="statusbar-row">

          <div class="statusbar-box">
            <span class="sb-left-cap"></span>
            <span class="sb-mid">
              <i class="icon" :style="iconStyle('aldeia')"></i>
              <button class="village-name" @click="router.push(`/game?world=${villageStore.worldId}&village=${village.id}&screen=overview`)">{{ villageName }}</button>
              <span class="village-coords">({{ coords.x }}|{{ coords.y }}) K{{ continent }}</span>
            </span>
            <span class="sb-right-cap"></span>
          </div>

          <div class="statusbar-box statusbar-box-center">
            <span class="sb-left-cap"></span>
            <span class="sb-mid">
              <span class="res-item">
                <i class="icon" :style="iconStyle('madeira')"></i>
                <span class="res-value">{{ Math.floor(village.resources.wood.current) }}</span>
              </span>
              <span class="statusbar-separator1"></span>
              <span class="res-item">
                <i class="icon" :style="iconStyle('argila')"></i>
                <span class="res-value">{{ Math.floor(village.resources.stone.current) }}</span>
              </span>
              <span class="statusbar-separator1"></span>
              <span class="res-item">
                <i class="icon" :style="iconStyle('ferro')"></i>
                <span class="res-value">{{ Math.floor(village.resources.iron.current) }}</span>
              </span>
              <span class="statusbar-separator1"></span>
              <span class="res-item">
                <i class="icon" :style="iconStyle('armazem')"></i>
                <span class="res-value">{{ storageCapacity }}</span>
              </span>
              <span class="statusbar-separator1"></span>
              <span class="res-item">
                <i class="icon" :style="iconStyle('populacao')"></i>
                <span class="res-value">{{ populationUsed }}/{{ farmCapacity }}</span>
              </span>
            </span>
            <span class="sb-right-cap"></span>
          </div>

          <div class="statusbar-box">
            <span class="sb-left-cap"></span>
            <span class="sb-mid">
              <button class="icon-btn" title="Inventário"><i class="icon" :style="iconStyle('inventario')"></i></button>
              <button class="icon-btn" title="Bandeiras"><i class="icon" :style="iconStyle('bandeiras')"></i></button>
              <button class="icon-btn" title="Paladino"><i class="icon" :style="iconStyle('paladino')"></i></button>
            </span>
            <span class="sb-right-cap"></span>
          </div>

        </div>

        <!-- ── Conteúdo da view ── -->
        <div class="game-content">
          <div class="content-box">
            <slot />
          </div>
          <div class="server-time-bar">
            Hora do servidor: {{ serverTime }}
          </div>
        </div>

      </div>
    </div>

    <!-- ── Footer ────────────────────────────────────────────── -->
    <div class="game-footer">
      <slot name="footer">
        <span>Mundo 1</span>
        <span class="footer-sep">-</span>
        <a href="#">Comunidade do Fórum</a>
        <span class="footer-sep">-</span>
        <a href="#">Ajuda</a>
        <span class="footer-sep">-</span>
        <a href="#" @click.prevent="handleLogout">Sair</a>
      </slot>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVillageStore } from '../stores/village.js'
import { useAuthStore } from '../stores/auth.js'
import { useIcons } from '../composables/useIcons.js'

const router       = useRouter()
const villageStore = useVillageStore()
const authStore    = useAuthStore()
const village      = computed(() => villageStore.village)

const villageName     = computed(() => village.value.name)
const coords          = computed(() => village.value.coords)
const storageCapacity = computed(() => villageStore.storageCapacity)
const farmCapacity    = computed(() => villageStore.farmCapacity)
const populationUsed  = computed(() => villageStore.populationUsed)

const continent = computed(() => {
  const kx = Math.floor(coords.value.x / 100)
  const ky = Math.floor(coords.value.y / 100)
  return `${ky}${kx}`
})

const { iconStyle } = useIcons()

const serverTime = ref('')

function updateServerTime() {
  const now = new Date()
  serverTime.value = now.toLocaleTimeString('pt-BR') + ' ' + now.toLocaleDateString('pt-BR')
}

let clockInterval = null
onMounted(() => {
  updateServerTime()
  clockInterval = setInterval(updateServerTime, 1000)
})
onUnmounted(() => clearInterval(clockInterval))

function handleLogout() {
  router.push('/logged')
}

const navButtons = [
  { label: 'Visualização geral', action: () => router.push(`/game?world=${villageStore.worldId}&village=${village.value.id}&screen=overview`) },
  { label: 'Mapa',               action: () => router.push(`/game?world=${villageStore.worldId}&village=${village.value.id}&screen=map`) },
  { label: 'Relatórios',         action: null },
  { label: 'Mensagens',          action: null },
  { label: 'Classificação',      action: null },
  { label: 'Tribo',              action: null },
  { label: 'Perfil',             action: null },
  { label: 'Configurações',      action: null },
]
</script>

<style scoped>
.game-wrapper {
  background-image: url('/bg-image.jpg');
  background-repeat: repeat;
  background-size: auto;
  font-family: Verdana, Arial, sans-serif;
  font-size: 12px;
  color: #000;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  background-image: url('/topbar-main.jpg');
  background-repeat: repeat-x;
  background-size: auto 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.topbar-edge { position: absolute; top: 0; height: 100%; width: auto; z-index: 10; pointer-events: none; }
.topbar-edge-left  { left: 0; }
.topbar-edge-right { right: 0; }
.topbar-inner { display: flex; align-items: center; gap: 2px; height: 100%; }

.top-btn {
  display: inline-flex;
  align-items: stretch;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: 0;
  height: 35px;
}
.top-btn-left,
.top-btn-right {
  display: block;
  width: 15px;
  flex-shrink: 0;
  background-image: url('/topbutton-left.png');
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 100% 200%;
  align-self: stretch;
}
.top-btn-right { transform: scaleX(-1); }
.top-btn-mid {
  flex: 1;
  display: block;
  background-image: url('/topbutton-right.png');
  background-repeat: repeat-x;
  background-position: 0 0;
  background-size: auto 200%;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  padding: 0 10px;
  text-align: center;
  line-height: 28px;
  white-space: nowrap;
}
.top-btn:hover .top-btn-mid,
.top-btn:active .top-btn-mid { background-position: 0 100%; }
.top-btn:hover .top-btn-left,
.top-btn:active .top-btn-left { background-position: 0 100%; }
.top-btn:hover .top-btn-right,
.top-btn:active .top-btn-right { background-position: 0 100%; }

.game-bg {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0 0 20px;
}
.game-content-wrapper {
  position: relative;
  width: 940px;
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
}

.statusbar-row {
  position: absolute;
  top: 8px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: stretch;
  height: 26px;
  gap: 6px;
  z-index: 5;
}
.statusbar-box { display: inline-flex; align-items: stretch; height: 26px; white-space: nowrap; }
.statusbar-box-center { margin-left: auto; }

.sb-left-cap {
  display: block; width: 6px; flex-shrink: 0;
  background-image: url('/statusbar-left.jpg');
  background-repeat: no-repeat; background-position: left center; background-size: auto 100%;
}
.sb-right-cap {
  display: block; width: 6px; flex-shrink: 0;
  background-image: url('/statusbar-right.jpg');
  background-repeat: no-repeat; background-position: right center; background-size: auto 100%;
}
.sb-mid {
  display: flex; align-items: center; gap: 4px; padding: 0 8px;
  background-image: url('/statusbar-center.jpg');
  background-repeat: repeat-x; background-size: auto 100%;
}

.village-name {
  font-size: 12px; font-weight: bold; color: #3b2200;
  background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
}
.village-name:hover { color: #e33e0f; }
.village-coords { font-size: 11px; font-weight: bold; color: #000; }

.res-item { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: bold; color: #3b2200; }
.res-value { min-width: 30px; }

.statusbar-separator1 {
  display: inline-block;
  background-image: url('/statusbar-separator1.jpg');
  background-repeat: no-repeat; background-size: auto 100%;
  width: 8px; height: 100%; flex-shrink: 0;
}
.icon-btn { background: none; border: none; padding: 2px; cursor: pointer; display: flex; align-items: center; }
.icon-btn:hover { opacity: 0.8; }

.game-content {
  background-image: url('/bg-shaded.webp');
  background-repeat: repeat; background-size: auto;
  margin: 0 20px;
}
.content-box {
  background-image: url('/main_bg.webp');
  background-repeat: repeat; background-size: auto;
  padding: 8px;
  border: 1px solid #7d510f;
  outline: 1px solid #7d510f; outline-offset: -1px;
  margin: 42px 0 0;
}
.server-time-bar { text-align: right; font-size: 10px; color: #7a6040; padding: 4px 8px; }

.border-corner { position: absolute; width: 20px; height: 20px; z-index: 10; }
.corner-bl { bottom: 0; left: 0; transform: scaleY(-1); }
.corner-br { bottom: 0; right: 0; transform: scale(-1, -1); }

.border-left-edge,
.border-right-edge { position: absolute; top: 0; bottom: 20px; width: 20px; overflow: hidden; z-index: 9; }
.border-left-edge  { left: 0; }
.border-right-edge { right: 0; transform: scaleX(-1); }

.border-bottom-edge {
  position: absolute; left: 20px; right: 20px; height: 20px;
  bottom: 0; overflow: hidden; z-index: 9; transform: scaleY(-1);
}
.border-edge-img { display: block; width: 100%; height: 100%; object-fit: fill; }

.game-footer {
  background-image: url('/footer-bg.png');
  background-repeat: repeat-x; background-size: 100 100%;
  height: 30px; display: flex; align-items: center; justify-content: center;
  gap: 6px; font-size: 13px; color: #d4b483;
}
.game-footer a { color: #8b4513; text-decoration: none; font-weight: bold; }
.game-footer a:hover { text-decoration: underline; }
.footer-sep { color: #8b6535; }
</style>
