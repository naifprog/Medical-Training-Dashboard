-- Phase 8: Company Settings (single-organization V1, no multi-tenancy) and
-- the token table backing account activation + forgot/reset password.
-- users.session_version already exists (added in 002); this migration only
-- adds the two new tables it and the new auth flows need.

CREATE TABLE company_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT,
  commercial_registration TEXT,
  logo_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invite', 'reset')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);
CREATE UNIQUE INDEX idx_auth_tokens_hash ON auth_tokens(token_hash);
