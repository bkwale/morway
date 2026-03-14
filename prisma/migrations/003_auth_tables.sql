-- Auth tables for NextAuth.js (Auth.js v5)
-- Run via: turso db shell morway < prisma/migrations/003_auth_tables.sql

-- Add emailVerified and image to existing users table
ALTER TABLE users ADD COLUMN emailVerified TEXT;
ALTER TABLE users ADD COLUMN image TEXT;

-- Accounts table (for OAuth providers, magic link adapter)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, providerAccountId)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  sessionToken TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  expires TEXT NOT NULL
);

-- Verification tokens (for magic link email)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  UNIQUE(identifier, token)
);
