import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // internal Fly network, no SSL needed
  max: 10,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE,
      password_hash TEXT,
      name          TEXT,
      avatar_url    TEXT,
      google_id     TEXT UNIQUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id                SERIAL PRIMARY KEY,
      user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type              TEXT NOT NULL,
      name              TEXT NOT NULL,
      color             TEXT,
      material          TEXT,
      care_instructions JSONB DEFAULT '[]',
      photo_data_url    TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe_items(user_id);
  `);
  console.log("DB schema ready");
}

export default pool;
