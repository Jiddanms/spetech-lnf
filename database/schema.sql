
-- schema.sql
-- PostgreSQL schema for Spetech Lost & Found (reference: Spetech LNF Web blueprint B)
-- Designed for clarity, constraints, and sensible indexes for mid-end KTI project.
-- Run as a migration on a PostgreSQL database.

-- Enable UUID generation (pgcrypto preferred)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin','user'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));

-- Items table (lost / found)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(120) NOT NULL,
  contact VARCHAR(120),
  photo VARCHAR(1024), -- path or URL to uploaded photo
  type VARCHAR(10) NOT NULL, -- 'lost' or 'found'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, completed, archived, deleted
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reported_by UUID, -- optional FK to users.id (who reported)
  CONSTRAINT items_type_check CHECK (type IN ('lost','found')),
  CONSTRAINT items_status_check CHECK (status IN ('pending','verified','completed','archived','deleted')),
  CONSTRAINT items_name_len CHECK (char_length(name) > 0)
);

-- Foreign key to users (nullable)
ALTER TABLE items
  ADD CONSTRAINT fk_items_reported_by_users FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL;

-- Useful indexes for queries
CREATE INDEX IF NOT EXISTS idx_items_type_status ON items (type, status);
CREATE INDEX IF NOT EXISTS idx_items_location ON items (location);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);

-- Sessions table (simple token-based sessions)
CREATE TABLE IF NOT EXISTS sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Optional: audit table for item status changes (lightweight)
CREATE TABLE IF NOT EXISTS item_audit (
  id BIGSERIAL PRIMARY KEY,
  item_id UUID NOT NULL,
  changed_by UUID,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_audit_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_audit_item_id ON item_audit (item_id);
CREATE INDEX IF NOT EXISTS idx_item_audit_created_at ON item_audit (created_at DESC);

-- Seed convenience (do not include plaintext passwords in production)
-- Example: create an admin placeholder (replace password_hash with a real bcrypt hash)
-- INSERT INTO users (username, password_hash, role) VALUES ('admin', '<bcrypt-hash-here>', 'admin');

-- Ensure updated_at is maintained by trigger (optional)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_on_items ON items;
CREATE TRIGGER set_timestamp_on_items
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_on_users ON users;
CREATE TRIGGER set_timestamp_on_users
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- End of schema
