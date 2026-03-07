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
            <TwButton :full="true" @click="$router.push('/register')">Registro grátis!</TwButton>
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

        <!-- Right: Login -->
        <div class="right-panel">
          <h2 class="panel-title">Login</h2>

          <div class="form-group">
            <label>Nome de usuário:</label>
            <div class="input-row">
              <TwInput v-model="username" type="text" @input="errors.login = null" />
            </div>
          </div>

          <div class="form-group">
            <label>Senha:</label>
            <div class="input-row">
              <TwInput v-model="password" type="password" @input="errors.login = null" />
            </div>
          </div>

          <div v-if="errors.login" class="login-error">
            {{ errors.login }}
          </div>

          <div class="form-check">
            <input type="checkbox" id="remember" v-model="rememberMe" />
            <label for="remember">Lembrar-me</label>
          </div>

          <div class="login-actions">
            <TwButton :disabled="loading" @click="handleLogin">
              {{ loading ? 'Entrando...' : 'Login' }}
            </TwButton>
          </div>
          <a href="#" class="forgot-password">Recuperação de senha</a>
        </div>
      </div>
    </TwBorderBox>
  </MenuLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import MenuLayout  from '../components/MenuLayout.vue'
import TwBorderBox from '../components/ui/TwBorderBox.vue'
import TwButton    from '../components/ui/TwButton.vue'
import TwInput     from '../components/ui/TwInput.vue'

const router = useRouter()
const auth   = useAuthStore()

const username   = ref('')
const password   = ref('')
const rememberMe = ref(true)
const loading    = ref(false)
const errors     = ref({ login: null })

async function handleLogin() {
  errors.value.login = null
  loading.value = true
  const error = await auth.login(username.value, password.value, rememberMe.value)
  loading.value = false

  if (error) {
    errors.value.login = error
  } else {
    router.push('/Logged')
  }
}
</script>

<style scoped>
.main-container-wrapper {
  position: relative;
  max-width: 800px;
  margin: -52px auto 390px;
}
.main-container {
  display: flex;
  background-image: url('/login_bg.jpg');
  background-repeat: repeat;
  background-size: auto;
  box-shadow: 2px 3px 8px rgba(0,0,0,0.4);
  overflow: hidden;
}
.left-panel { flex: 1.6; }
.left-panel-content { padding: 20px 22px 20px 120px; }
.panel-title {
  font-size: 16px; font-weight: bold; color: #000;
  margin: 0 0 10px;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 6px;
}
.panel-desc { font-size: 12px; line-height: 1.6; color: #000; margin: 0 0 14px; }
.screenshots-section { margin-top: 18px; }
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
.form-group { margin-bottom: 10px; }
.form-group label { display: block; font-size: 12px; font-weight: bold; color: #3b2200; margin-bottom: 3px; }
.input-row { display: flex; align-items: center; gap: 6px; }
.login-error {
  background: #fff0f0; border: 1px solid #c00; color: #c00;
  font-size: 11px; padding: 4px 8px; margin-bottom: 8px; border-radius: 2px;
}
.form-check { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font-size: 12px; }
.form-check input { cursor: pointer; }
.form-check label { cursor: pointer; color: #3b2200; }
.login-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.forgot-password { display: block; color: #8b4513; font-size: 12px; font-weight: bold; text-decoration: none; }
.forgot-password:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .main-container-wrapper { margin: -40px auto 20px; max-width: 100%; }
  .main-container { flex-direction: column-reverse; }
  .divider-v { display: none; }
  .left-panel-content { padding: 20px 16px; }
  .right-panel { padding: 20px 16px; border-bottom: 1px solid #c8a878; }
  .screenshots-row { justify-content: center; }
  .screenshot-thumb { width: 30%; height: 70px; }
}
</style>
