import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'
import { runMigrations } from './db/database.js'
import { setupSocket } from './socket/index.js'
import authRoutes     from './routes/auth.js'
import villageRoutes  from './routes/village.js'
import barracksRoutes from './routes/barracks.js'
import smithRoutes    from './routes/smith.js'
import worldsRoutes   from './routes/worlds.js'
import mapRoutes      from './routes/map.js'
import commandsRoutes from './routes/commands.js'
import reportsRoutes  from './routes/reports.js'

const app    = express()
const server = http.createServer(app)

app.set('trust proxy', 1)

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
})

const PORT = process.env.PORT || 9999

app.use(helmet())
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em breve.' }
}))

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' }
})

app.locals.io = io

app.use('/api/auth',     authLimiter, authRoutes)
app.use('/api/village',  villageRoutes)
app.use('/api/barracks', barracksRoutes)
app.use('/api/smith',    smithRoutes)
app.use('/api/worlds',   worldsRoutes)
app.use('/api/map',      mapRoutes)
app.use('/api/commands', commandsRoutes)
app.use('/api/reports',  reportsRoutes)

app.get('/api/health', (_, res) => res.json({ ok: true }))

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Erro não tratado]', err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

runMigrations()
  .then(() => {
    setupSocket(io)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Backend rodando em http://localhost:${PORT}`)
    })
  })
  .catch(err => {
    console.error('❌ Falha nas migrations:', err)
    process.exit(1)
  })

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM recebido. Encerrando conexões pendentes...')
  server.close(() => {
    console.log('[Server] Servidor encerrado com sucesso.')
    process.exit(0)
  })
})
