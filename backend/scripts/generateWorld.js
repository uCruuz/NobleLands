/**
 * scripts/generateWorld.js — CLI para criar e gerar um mundo manualmente
 *
 * Uso:
 *   node scripts/generateWorld.js <worldId>
 *   node scripts/generateWorld.js --create "Mundo 1" --size 1000
 */

import 'dotenv/config'
import { createWorld, generateWorld } from '../services/worldService.js'

const args = process.argv.slice(2)

async function run() {
  try {
    if (args[0] === '--create') {
      const name = args[1]
      if (!name) {
        console.error('Uso: node scripts/generateWorld.js --create "Nome do Mundo" [--size 1000]')
        process.exit(1)
      }

      const sizeIdx = args.indexOf('--size')
      const size    = sizeIdx !== -1 ? parseInt(args[sizeIdx + 1]) : 1000

      console.log(`\n🌍 Criando mundo "${name}" (size=${size})...`)
      const world = await createWorld({ name, size })
      console.log(`✅ Mundo criado (id=${world.id}). Iniciando geração de aldeias...\n`)
      await runGeneration(world.id)

    } else if (args[0]) {
      const worldId = parseInt(args[0])
      if (isNaN(worldId)) {
        console.error('Uso: node scripts/generateWorld.js <worldId>')
        process.exit(1)
      }
      console.log(`\n🌍 Gerando aldeias para world id=${worldId}...\n`)
      await runGeneration(worldId)

    } else {
      console.log(`
Uso:
  node scripts/generateWorld.js <worldId>
  node scripts/generateWorld.js --create "Nome" [--size 1000]
      `)
      process.exit(0)
    }
  } catch (err) {
    console.error('\n❌ Erro:', err.message)
    process.exit(1)
  }
}

async function runGeneration(worldId) {
  let lastPercent = -1

  const total = await generateWorld(worldId, (percent) => {
    if (percent !== lastPercent) {
      process.stdout.write(`\r  Progresso: ${String(percent).padStart(3)}%`)
      lastPercent = percent
    }
  })

  console.log(`\n\n✅ Concluído! ${total} aldeias geradas para world id=${worldId}.`)
  process.exit(0)
}

run()
