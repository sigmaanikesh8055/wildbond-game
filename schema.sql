CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  species_id VARCHAR(60) NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS creatures_owner_idx ON creatures(owner_id);
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account UUID NOT NULL REFERENCES accounts(id),
  to_account UUID NOT NULL REFERENCES accounts(id),
  offered_creature UUID NOT NULL REFERENCES creatures(id),
  requested_creature UUID NOT NULL REFERENCES creatures(id),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a UUID NOT NULL REFERENCES accounts(id),
  player_b UUID NOT NULL REFERENCES accounts(id),
  winner UUID REFERENCES accounts(id),
  rating_delta_a INTEGER NOT NULL DEFAULT 0,
  rating_delta_b INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ratings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0
);
