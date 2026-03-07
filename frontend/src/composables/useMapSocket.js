/**
 * useMapSocket.js — singleton do Socket.io no frontend
 *
 * Gerencia a conexão, autenticação e join/leave de mundos.
 * Um único socket é compartilhado por toda a aplicação.
 * Ao fazer logout, chame disconnect() para garantir reconexão limpa.
 */

import { io } from 'socket.io-client'
import { useAuthStore } from '../stores/auth.js'
import { useMapStore } from '../stores/mapStore.js'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:9999'

let socket = null

export function useMapSocket() {
  const auth     = useAuthStore()
  const mapStore = useMapStore()

  // ── Conecta (ou retorna socket existente) ─────────────────────────────
  function connect() {
    // Se já existe socket com o token atual, reutiliza
    if (socket?.connected) return socket

    // Garante que socket antigo seja destruído antes de criar novo
    if (socket) {
      socket.disconnect()
      socket = null
    }

    socket = io(SOCKET_URL, {
      auth: { token: auth.token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socket.on('connect', () => {
      console.log('[Socket] Conectado:', socket.id)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Erro de conexão:', err.message)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Desconectado:', reason)
    })

    // ── Eventos de mapa ─────────────────────────────────────────────────
    socket.on('map-update', (payload) => {
      mapStore.applyVillageUpdate(payload)
    })

    socket.on('world-stats', (payload) => {
      mapStore.setWorldStats(payload)
    })

    socket.on('config-updated', (config) => {
      mapStore.setWorldConfig(config)
      console.log('[Socket] Configurações do mundo atualizadas:', config)
    })

    socket.on('server-message', (payload) => {
      mapStore.addNotification({
        type:    payload.type,
        message: payload.message,
        from:    payload.from,
        sentAt:  payload.sentAt
      })
    })

    socket.on('error', (err) => {
      console.error('[Socket] Erro:', err.message)
    })

    return socket
  }

  // ── Entra num mundo ───────────────────────────────────────────────────
  function joinWorld(worldId) {
    const s = connect()
    s.emit('join-world', { worldId })

    s.once('joined-world', ({ worldId: wid, worldName }) => {
      console.log(`[Socket] Entrou em "${worldName}" (id=${wid})`)
      mapStore.setCurrentWorld(wid)
    })
  }

  // ── Sai de um mundo ───────────────────────────────────────────────────
  function leaveWorld(worldId) {
    if (!socket?.connected) return
    socket.emit('leave-world', { worldId })
    mapStore.setCurrentWorld(null)
  }

  // ── Desconecta completamente ──────────────────────────────────────────
  // Deve ser chamado no logout para evitar socket órfão com token inválido
  function disconnect() {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  return { connect, joinWorld, leaveWorld, disconnect, socket: () => socket }
}
