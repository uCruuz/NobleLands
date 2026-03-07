<template>
  <MenuLayout>
    <TwBorderBox class="main-container-wrapper">
      <div class="divider-v">
        <img src="/divider_top.png" class="divider-top-img" alt="" />
        <div class="divider-middle"></div>
        <img src="/divider_top.png" class="divider-bottom-img" alt="" />
      </div>

      <div class="main-container">
        <!-- Left: Info + Screenshots -->
        <div class="left-panel">
          <div class="left-panel-content">
            <h2 class="panel-title">Tribal Front</h2>
            <p class="panel-desc">
              Tribal Front é um jogo online de navegador (browser) ambientado na idade média.
              Cada jogador é senhor de uma pequena aldeia, a qual deve ajudar a ganhar poder e glória.
            </p>
            <div class="screenshots-section">
              <p class="screenshots-label">Imagens do jogo:</p>
              <div class="screenshots-row">
                <div class="screenshot-thumb">
                  <img src="/screenshot_map.jpg" alt="Mapa" class="screenshot-img" />
                  <div class="zoom-icon">🔍</div>
                </div>
                <div class="screenshot-thumb">
                  <img src="/screenshot_village.jpg" alt="Aldeia" class="screenshot-img" />
                  <div class="zoom-icon">🔍</div>
                </div>
                <div class="screenshot-thumb">
                  <img src="/screenshot_archer.jpg" alt="Arqueiro" class="screenshot-img" />
                  <div class="zoom-icon">🔍</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Logged in panel -->
        <div class="right-panel">
          <h2 class="panel-title">Bem-vindo, {{ auth.user?.username }}</h2>
          <p class="not-you">
            Não é <strong>{{ auth.user?.username }}</strong>?
            <a href="#" @click.prevent="handleLogout" class="logout-link">Clique aqui para sair.</a>
          </p>

          <!-- Mundos onde o jogador já está — só aparece se tiver algum -->
          <div class="worlds-section" v-if="loadingWorlds || myWorlds.length > 0">
            <p class="worlds-label">Mundos atuais</p>
            <div class="worlds-current">
              <template v-if="loadingWorlds">
                <span class="no-worlds">Carregando...</span>
              </template>
              <template v-else>
                <button
                  class="world-btn"
                  v-for="w in myWorlds"
                 :key="w.id"
                  @click="enterWorld(w.id)"
                >
                  {{ w.name }}
                </button>
              </template>
            </div>
          </div>

          <!-- Mundos disponíveis para entrar -->
          <div class="worlds-section">
            <p class="worlds-label">Mundos disponíveis</p>
            <div class="worlds-available">
              <template v-if="loadingWorlds">
                <span class="no-worlds">Carregando...</span>
              </template>
              <template v-else-if="availableWorlds.length > 0">
                <button
                  class="world-btn available"
                  v-for="w in availableWorlds"
                  :key="w.id"
                  :disabled="joiningWorldId === w.id"
                  @click="joinWorld(w.id)"
                >
                  {{ joiningWorldId === w.id ? 'Entrando...' : w.name }}
                </button>
              </template>
              <template v-else-if="!loadingWorlds && allWorlds.length === 0">
                <span class="no-worlds">Nenhum mundo disponível no momento.</span>
              </template>
            </div>
          </div>

          <div v-if="joinError" class="join-error">{{ joinError }}</div>
        </div>
      </div>
    </TwBorderBox>
  </MenuLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'
import MenuLayout  from '../components/MenuLayout.vue'
import TwBorderBox from '../components/ui/TwBorderBox.vue'

const router = useRouter()
const auth   = useAuthStore()
const API    = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'

const allWorlds      = ref([])   // todos os mundos retornados pela API
const myWorldIds     = ref([])   // IDs dos mundos onde o jogador já tem aldeia
const loadingWorlds  = ref(true)
const joiningWorldId = ref(null)
const joinError      = ref(null)

// Mundos onde o jogador já está
const myWorlds = computed(() =>
  allWorlds.value.filter(w => myWorldIds.value.includes(w.id))
)

// Mundos ativos onde o jogador ainda não entrou
const availableWorlds = computed(() =>
  allWorlds.value.filter(w => w.status === 'active' && !myWorldIds.value.includes(w.id))
)

onMounted(async () => {
  await loadWorlds()
})

async function loadWorlds() {
  loadingWorlds.value = true
  joinError.value     = null
  try {
    // Busca todos os mundos
    const { data: worlds } = await axios.get(`${API}/worlds`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    allWorlds.value = worlds

    // Descobre em quais mundos o jogador já tem aldeia
    if (worlds.length > 0) {
      const checks = await Promise.all(
        worlds.map(w =>
          axios.get(`${API}/worlds/${w.id}/my-village`, {
            headers: { Authorization: `Bearer ${auth.token}` }
          }).then(() => w.id).catch(() => null)
        )
      )
      myWorldIds.value = checks.filter(Boolean)
    }
  } catch (e) {
    console.error('[LoggedView] Erro ao carregar mundos:', e)
  } finally {
    loadingWorlds.value = false
  }
}

async function joinWorld(worldId) {
  joiningWorldId.value = worldId
  joinError.value      = null
  try {
    await axios.post(`${API}/worlds/${worldId}/join`, {}, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    // Após entrar, vai direto para o jogo
    router.push(`/game?world=${worldId}&screen=overview`)
  } catch (e) {
    joinError.value = e.response?.data?.error || 'Erro ao entrar no mundo.'
  } finally {
    joiningWorldId.value = null
  }
}

function enterWorld(worldId) {
  router.push(`/game?world=${worldId}&screen=overview`)
}

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.main-container-wrapper {
  position: relative;
  max-width: 800px;
  margin: -52px auto 40px;
}
.main-container {
  display: flex;
  background-image: url('/login_bg.jpg');
  background-repeat: repeat;
  background-size: auto;
  box-shadow: 2px 3px 8px rgba(0,0,0,0.4);
  overflow: hidden;
  min-height: 323px;
}
.left-panel { flex: 1.6; }
.left-panel-content {
  padding: 20px 22px 20px 120px;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.panel-title {
  font-size: 16px; font-weight: bold; color: #000;
  margin: 0 0 10px;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 6px;
}
.panel-desc { font-size: 12px; line-height: 1.6; color: #000; margin: 0 0 14px; }
.screenshots-section { margin-top: auto; }
.screenshots-label { font-size: 12px; font-weight: bold; margin-bottom: 8px; color: #000; }
.screenshots-row { display: flex; gap: 10px; }
.screenshot-thumb {
  position: relative; width: 100px; height: 80px;
  border: 2px solid #8b6535; overflow: hidden; cursor: pointer; background: #2a4a1a;
}
.screenshot-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.zoom-icon {
  position: absolute; bottom: 2px; right: 2px;
  background: rgba(0,0,0,0.5); color: #fff; font-size: 12px;
  width: 18px; height: 18px; display: flex; align-items: center;
  justify-content: center; border-radius: 50%;
}
.divider-v {
  position: absolute;
  left: calc(20px + (100% - 40px) * 0.615);
  top: 0; bottom: 0;
  width: 10px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 11;
}
.divider-top-img  { display: block; width: 19px; flex-shrink: 0; margin-top: 6px; }
.divider-bottom-img { display: block; width: 19px; flex-shrink: 0; transform: scaleY(-1); margin-bottom: 6px; }
.divider-middle {
  flex: 1; width: 10px;
  background-image: url('/divider_middle.png');
  background-repeat: repeat-y;
  background-size: 10px 12px;
}
.right-panel { flex: 1; padding: 20px 22px; }
.not-you { font-size: 12px; color: #000; margin-bottom: 14px; }
.logout-link { color: #8b4513; font-weight: bold; text-decoration: none; }
.logout-link:hover { text-decoration: underline; }
.worlds-section { margin-bottom: 14px; }
.worlds-label { font-size: 12px; font-weight: bold; color: #3b2200; margin-bottom: 6px; }
.worlds-current,
.worlds-available { display: flex; flex-wrap: wrap; gap: 4px; }
.world-btn {
  background: linear-gradient(to bottom, #e8d8a0, #c8a860);
  border: 1px solid #8b6535;
  color: #3b2200;
  font-size: 12px;
  font-family: Verdana, Arial, sans-serif;
  padding: 3px 10px;
  cursor: pointer;
}
.world-btn:hover { background: linear-gradient(to bottom, #f0e0b0, #d4b870); }
.world-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.world-btn.available { background: linear-gradient(to bottom, #d8d8d8, #b8b8b8); color: #444; }
.world-btn.available:hover { background: linear-gradient(to bottom, #e8e8e8, #c8c8c8); }
.no-worlds { font-size: 11px; color: #888; }
.join-error {
  margin-top: 8px;
  background: #fff0f0; border: 1px solid #c00; color: #c00;
  font-size: 11px; padding: 4px 8px; border-radius: 2px;
}

@media (max-width: 768px) {
  .main-container-wrapper { margin: 10px auto 20px; max-width: 100%; min-height: unset; }
  .main-container { flex-direction: column-reverse; min-height: unset; }
  .divider-v { display: none; }
  .left-panel-content { padding: 20px 16px; }
  .right-panel { padding: 20px 16px; border-bottom: 1px solid #c8a878; }
  .screenshots-row { justify-content: center; }
  .screenshot-thumb { width: 30%; height: 70px; }
}
</style>
