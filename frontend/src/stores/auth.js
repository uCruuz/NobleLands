import { defineStore } from 'pinia'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:9999/api'
const SESSION_KEY = 'tl_token'

function loadSession() {
  try {
    const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    if (!token) return null
    // Decodifica o payload do JWT sem verificar (verificação fica no backend)
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 < Date.now()) return null  // expirado
    return { token, id: payload.id, username: payload.username }
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: loadSession()
  }),

  getters: {
    isLoggedIn: (state) => !!state.user,
    token:      (state) => state.user?.token
  },

  actions: {
    // ── Validações (client-side, para feedback imediato) ────────
    validateUsername(username) {
      if (!username || username.trim().length < 3)
        return 'Nome de usuário deve ter pelo menos 3 caracteres.'
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        return 'Nome de usuário só pode conter letras, números e "_".'
      return null
    },
    validateEmail(email) {
      if (!email || !email.trim()) return 'E-mail é obrigatório.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.'
      return null
    },
    validatePassword(password) {
      if (!password || password.length < 8)      return 'Senha deve ter pelo menos 8 caracteres.'
      if (!/[A-Z]/.test(password))               return 'Senha deve conter pelo menos uma letra maiúscula.'
      if (!/[0-9]/.test(password))               return 'Senha deve conter pelo menos um número.'
      if (!/[^a-zA-Z0-9]/.test(password))        return 'Senha deve conter pelo menos um caractere especial.'
      return null
    },

    // ── Cadastro ─────────────────────────────────────────────────
    async register(username, email, password) {
      try {
        const { data } = await axios.post(`${API}/auth/register`, { username, email, password })
        this._saveSession(data.token, true)
        return null
      } catch (e) {
        return e.response?.data?.error || 'Erro ao registrar.'
      }
    },

    // ── Login ────────────────────────────────────────────────────
    async login(usernameOrEmail, password, rememberMe = false) {
      try {
        const { data } = await axios.post(`${API}/auth/login`, { usernameOrEmail, password })
        this._saveSession(data.token, rememberMe)
        return null
      } catch (e) {
        return e.response?.data?.error || 'Erro ao fazer login.'
      }
    },

    // ── Logout ───────────────────────────────────────────────────
    // Desconecta o socket antes de limpar a sessão para evitar socket
    // órfão conectado com token inválido após novo login
    logout() {
      try {
        const { useMapSocket } = require('../composables/useMapSocket.js')
        const { disconnect } = useMapSocket()
        disconnect()
      } catch {
        // Ignora caso o composable não esteja disponível no contexto atual
      }
      this.user = null
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
    },

    // ── Interno: salva token ──────────────────────────────────────
    _saveSession(token, rememberMe) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      this.user = { token, id: payload.id, username: payload.username }
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, token)
      } else {
        sessionStorage.setItem(SESSION_KEY, token)
        localStorage.removeItem(SESSION_KEY)
      }
    }
  }
})
