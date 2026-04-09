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
      email_verified BOOLEAN DEFAULT TRUE,
      verification_token_hash TEXT,
      verification_expires_at TIMESTAMPTZ,
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

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id                SERIAL PRIMARY KEY,
      user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash        TEXT NOT NULL UNIQUE,
      expires_at        TIMESTAMPTZ NOT NULL,
      revoked_at        TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
  `);

  await pool.query(`
    UPDATE users
    SET email_verified = TRUE
    WHERE email_verified IS NULL;
  `);
  console.info("DB schema ready");
}

export default pool;
