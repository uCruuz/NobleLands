export function setupAdminHandlers(io, socket) {
  // Ignora se não for admin
  if (socket.role !== 'admin') return

  // ── request-metrics ───────────────────────────────────────────────────
  // Admin pode solicitar métricas imediatas (sem esperar o interval de 5s)
  socket.on('request-metrics', () => {
    // Reutiliza o broadcast do index.js emitindo só para este socket
    socket.emit('admin-metrics', {
      uptime:    Math.floor(process.uptime()),
      memoryMB:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: Date.now()
    })
  })

  // ── admin-broadcast ───────────────────────────────────────────────────
  // Admin pode enviar mensagem global para todos os jogadores de um mundo
  socket.on('admin-broadcast', ({ worldId, message }) => {
    if (!worldId || !message) return
    io.to(`world:${worldId}`).emit('server-message', {
      type:    'admin',
      message,
      from:    socket.playerName,
      sentAt:  Date.now()
    })
    console.log(`[Socket] Admin broadcast para world:${worldId}: "${message}"`)
  })
}
