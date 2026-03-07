import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function getDb() {
  return pool
}

export async function runMigrations() {
  const client = await pool.connect()
  try {
    await client.query(`
      -- ── Usuários ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL  PRIMARY KEY,
        username     TEXT    NOT NULL UNIQUE,
        email        TEXT    NOT NULL UNIQUE,
        password     TEXT    NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      );

      -- ── Mundos ───────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS worlds (
        id          SERIAL  PRIMARY KEY,
        name        TEXT    NOT NULL UNIQUE,
        size        INTEGER NOT NULL DEFAULT 1000,
        center_x    INTEGER NOT NULL DEFAULT 500,
        center_y    INTEGER NOT NULL DEFAULT 500,
        spawn_ring  INTEGER NOT NULL DEFAULT 3,
        status      TEXT    NOT NULL DEFAULT 'active',
        seed        INTEGER NOT NULL DEFAULT 1,
        created_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      );

      -- Migração segura: adiciona seed em mundos já existentes
      ALTER TABLE worlds ADD COLUMN IF NOT EXISTS seed INTEGER NOT NULL DEFAULT 1;

      -- ── Configurações do mundo (1:1 com worlds) ──────────────────────────
      CREATE TABLE IF NOT EXISTS world_configs (
        world_id          INTEGER PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
        speed             REAL    NOT NULL DEFAULT 1.0,
        unit_speed        REAL    NOT NULL DEFAULT 1.0,
        production_rate   REAL    NOT NULL DEFAULT 1.0,
        morale            BOOLEAN NOT NULL DEFAULT true,
        barbarian_growth  BOOLEAN NOT NULL DEFAULT true,
        night_bonus       BOOLEAN NOT NULL DEFAULT false,
        updated_at        INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      );

      -- ── Aldeias ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS villages (
        id         SERIAL  PRIMARY KEY,
        world_id   INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name       TEXT    NOT NULL DEFAULT 'Aldeia Bárbara',
        x          INTEGER NOT NULL,
        y          INTEGER NOT NULL,
        continent  TEXT    NOT NULL DEFAULT 'K55',
        ring       INTEGER NOT NULL DEFAULT 0,
        points     INTEGER NOT NULL DEFAULT 26,
        created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
        UNIQUE (world_id, x, y)
      );

      CREATE INDEX IF NOT EXISTS idx_villages_world_xy
        ON villages (world_id, x, y);
      CREATE INDEX IF NOT EXISTS idx_villages_world_ring
        ON villages (world_id, ring);
      CREATE INDEX IF NOT EXISTS idx_villages_world_continent
        ON villages (world_id, continent);

      -- ── Recursos ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS village_resources (
        village_id   INTEGER PRIMARY KEY REFERENCES villages(id) ON DELETE CASCADE,
        wood         REAL    NOT NULL DEFAULT 200,
        stone        REAL    NOT NULL DEFAULT 150,
        iron         REAL    NOT NULL DEFAULT 100,
        wood_rate    REAL    NOT NULL DEFAULT 45,
        stone_rate   REAL    NOT NULL DEFAULT 45,
        iron_rate    REAL    NOT NULL DEFAULT 45,
        last_updated INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      );

      -- ── Edifícios ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS village_buildings (
        village_id    INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
        building_key  TEXT    NOT NULL,
        level         INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (village_id, building_key)
      );

      -- ── Fila de construção ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS build_queue (
        id            SERIAL  PRIMARY KEY,
        village_id    INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
        building_key  TEXT    NOT NULL,
        target_level  INTEGER NOT NULL,
        ends_at       INTEGER NOT NULL
      );

      -- ── Unidades ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS village_units (
        village_id  INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
        unit_key    TEXT    NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (village_id, unit_key)
      );

      -- ── Fila de treino ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS train_queue (
        id          SERIAL  PRIMARY KEY,
        village_id  INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
        unit_key    TEXT    NOT NULL,
        count       INTEGER NOT NULL,
        ends_at     INTEGER NOT NULL
      );

      -- ── Pesquisa ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS village_research (
        id         SERIAL  PRIMARY KEY,
        village_id INTEGER NOT NULL REFERENCES villages(id),
        unit_key   TEXT    NOT NULL,
        UNIQUE (village_id, unit_key)
      );

      CREATE TABLE IF NOT EXISTS research_queue (
        id         SERIAL  PRIMARY KEY,
        village_id INTEGER NOT NULL REFERENCES villages(id),
        unit_key   TEXT    NOT NULL,
        ends_at    INTEGER NOT NULL
      );
    `)
    console.log('[DB] Migrations executadas com sucesso.')
  } finally {
    client.release()
  }
}
