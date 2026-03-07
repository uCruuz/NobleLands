# NobleLands

Clone do Tribal Wars desenvolvido com Vue 3, Express e PostgreSQL.

![Stack](https://img.shields.io/badge/Frontend-Vue%203-42b883?style=flat-square)
![Stack](https://img.shields.io/badge/Backend-Express-lightgrey?style=flat-square)
![Stack](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square)
![Stack](https://img.shields.io/badge/Realtime-Socket.io-black?style=flat-square)

## Funcionalidades

- Autenticação com JWT (registro e login)
- Sistema de aldeias com construção de edifícios em fila
- Produção e armazenamento de recursos em tempo real
- Treinamento de unidades e pesquisa na ferraria
- Mapa interativo renderizado em Canvas com WebSockets
- Suporte a múltiplos mundos simultâneos
- Painel de administração via Socket

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vue 3 + Vite + Pinia |
| Backend | Node.js + Express |
| Banco de dados | PostgreSQL |
| Tempo real | Socket.io |
| Autenticação | JWT + bcrypt |

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [PostgreSQL](https://www.postgresql.org/) v14 ou superior

## Instalação

**1. Clone o repositório**
```bash
git clone https://github.com/uCruuz/NobleLands.git
cd NobleLands
```

**2. Configure o backend**

Copie o arquivo de exemplo e preencha com suas credenciais:
```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/tribalwars
JWT_SECRET=sua_chave_secreta_forte_aqui
ALLOWED_ORIGINS=http://localhost:5173
PORT=9999
```

Para gerar um `JWT_SECRET` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**3. Crie o banco de dados**

No PostgreSQL, crie o banco:
```sql
CREATE DATABASE tribalwars;
```

As tabelas são criadas automaticamente pelo sistema de migrations ao iniciar o servidor.

**4. Inicie o projeto**

No Windows, execute o `run.bat` — ele instala as dependências automaticamente e sobe frontend e backend juntos:
```
run.bat
```

Ou manualmente:
```bash
npm install
npm run dev
```

## Acesso

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:9999 |
| Health check | http://localhost:9999/api/health |

## Estrutura do Projeto

```
NobleLands/
├── backend/          # API Express + Socket.io
│   ├── db/           # Conexão e helpers do PostgreSQL
│   ├── middleware/   # Autenticação JWT
│   ├── routes/       # Endpoints da API
│   ├── services/     # Lógica de mundos
│   ├── socket/       # Handlers do Socket.io
│   └── server.js     # Entry point
├── frontend/         # Vue 3 + Vite
│   └── src/
│       ├── components/
│       ├── composables/
│       ├── stores/   # Pinia
│       └── views/
├── shared/           # Código compartilhado (buildings, units, mapNoise)
└── run.bat           # Script de inicialização Windows
```

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `DATABASE_URL` | URL de conexão com o PostgreSQL | ✅ |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | ✅ |
| `ALLOWED_ORIGINS` | Origens permitidas no CORS | ✅ |
| `PORT` | Porta do servidor backend (padrão: 9999) | ❌ |
