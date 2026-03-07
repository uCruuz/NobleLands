<template>
  <MenuLayout>
    <TwBorderBox class="main-container-wrapper">
      <div class="register-panel">
        <h2 class="panel-title">Criar uma nova conta</h2>

        <!-- Nome de usuário -->
        <div class="form-group">
          <label>Nome de usuário:</label>
          <div class="input-row">
            <TwInput v-model="username" type="text" width="160px" @input="clearError('username')" />
            <div v-if="errors.username" class="error-icon-wrapper">
              <i class="icon" :style="iconStyle('error')"></i>
              <div class="error-tooltip">{{ errors.username }}</div>
            </div>
          </div>
        </div>

        <!-- E-mail -->
        <div class="form-group">
          <label>E-mail:</label>
          <div class="input-row">
            <TwInput v-model="email" type="text" width="160px" @input="clearError('email')" />
            <div v-if="errors.email" class="error-icon-wrapper">
              <i class="icon" :style="iconStyle('error')"></i>
              <div class="error-tooltip">{{ errors.email }}</div>
            </div>
          </div>
        </div>

        <!-- Senha -->
        <div class="form-group">
          <label>Senha:</label>
          <div class="input-row">
            <TwInput v-model="password" type="password" width="160px" @input="clearError('password')" />
            <div v-if="errors.password" class="error-icon-wrapper">
              <i class="icon" :style="iconStyle('error')"></i>
              <div class="error-tooltip">{{ errors.password }}</div>
            </div>
          </div>
          <div class="password-hint">
            Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial.
          </div>
        </div>

        <div v-if="errors.general" class="login-error">
          {{ errors.general }}
        </div>

        <div class="form-actions">
          <TwButton :full="false" :disabled="loading" @click="handleRegister">
            {{ loading ? 'Criando conta...' : 'Criar conta' }}
          </TwButton>
        </div>

        <a href="#" class="back-link" @click.prevent="$router.push('/')">← Voltar para o login</a>
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
import { useIcons } from '../composables/useIcons.js'

const { iconStyle } = useIcons()
const router = useRouter()
const auth   = useAuthStore()

const username = ref('')
const email    = ref('')
const password = ref('')
const loading  = ref(false)
const errors   = ref({ username: null, email: null, password: null, general: null })

function clearError(field) {
  errors.value[field] = null
}

async function handleRegister() {
  errors.value = { username: null, email: null, password: null, general: null }

  const usernameError = auth.validateUsername(username.value)
  const emailError    = auth.validateEmail(email.value)
  const passwordError = auth.validatePassword(password.value)

  errors.value.username = usernameError
  errors.value.email    = emailError
  errors.value.password = passwordError

  if (usernameError || emailError || passwordError) return

  loading.value = true
  const error = await auth.register(username.value, email.value, password.value)
  loading.value = false

  if (error) {
    errors.value.general = error
    return
  }

  // Após registro vai para seleção de mundo, não para a aldeia
  router.push('/logged')
}
</script>

<style scoped>
.main-container-wrapper {
  position: relative;
  max-width: 800px;
  margin: -52px auto 80px;
}
.register-panel {
  padding: 24px 28px 24px 140px;
  background-image: url('/login_bg.jpg');
  background-repeat: repeat;
  background-size: auto;
  min-height: 300px;
}
.panel-title {
  font-size: 16px; font-weight: bold; color: #000;
  margin: 0 0 16px;
  border-bottom: 1px solid #c8a878;
  padding-bottom: 6px;
}
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12px; font-weight: bold; color: #3b2200; margin-bottom: 3px; }
.password-hint { font-size: 10px; color: #7a6040; margin-top: 4px; }
.input-row { display: flex; align-items: center; gap: 6px; }
.error-icon-wrapper { position: relative; display: inline-flex; align-items: center; }
.error-tooltip {
  display: none;
  position: absolute;
  left: 22px; top: 50%;
  transform: translateY(-50%);
  background: #fff8e1; border: 1px solid #c8a030; color: #7a3000;
  font-size: 11px; padding: 5px 8px; border-radius: 3px;
  white-space: nowrap; z-index: 100; box-shadow: 1px 2px 6px rgba(0,0,0,0.2);
}
.error-tooltip::before {
  content: '';
  position: absolute;
  right: 100%; top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: #c8a030;
}
.error-icon-wrapper:hover .error-tooltip { display: block; }
.login-error {
  background: #fff0f0; border: 1px solid #c00; color: #c00;
  font-size: 11px; padding: 4px 8px; margin-bottom: 8px; border-radius: 2px;
}
.form-actions { margin-top: 24px; }
.back-link {
  display: inline-block; margin-top: 12px;
  color: #8b4513; font-size: 12px; font-weight: bold; text-decoration: none;
}
.back-link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .main-container-wrapper { margin: 0 auto 20px; max-width: 100%; }
  .register-panel { padding: 20px 16px; min-height: unset; }
}
</style>
