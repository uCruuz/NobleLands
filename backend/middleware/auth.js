import jwt from 'jsonwebtoken'
import { getDb } from '../db/database.js'

// Falha imediatamente se JWT_SECRET não estiver definido no .env
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET não está definido nas variáveis de ambiente.')
  process.exit(1)
}

export const JWT_SECRET = process.env.JWT_SECRET

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' })
  }
}

// Verifica se o jogador autenticado possui uma aldeia no mundo solicitado.
// Lê worldId de req.query.worldId ou req.params.worldId.
// Deve ser usado após authMiddleware.
export async function worldMiddleware(req, res, next) {
  const worldId = parseInt(req.query.worldId ?? req.params.worldId)

  if (!worldId || isNaN(worldId)) {
    return res.status(400).json({ error: 'worldId é obrigatório.' })
  }

  try {
    const db = await getDb()
    const { rows } = await db.query(
      'SELECT id FROM villages WHERE user_id = $1 AND world_id = $2',
      [req.user.id, worldId]
    )

    if (!rows[0]) {
      return res.status(403).json({ error: 'Você não possui uma aldeia neste mundo.' })
    }

    // Disponibiliza worldId já validado para os handlers seguintes
    req.worldId = worldId
    next()
  } catch (e) {
    console.error('[worldMiddleware]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
}