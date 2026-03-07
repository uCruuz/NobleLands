import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/database.js'
import { JWT_SECRET } from '../middleware/auth.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || username.trim().length < 3)
    return res.status(400).json({ error: 'Nome de usuário deve ter pelo menos 3 caracteres.' })
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Nome de usuário só pode conter letras, números e "_".' })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' })
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' })
  if (!/[A-Z]/.test(password))
    return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra maiúscula.' })
  if (!/[0-9]/.test(password))
    return res.status(400).json({ error: 'Senha deve conter pelo menos um número.' })
  if (!/[^a-zA-Z0-9]/.test(password))
    return res.status(400).json({ error: 'Senha deve conter pelo menos um caractere especial.' })

  try {
    const db = await getDb()

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username.trim(), email.trim()]
    )
    if (existing.length > 0)
      return res.status(400).json({ error: 'Usuário ou e-mail já cadastrado.' })

    const hash = await bcrypt.hash(password, 10)

    const { rows } = await db.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username.trim(), email.trim().toLowerCase(), hash]
    )
    const userId = rows[0].id

    // Aldeia NÃO é criada aqui — jogador escolhe o mundo em /logged
    const token = jwt.sign({ id: userId, username: username.trim() }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: userId, username: username.trim(), email: email.trim().toLowerCase() } })

  } catch (e) {
    console.error('[auth/register]', e)
    res.status(500).json({ error: 'Erro interno ao registrar.' })
  }
})

router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body

  if (!usernameOrEmail || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' })

  try {
    const db = await getDb()
    const { rows } = await db.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [usernameOrEmail]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos.' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Usuário ou senha incorretos.' })

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })

  } catch (e) {
    console.error('[auth/login]', e)
    res.status(500).json({ error: 'Erro interno ao fazer login.' })
  }
})

export default router
