import { getDb } from '../db/database.js'

export function setupMapHandlers(io, socket) {

  // ── join-world ────────────────────────────────────────────────────────
  // Cliente emite quando abre o mapa de um mundo
  socket.on('join-world', async ({ worldId }) => {
    if (!worldId || isNaN(parseInt(worldId))) {
      return socket.emit('error', { message: 'worldId inválido.' })
    }

    const wid = parseInt(worldId)

    try {
      const db = await getDb()

      // Verifica se o mundo existe e está ativo
      const { rows } = await db.query(
        "SELECT id, name FROM worlds WHERE id = $1 AND status = 'active'",
        [wid]
      )
      if (!rows[0]) {
        return socket.emit('error', { message: 'Mundo não encontrado ou inativo.' })
      }

      // Sai de outros mundos antes de entrar no novo
      // (evita receber broadcasts de múltiplos mundos ao mesmo tempo)
      for (const room of socket.rooms) {
        if (room.startsWith('world:') && room !== `world:${wid}`) {
          socket.leave(room)
          console.log(`[Socket] ${socket.playerName} saiu de ${room}`)
        }
      }

      socket.join(`world:${wid}`)
      socket.currentWorldId = wid

      console.log(`[Socket] ${socket.playerName} entrou em world:${wid}`)

      // Confirma para o cliente
      socket.emit('joined-world', {
        worldId: wid,
        worldName: rows[0].name
      })

    } catch (e) {
      console.error('[Socket] Erro no join-world:', e)
      socket.emit('error', { message: 'Erro ao entrar no mundo.' })
    }
  })

  // ── leave-world ───────────────────────────────────────────────────────
  // Cliente emite quando fecha o mapa
  socket.on('leave-world', ({ worldId }) => {
    const wid = parseInt(worldId)
    socket.leave(`world:${wid}`)
    socket.currentWorldId = null
    console.log(`[Socket] ${socket.playerName} saiu de world:${wid}`)
  })
}
