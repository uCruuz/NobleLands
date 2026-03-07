import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../middleware/auth.js'
import { setupMapHandlers } from './mapHandlers.js'
import { setupAdminHandlers } from './adminHandlers.js'
import { getDb } from '../db/database.js'

export function setupSocket(io) {

  // ── Middleware de autenticação JWT ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Não autenticado.'))

    try {
      const payload = jwt.verify(token, JWT_SECRET)
      socket.playerId   = payload.id
      socket.playerName = payload.username
      socket.role       = payload.role ?? 'player'
      next()
    } catch {
      next(new Error('Token inválido ou expirado.'))
    }
  })

  // ── Conexão estabelecida ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Conectado: player=${socket.playerName} (id=${socket.playerId})`)

    // Room pessoal do jogador — para notificações privadas
    socket.join(`player:${socket.playerId}`)

    // Admins entram automaticamente na room admin
    if (socket.role === 'admin') {
      socket.join('admin')
      console.log(`[Socket] Admin ${socket.playerName} entrou na room admin`)
    }

    // Registra handlers de mapa e admin
    setupMapHandlers(io, socket)
    setupAdminHandlers(io, socket)

    socket.on('disconnect', () => {
      console.log(`[Socket] Desconectado: player=${socket.playerName}`)
    })
  })

  // ── Broadcast periódico de stats por mundo ──────────────────────────────
  // A cada 30s envia online count + total de aldeias para cada world room ativa
  setInterval(async () => {
    try {
      const db = await getDb()
      const { rows: worlds } = await db.query(
        "SELECT id FROM worlds WHERE status = 'active'"
      )

      for (const world of worlds) {
        const room    = io.sockets.adapter.rooms.get(`world:${world.id}`)
        const online  = room ? room.size : 0
        if (online === 0) continue  // ninguém online, pula

        const { rows } = await db.query(
          'SELECT COUNT(*)::INTEGER AS total FROM villages WHERE world_id = $1',
          [world.id]
        )

        io.to(`world:${world.id}`).emit('world-stats', {
          worldId:      world.id,
          onlinePlayers: online,
          totalVillages: rows[0].total
        })
      }
    } catch (e) {
      console.error('[Socket] Erro no world-stats broadcast:', e)
    }
  }, 30_000)

  // ── Broadcast periódico de métricas para admins ─────────────────────────
  // Reduzido de 5s para 30s — evita query pesada 12x/min desnecessariamente
  setInterval(async () => {
    const adminRoom = io.sockets.adapter.rooms.get('admin')
    if (!adminRoom || adminRoom.size === 0) return

    try {
      const db = await getDb()
      const { rows } = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM users)::INTEGER                           AS total_users,
          (SELECT COUNT(*) FROM villages WHERE user_id IS NOT NULL)::INTEGER AS total_player_villages,
          (SELECT COUNT(*) FROM villages WHERE user_id IS NULL)::INTEGER     AS total_barbarian_villages,
          (SELECT COUNT(*) FROM worlds WHERE status = 'active')::INTEGER     AS active_worlds
      `)

      io.to('admin').emit('admin-metrics', {
        ...rows[0],
        uptime:    Math.floor(process.uptime()),
        memoryMB:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('[Socket] Erro no admin-metrics broadcast:', e)
    }
  }, 30_000)
}
