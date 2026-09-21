-- MedTrain initial schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT NOT NULL,
  employee_id           TEXT,
  email                 CITEXT,
  mobile                TEXT,
  department_id         UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_title             TEXT,
  password_hash         TEXT NOT NULL,
  must_change_password  BOOLEAN NOT NULL DEFAULT true,
  active                BOOLEAN NOT NULL DEFAULT true,
  role_id               UUID NOT NULL REFERENCES roles(id),
  permission_overrides  JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at         TIMESTAMPTZ,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  department_id          UUID REFERENCES departments(id) ON DELETE SET NULL,
  device_type            TEXT,
  category               TEXT,
  description            TEXT,
  video_url              TEXT,
  video_asset_path       TEXT,
  alarms                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  quiz                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_department_ids UUID[] NOT NULL DEFAULT '{}',
  assigned_to_all        BOOLEAN NOT NULL DEFAULT false,
  created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE progress (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id            UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  video_status         TEXT NOT NULL DEFAULT 'not_started' CHECK (video_status IN ('not_started','in_progress','completed')),
  video_progress_pct   NUMERIC NOT NULL DEFAULT 0,
  video_view_count     INTEGER NOT NULL DEFAULT 0,
  video_last_viewed_at TIMESTAMPTZ,
  video_completed_at   TIMESTAMPTZ,
  quiz_attempts        JSONB NOT NULL DEFAULT '[]'::jsonb,
  quiz_best_score      INTEGER,
  quiz_last_score      INTEGER,
  quiz_passed          BOOLEAN NOT NULL DEFAULT false,
  quiz_passed_at       TIMESTAMPTZ,
  certificate_revoked  BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE session (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_devices_department ON devices(department_id);
CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_assignments_device ON assignments(device_id);
CREATE INDEX idx_progress_user ON progress(user_id);
CREATE INDEX idx_progress_device ON progress(device_id);
