import jwt from 'jsonwebtoken'

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
