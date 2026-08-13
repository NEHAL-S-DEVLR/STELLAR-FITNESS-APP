require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const {
  DB_HOST     = 'localhost',
  DB_PORT     = '5432',
  DB_USER     = 'postgres',
  DB_PASSWORD = 'root',
  DB_NAME     = 'fitcore_gym',
  PORT        = '3000',
  WHATSAPP_TOKEN     = '',
  WHATSAPP_PHONE_ID  = '',
  WHATSAPP_TEMPLATE  = '',
  // Origin(s) of the public Next.js marketing site, comma-separated, allowed
  // to call the public API (e.g. the Book Visit / Contact -> leads endpoint)
  // cross-origin. Defaults cover local dev on the two most common ports.
  PUBLIC_SITE_ORIGIN = 'http://localhost:3000,http://localhost:3001',
  // Owning company for the monthly net-profit split report — see
  // GET /api/admin/reports/monthly-summary. The other side of the split is
  // whichever trainer is flagged trainer_is_partner in the database.
  COMPANY_NAME = 'RGK Group of Companies',
  // Managed Postgres services (Vercel Postgres, Neon, Supabase, Railway, …)
  // provide a single connection URL. If either of these is set we use it
  // instead of the discrete DB_HOST/DB_PORT/etc. variables above.
  POSTGRES_URL,
  DATABASE_URL,
} = process.env;

// Session-signing secret. Prefer explicit JWT_SECRET; fall back to
// SUPABASE_JWT_SECRET when the Supabase Vercel integration provided one.
// The stable dev fallback ensures sessions survive Vercel cold starts.
// Set JWT_SECRET in production for real security.
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  'stellar-fitness-dev-fallback-2026';
console.log('[boot] JWT_SECRET source:',
  process.env.JWT_SECRET ? 'JWT_SECRET (env)' :
  process.env.SUPABASE_JWT_SECRET ? 'SUPABASE_JWT_SECRET (env)' :
  'stable dev fallback — set JWT_SECRET env var in production');

const WA_CONFIGURED = Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
const CONNECTION_STRING = POSTGRES_URL || DATABASE_URL || null;
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.NOW_REGION);

// Strip sslmode from the URL so pg doesn't set its own SSL config from the
// URL parameter. We then pass ssl explicitly with rejectUnauthorized: false,
// which is required for managed Postgres services whose cert chains don't
// include a root CA that Node trusts out of the box.
function cleanPgUrl(url) {
  if (!url) return url;
  return url.replace(/[?&]sslmode=[^&]*/g, (m) => (m[0] === '?' ? '?' : '')).replace(/\?$/, '');
}

const pgConfig = CONNECTION_STRING
  ? {
      connectionString: cleanPgUrl(CONNECTION_STRING),
      ssl: { rejectUnauthorized: false },
    }
  : { host: DB_HOST, port: parseInt(DB_PORT, 10), user: DB_USER, password: DB_PASSWORD };

// ============================== DB Bootstrap ==============================
async function ensureDatabase() {
  // Managed Postgres services expose a single, pre-created database — you
  // can't CREATE DATABASE at runtime. Skip this step for them.
  if (CONNECTION_STRING) return;
  const bootstrap = new Pool({ ...pgConfig, database: 'postgres' });
  try {
    const { rows } = await bootstrap.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (rows.length === 0) {
      // Database identifiers can't be parameterised
      await bootstrap.query(`CREATE DATABASE "${DB_NAME.replace(/"/g, '""')}"`);
      console.log(`Created database "${DB_NAME}"`);
    }
  } finally {
    await bootstrap.end();
  }
}

// When using a connection string the database name comes from the URL, so we
// don't append it. Otherwise we point at the DB_NAME we may have just created.
const pool = new Pool(CONNECTION_STRING ? pgConfig : { ...pgConfig, database: DB_NAME });

async function q(text, params = [])  { const { rows } = await pool.query(text, params); return rows; }
async function q1(text, params = []) { const rows = await q(text, params); return rows[0] || null; }

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined TEXT NOT NULL,
      height REAL,
      goal TEXT,
      phone TEXT,
      subscription_plan TEXT,
      subscription_start TEXT,
      subscription_expiry TEXT,
      workout_plan_json JSONB,
      nutrition_plan_json JSONB
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

    CREATE TABLE IF NOT EXISTS attendance (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS weight_log (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kg REAL NOT NULL,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sent TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sent TEXT NOT NULL,
      recipients INTEGER NOT NULL,
      sent_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      edited_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      edited_by_name TEXT NOT NULL,
      edited_by_role TEXT NOT NULL,
      changes JSONB NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS edit_log_user_idx ON edit_log(user_id, changed_at DESC);

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      duration_days INTEGER NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_date TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'paid',
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recorded_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS payments_user_idx   ON payments(user_id, payment_date DESC);
    CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
    CREATE INDEX IF NOT EXISTS payments_date_idx   ON payments(payment_date DESC);

    CREATE TABLE IF NOT EXISTS food_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL,
      carbs REAL,
      fats REAL,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'web',
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS food_entries_user_date_idx ON food_entries(user_id, entry_date DESC);
  `);

  // Phase 2 — extended schema (idempotent: safe on every boot)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_history TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_trainer_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_commission_rate NUMERIC(5,2) DEFAULT 10;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_specialization TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_monthly_target NUMERIC(10,2);
    -- Rich trainer profile (public trainer pages + PT commission model)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_qualifications TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_achievements TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_certificate_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_instagram TEXT;
    -- Partner trainers keep 100% of their own PT revenue instead of the
    -- usual client-count-tiered split (see effectivePtRate()).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_is_partner BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS admissions (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admission_date   TEXT NOT NULL,
      receipt_number   TEXT UNIQUE NOT NULL,
      type             TEXT NOT NULL DEFAULT 'new',
      plan_id          INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
      plan_name        TEXT NOT NULL,
      plan_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
      trainer_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      trainer_name     TEXT,
      payment_mode     TEXT NOT NULL DEFAULT 'cash',
      paid_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
      discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
      balance          NUMERIC(10,2) NOT NULL DEFAULT 0,
      start_date       TEXT NOT NULL,
      end_date         TEXT NOT NULL,
      remarks          TEXT,
      recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recorded_by_name TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS admissions_user_idx ON admissions(user_id, admission_date DESC);
    CREATE INDEX IF NOT EXISTS admissions_date_idx ON admissions(admission_date DESC);

    CREATE TABLE IF NOT EXISTS pt_packages (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      sessions      INTEGER NOT NULL,
      price         NUMERIC(10,2) NOT NULL,
      validity_days INTEGER NOT NULL DEFAULT 90,
      description   TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pt_assignments (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trainer_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      trainer_name     TEXT,
      package_id       INTEGER REFERENCES pt_packages(id) ON DELETE SET NULL,
      package_name     TEXT,
      sessions_total   INTEGER NOT NULL,
      sessions_used    INTEGER NOT NULL DEFAULT 0,
      price_paid       NUMERIC(10,2) NOT NULL DEFAULT 0,
      start_date       TEXT NOT NULL,
      end_date         TEXT,
      status           TEXT NOT NULL DEFAULT 'active',
      remarks          TEXT,
      recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recorded_by_name TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pt_assignments_user_idx    ON pt_assignments(user_id);
    CREATE INDEX IF NOT EXISTS pt_assignments_trainer_idx ON pt_assignments(trainer_id);

    CREATE TABLE IF NOT EXISTS pt_sessions (
      id              SERIAL PRIMARY KEY,
      assignment_id   INTEGER NOT NULL REFERENCES pt_assignments(id) ON DELETE CASCADE,
      session_date    TEXT NOT NULL,
      notes           TEXT,
      marked_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      marked_by_name  TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pt_sessions_assignment_idx ON pt_sessions(assignment_id);

    -- Clients walk in and train, no per-session scheduling/marking. Packages
    -- and assignments are no longer session-counted, just priced + timed.
    -- pt_sessions/mark-session stays in the schema (harmless, just unused
    -- going forward) rather than dropping it outright.
    ALTER TABLE pt_packages    ALTER COLUMN sessions      DROP NOT NULL;
    ALTER TABLE pt_assignments ALTER COLUMN sessions_total DROP NOT NULL;

    -- Links a payment back to the PT assignment it was collected for, so
    -- cancelling the assignment can also void that payment out of revenue
    -- (see PATCH /api/admin/pt-assignments/:id).
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS pt_assignment_id INTEGER REFERENCES pt_assignments(id) ON DELETE SET NULL;

    -- Batches (e.g. "Morning Batch", "Evening Batch", "Yoga") — just a named
    -- group members can be assigned to, nothing location-specific.
    CREATE TABLE IF NOT EXISTS batches (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- Max members allowed in this batch at once. NULL = no limit.
    ALTER TABLE batches ADD COLUMN IF NOT EXISTS capacity INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL;
    -- What a member signed up as: 'regular' (gym floor only) or 'pt'
    -- (personal training from day one). Independent of whether they still
    -- have an active pt_assignment later — this just records original intent.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'regular';

    -- Small key/value store for gym-wide settings — currently just the
    -- secret embedded in the common QR check-in code (see /api/checkin).
    CREATE TABLE IF NOT EXISTS gym_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Granular permissions for non-admin accounts (role = 'staff', or a
    -- 'trainer' granted extra abilities like adding members directly).
    -- Admins implicitly have everything and never consult this column.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';

    CREATE TABLE IF NOT EXISTS expenses (
      id               SERIAL PRIMARY KEY,
      expense_date     TEXT NOT NULL,
      category         TEXT NOT NULL,
      amount           NUMERIC(10,2) NOT NULL,
      description      TEXT,
      recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recorded_by_name TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC);

    CREATE TABLE IF NOT EXISTS workout_logs (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date       TEXT NOT NULL,
      completed  JSONB NOT NULL DEFAULT '[]',
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS workout_logs_user_idx ON workout_logs(user_id, date DESC);
  `);

  // Phase 3 — PT booking & calendar (idempotent: safe on every boot)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_session_duration_minutes INTEGER NOT NULL DEFAULT 60;

    CREATE TABLE IF NOT EXISTS trainer_working_hours (
      id           SERIAL PRIMARY KEY,
      trainer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time   TEXT NOT NULL,
      end_time     TEXT NOT NULL,
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS trainer_working_hours_trainer_idx ON trainer_working_hours(trainer_id, day_of_week);

    CREATE TABLE IF NOT EXISTS trainer_schedule_exceptions (
      id              SERIAL PRIMARY KEY,
      trainer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exception_date  TEXT NOT NULL,
      type            TEXT NOT NULL CHECK (type IN ('block','add')),
      start_time      TEXT,
      end_time        TEXT,
      reason          TEXT,
      created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (type <> 'add' OR (start_time IS NOT NULL AND end_time IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS trainer_schedule_exceptions_trainer_date_idx ON trainer_schedule_exceptions(trainer_id, exception_date);

    CREATE TABLE IF NOT EXISTS pt_bookings (
      id             SERIAL PRIMARY KEY,
      assignment_id  INTEGER NOT NULL REFERENCES pt_assignments(id) ON DELETE CASCADE,
      member_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trainer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_date   TEXT NOT NULL,
      start_time     TEXT NOT NULL,
      end_time       TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
      cancelled_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cancelled_at   TIMESTAMPTZ,
      cancel_reason  TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pt_bookings_trainer_date_idx ON pt_bookings(trainer_id, booking_date, start_time);
    CREATE INDEX IF NOT EXISTS pt_bookings_member_idx       ON pt_bookings(member_id, booking_date DESC);
    CREATE INDEX IF NOT EXISTS pt_bookings_assignment_idx   ON pt_bookings(assignment_id);
    CREATE UNIQUE INDEX IF NOT EXISTS pt_bookings_no_double_book
      ON pt_bookings(trainer_id, booking_date, start_time) WHERE status = 'confirmed';

    ALTER TABLE pt_sessions ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES pt_bookings(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pt_sessions_booking_uidx ON pt_sessions(booking_id) WHERE booking_id IS NOT NULL;

    -- Public leads: Book Visit / Contact form submissions from the marketing site.
    CREATE TABLE IF NOT EXISTS leads (
      id                SERIAL PRIMARY KEY,
      source            TEXT NOT NULL CHECK (source IN ('book-visit','contact')),
      name              TEXT NOT NULL,
      phone             TEXT,
      email             TEXT,
      goal              TEXT,
      preferred_trainer TEXT,
      preferred_date    TEXT,
      preferred_time    TEXT,
      message           TEXT,
      status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','completed','cancelled')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS leads_status_idx  ON leads(status);
    -- Only filled in when the lead's WhatsApp number is different from their
    -- regular phone — most people are the same, so this stays optional and
    -- callers should fall back to phone when it's null.
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp TEXT;
    -- Which membership plan they said they're interested in, picked from the
    -- real admin-managed subscription_plans (not a free-text guess).
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS interested_plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL;
  `);

  // Migrate seed account emails to the new domain (idempotent — no-op once done)
  await pool.query(`
    UPDATE users
    SET email = REPLACE(email, '@fitcore.gym', '@stellarfitness.in')
    WHERE email LIKE '%@fitcore.gym'
  `);
}

// ============================== Seed ==============================
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

async function seedIfEmpty() {
  const { count } = await q1('SELECT COUNT(*)::int AS count FROM users');
  if (count > 0) return;
  console.log('Seeding demo data…');

  const hash = pw => bcrypt.hashSync(pw, 10);
  const DEMO_PW = hash('demo1234');

  // ---------- Workout plan templates ----------
  const plans = {
    ppl: {
      name: 'Push / Pull / Legs — Hypertrophy', assignedBy: 'Coach Ravi',
      days: [
        { day: 'Monday', focus: 'Push', items: [
          { muscleGroup: 'Chest',     exercise: 'Bench Press',         machine: 'Barbell',       sets: '4 x 8' },
          { muscleGroup: 'Shoulders', exercise: 'Overhead Press',      machine: 'Barbell',       sets: '3 x 10' },
          { muscleGroup: 'Chest',     exercise: 'Incline Bench Press', machine: 'Dumbbells',     sets: '3 x 12' },
          { muscleGroup: 'Arms',      exercise: 'Tricep Pushdown',     machine: 'Cable Machine', sets: '3 x 15' },
        ]},
        { day: 'Tuesday', focus: 'Pull', items: [
          { muscleGroup: 'Back', exercise: 'Deadlift',    machine: 'Barbell',     sets: '4 x 6' },
          { muscleGroup: 'Back', exercise: 'Pull-ups',    machine: 'Pull-up Bar', sets: '4 x AMRAP' },
          { muscleGroup: 'Back', exercise: 'Barbell Row', machine: 'Barbell',     sets: '3 x 10' },
        ]},
        { day: 'Wednesday', focus: 'Legs', items: [
          { muscleGroup: 'Legs', exercise: 'Back Squat',        machine: 'Barbell',            sets: '4 x 8' },
          { muscleGroup: 'Legs', exercise: 'Romanian Deadlift', machine: 'Barbell',            sets: '3 x 10' },
          { muscleGroup: 'Legs', exercise: 'Calf Raises',       machine: 'Calf Raise Machine', sets: '4 x 20' },
        ]},
        { day: 'Thursday', focus: 'Rest / Mobility', items: [
          { muscleGroup: 'Mobility / Rest', exercise: 'Walk',         machine: 'Outdoor',     sets: '30 min' },
          { muscleGroup: 'Mobility / Rest', exercise: 'Foam Rolling', machine: 'Foam Roller', sets: '15 min' },
        ]},
        { day: 'Friday', focus: 'Push', items: [
          { muscleGroup: 'Chest',     exercise: 'Incline Bench Press', machine: 'Barbell',   sets: '4 x 8' },
          { muscleGroup: 'Chest',     exercise: 'Chest Dips',          machine: 'Dip Bar',   sets: '3 x 12' },
          { muscleGroup: 'Shoulders', exercise: 'Lateral Raises',      machine: 'Dumbbells', sets: '3 x 15' },
        ]},
        { day: 'Saturday', focus: 'Pull', items: [
          { muscleGroup: 'Back', exercise: 'Lat Pulldown',     machine: 'Lat Pulldown Machine', sets: '4 x 10' },
          { muscleGroup: 'Back', exercise: 'Seated Cable Row', machine: 'Cable Row Machine',    sets: '3 x 12' },
          { muscleGroup: 'Arms', exercise: 'Barbell Curl',     machine: 'EZ Bar',               sets: '3 x 12' },
        ]},
        { day: 'Sunday', focus: 'Rest', items: [] },
      ],
    },

    fatLoss: {
      name: 'Fat Loss Circuit', assignedBy: 'Coach Ravi',
      days: [
        { day: 'Monday', focus: 'Full body strength', items: [
          { muscleGroup: 'Legs',  exercise: 'Back Squat',   machine: 'Smith Machine', sets: '3 x 12' },
          { muscleGroup: 'Chest', exercise: 'Push-ups',     machine: 'Bodyweight',    sets: '3 x 10' },
          { muscleGroup: 'Back',  exercise: 'Dumbbell Row', machine: 'Dumbbells',     sets: '3 x 12' },
          { muscleGroup: 'Core',  exercise: 'Plank',        machine: 'Bodyweight',    sets: '3 x 45s' },
        ]},
        { day: 'Tuesday', focus: 'HIIT Cardio', items: [
          { muscleGroup: 'Cardio', exercise: 'HIIT Intervals', machine: 'Treadmill',      sets: '20 min' },
          { muscleGroup: 'Cardio', exercise: 'Rowing',         machine: 'Rowing Machine', sets: '10 min' },
        ]},
        { day: 'Wednesday', focus: 'Lower body', items: [
          { muscleGroup: 'Legs', exercise: 'Leg Press',  machine: 'Leg Press Machine', sets: '3 x 12' },
          { muscleGroup: 'Legs', exercise: 'Hip Thrust', machine: 'Barbell',           sets: '3 x 12' },
        ]},
        { day: 'Thursday', focus: 'Rest', items: [] },
        { day: 'Friday', focus: 'Upper body', items: [
          { muscleGroup: 'Back',      exercise: 'Lat Pulldown',   machine: 'Lat Pulldown Machine',   sets: '3 x 12' },
          { muscleGroup: 'Shoulders', exercise: 'Overhead Press', machine: 'Shoulder Press Machine', sets: '3 x 10' },
        ]},
        { day: 'Saturday', focus: 'Cardio + Core', items: [
          { muscleGroup: 'Cardio', exercise: 'Stationary Bike', machine: 'Upright Bike', sets: '45 min' },
        ]},
        { day: 'Sunday', focus: 'Rest', items: [] },
      ],
    },

    powerlifting: {
      name: 'Powerlifting 5x5', assignedBy: 'Coach Ravi',
      days: [
        { day: 'Monday', focus: 'Squat day', items: [
          { muscleGroup: 'Legs', exercise: 'Back Squat',    machine: 'Barbell', sets: '5 x 5' },
          { muscleGroup: 'Legs', exercise: 'Front Squat',   machine: 'Barbell', sets: '3 x 8' },
          { muscleGroup: 'Core', exercise: 'Plank',         machine: 'Bodyweight', sets: '3 x 60s' },
        ]},
        { day: 'Tuesday', focus: 'Rest', items: [] },
        { day: 'Wednesday', focus: 'Bench day', items: [
          { muscleGroup: 'Chest',     exercise: 'Bench Press',    machine: 'Barbell', sets: '5 x 5' },
          { muscleGroup: 'Shoulders', exercise: 'Overhead Press', machine: 'Barbell', sets: '3 x 8' },
          { muscleGroup: 'Arms',      exercise: 'Skull Crushers', machine: 'EZ Bar',  sets: '3 x 10' },
        ]},
        { day: 'Thursday', focus: 'Accessory / mobility', items: [
          { muscleGroup: 'Mobility / Rest', exercise: 'Foam Rolling', machine: 'Foam Roller', sets: '20 min' },
        ]},
        { day: 'Friday', focus: 'Deadlift day', items: [
          { muscleGroup: 'Back', exercise: 'Deadlift',   machine: 'Barbell',  sets: '5 x 3' },
          { muscleGroup: 'Back', exercise: 'Barbell Row', machine: 'Barbell', sets: '4 x 8' },
          { muscleGroup: 'Back', exercise: 'Pull-ups',    machine: 'Pull-up Bar', sets: '3 x AMRAP' },
        ]},
        { day: 'Saturday', focus: 'Accessory', items: [
          { muscleGroup: 'Arms', exercise: 'Barbell Curl',     machine: 'Barbell', sets: '4 x 10' },
          { muscleGroup: 'Arms', exercise: 'Tricep Pushdown',  machine: 'Cable Machine', sets: '4 x 12' },
        ]},
        { day: 'Sunday', focus: 'Rest', items: [] },
      ],
    },

    cardio: {
      name: 'Endurance / Cardio Focus', assignedBy: 'Coach Ravi',
      days: [
        { day: 'Monday', focus: 'Long run', items: [
          { muscleGroup: 'Cardio', exercise: 'Treadmill Run', machine: 'Treadmill', sets: '45 min steady' },
        ]},
        { day: 'Tuesday', focus: 'Cross-train', items: [
          { muscleGroup: 'Cardio', exercise: 'Stationary Bike', machine: 'Upright Bike', sets: '40 min' },
          { muscleGroup: 'Core',   exercise: 'Plank',           machine: 'Bodyweight',   sets: '3 x 45s' },
        ]},
        { day: 'Wednesday', focus: 'Interval', items: [
          { muscleGroup: 'Cardio', exercise: 'HIIT Intervals', machine: 'Rowing Machine', sets: '10 x 1 min' },
        ]},
        { day: 'Thursday', focus: 'Recovery walk', items: [
          { muscleGroup: 'Mobility / Rest', exercise: 'Walk', machine: 'Outdoor', sets: '45 min' },
        ]},
        { day: 'Friday', focus: 'Tempo run', items: [
          { muscleGroup: 'Cardio', exercise: 'Treadmill Run', machine: 'Treadmill', sets: '30 min tempo' },
        ]},
        { day: 'Saturday', focus: 'Full body strength', items: [
          { muscleGroup: 'Legs',      exercise: 'Back Squat', machine: 'Barbell', sets: '3 x 10' },
          { muscleGroup: 'Chest',     exercise: 'Push-ups',   machine: 'Bodyweight', sets: '3 x 15' },
          { muscleGroup: 'Back',      exercise: 'Pull-ups',   machine: 'Pull-up Bar', sets: '3 x 8' },
        ]},
        { day: 'Sunday', focus: 'Rest', items: [] },
      ],
    },

    beginner: {
      name: 'Beginner Upper / Lower', assignedBy: 'Coach Ravi',
      days: [
        { day: 'Monday', focus: 'Upper body', items: [
          { muscleGroup: 'Chest',     exercise: 'Bench Press',       machine: 'Chest Press Machine', sets: '3 x 10' },
          { muscleGroup: 'Back',      exercise: 'Lat Pulldown',      machine: 'Lat Pulldown Machine', sets: '3 x 10' },
          { muscleGroup: 'Shoulders', exercise: 'Overhead Press',    machine: 'Shoulder Press Machine', sets: '3 x 10' },
          { muscleGroup: 'Arms',      exercise: 'Barbell Curl',      machine: 'EZ Bar', sets: '2 x 12' },
        ]},
        { day: 'Tuesday', focus: 'Rest', items: [] },
        { day: 'Wednesday', focus: 'Lower body', items: [
          { muscleGroup: 'Legs', exercise: 'Leg Press',      machine: 'Leg Press Machine', sets: '3 x 10' },
          { muscleGroup: 'Legs', exercise: 'Leg Curl',       machine: 'Leg Curl Machine',  sets: '3 x 12' },
          { muscleGroup: 'Legs', exercise: 'Leg Extension',  machine: 'Leg Extension Machine', sets: '3 x 12' },
          { muscleGroup: 'Core', exercise: 'Crunches',       machine: 'Ab Bench', sets: '3 x 15' },
        ]},
        { day: 'Thursday', focus: 'Cardio', items: [
          { muscleGroup: 'Cardio', exercise: 'Elliptical', machine: 'Elliptical', sets: '25 min' },
        ]},
        { day: 'Friday', focus: 'Upper body', items: [
          { muscleGroup: 'Chest', exercise: 'Push-ups',      machine: 'Bodyweight', sets: '3 x 8' },
          { muscleGroup: 'Back',  exercise: 'Seated Cable Row', machine: 'Cable Row Machine', sets: '3 x 12' },
          { muscleGroup: 'Arms', exercise: 'Tricep Pushdown', machine: 'Cable Machine', sets: '3 x 12' },
        ]},
        { day: 'Saturday', focus: 'Active recovery', items: [
          { muscleGroup: 'Mobility / Rest', exercise: 'Yoga Flow', machine: 'Mat', sets: '30 min' },
        ]},
        { day: 'Sunday', focus: 'Rest', items: [] },
      ],
    },
  };

  // ---------- Nutrition templates ----------
  const nutritions = {
    bulk: {
      calories: 2600, protein: 180, carbs: 280, fats: 75,
      meals: [
        { name: 'Breakfast',    items: '4 egg whites + 2 whole eggs, oats with banana & almond butter, black coffee' },
        { name: 'Mid-morning',  items: 'Greek yogurt with berries + a handful of walnuts' },
        { name: 'Lunch',        items: 'Grilled chicken (200g), brown rice, mixed vegetables, olive oil' },
        { name: 'Pre-workout',  items: 'Apple + scoop of whey protein' },
        { name: 'Dinner',       items: 'Salmon (180g), sweet potato, broccoli, side salad' },
        { name: 'Before bed',   items: 'Cottage cheese + a few almonds' },
      ],
    },
    cut: {
      calories: 1700, protein: 130, carbs: 150, fats: 55,
      meals: [
        { name: 'Breakfast', items: 'Vegetable omelette (3 eggs), 1 slice whole-grain toast' },
        { name: 'Lunch',     items: 'Grilled paneer salad with chickpeas and olive oil dressing' },
        { name: 'Snack',     items: 'Apple + 10 almonds' },
        { name: 'Dinner',    items: 'Tofu stir-fry with quinoa and vegetables' },
      ],
    },
    power: {
      calories: 3200, protein: 210, carbs: 380, fats: 95,
      meals: [
        { name: 'Breakfast',  items: '5 whole eggs, 100g oats, banana, whole milk' },
        { name: 'Snack',      items: 'Protein shake with peanut butter and oats' },
        { name: 'Lunch',      items: '250g chicken thigh, 200g rice, salad with olive oil' },
        { name: 'Pre-workout',items: 'Rice cakes with honey, coffee' },
        { name: 'Post-workout', items: 'Whey shake + a banana' },
        { name: 'Dinner',     items: '250g beef, roasted potatoes, greens' },
        { name: 'Before bed', items: 'Casein protein + almonds' },
      ],
    },
    endurance: {
      calories: 2400, protein: 130, carbs: 340, fats: 70,
      meals: [
        { name: 'Breakfast',   items: 'Overnight oats with berries, chia seeds and honey' },
        { name: 'Snack',       items: 'Banana + peanut butter on toast' },
        { name: 'Lunch',       items: 'Quinoa bowl with grilled tofu, roasted vegetables' },
        { name: 'Pre-run',     items: 'Small bowl of granola with milk' },
        { name: 'Dinner',      items: 'Pasta with tomato-basil sauce, side of grilled fish' },
      ],
    },
    balanced: {
      calories: 2000, protein: 120, carbs: 220, fats: 65,
      meals: [
        { name: 'Breakfast', items: 'Two eggs, toast, orange juice' },
        { name: 'Lunch',     items: 'Chicken wrap with vegetables and yogurt dip' },
        { name: 'Snack',     items: 'Handful of trail mix' },
        { name: 'Dinner',    items: 'Grilled fish, brown rice, steamed vegetables' },
      ],
    },
  };

  // ---------- Member definitions ----------
  // subExpiry days: negative = expires in future (e.g. -7 = 7 days from now); positive = already expired
  const members = [
    { name: 'Sanjay Khadka', email: 'sanjay.khadka@skyboxindia.in', phone: '+91 98765 43210',
      height: 175, goal: 'Build lean muscle', joined: 120,
      subPlan: 'Monthly Premium', subStart: 23, subExpiry: -7,
      weightLog: [[120,82.0],[90,80.4],[60,78.9],[30,77.2],[7,76.1],[0,75.8]],
      attendance: [1,2,4,5,7,8,10,12,14,15,17,20,22,25,27],
      photos: [
        [120, 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop', 'Day 1'],
        [60,  'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=400&h=300&fit=crop', 'Two months in'],
        [7,   'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=400&h=300&fit=crop', 'This week'],
      ],
      workout: 'ppl', nutrition: 'bulk',
    },
    { name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 97654 32109',
      height: 162, goal: 'Lose 8 kg', joined: 45,
      subPlan: 'Quarterly Standard', subStart: 45, subExpiry: -25,
      weightLog: [[45,68.0],[30,67.1],[15,66.0],[0,65.2]],
      attendance: [1,3,6,9,11,14,17,20,25,28,32,38],
      photos: [[45, 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop', 'Starting point']],
      workout: 'fatLoss', nutrition: 'cut',
    },
    { name: 'Arjun Mehta', email: 'arjun@example.com', phone: '+91 99887 76655',
      height: 180, goal: 'Beginner — build base', joined: 15,
      subPlan: 'Annual Premium', subStart: 15, subExpiry: -350,
      weightLog: [[15,72.0],[0,72.3]],
      attendance: [1,2,5,8,12,14],
      photos: [],
      workout: null, nutrition: null,
    },
    { name: 'Kavya Reddy', email: 'kavya@example.com', phone: '+91 90123 45678',
      height: 168, goal: 'Powerlifting meet prep', joined: 210,
      subPlan: 'Annual Premium', subStart: 210, subExpiry: -155,
      weightLog: [[210,64.0],[180,64.8],[120,66.5],[60,67.5],[30,68.0],[0,68.2]],
      attendance: [1,2,3,5,7,8,9,10,12,15,17,19,22,24,26,28,31,33,36,40,45,52,60,70,80],
      photos: [
        [180, 'https://images.unsplash.com/photo-1583500178690-f7c24c6b5ae7?w=400&h=300&fit=crop', 'First meet'],
        [30,  'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=300&fit=crop', 'Building strength'],
      ],
      workout: 'powerlifting', nutrition: 'power',
    },
    { name: 'Rohan Patel', email: 'rohan@example.com', phone: '+91 88776 65544',
      height: 172, goal: 'Recover from injury', joined: 80,
      subPlan: 'Monthly Standard', subStart: 80, subExpiry: 12,   // already expired 12 days ago
      weightLog: [[80,78.0],[60,77.5],[30,77.0],[0,76.5]],
      attendance: [16,18,22,25,30,35,40,50],
      photos: [],
      workout: 'beginner', nutrition: 'balanced',
    },
    { name: 'Meera Iyer', email: 'meera@example.com', phone: '+91 93456 78901',
      height: 158, goal: 'Get started with fitness', joined: 5,
      subPlan: 'Monthly Standard', subStart: 5, subExpiry: -25,
      weightLog: [[5,58.0],[0,58.2]],
      attendance: [1,3],
      photos: [],
      workout: null, nutrition: null,
    },
    { name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 91234 56780',
      height: 182, goal: 'Maintain — long-term member', joined: 720,
      subPlan: 'Annual Premium', subStart: 720, subExpiry: -80,
      weightLog: [[720,88.0],[540,86.5],[360,85.0],[180,84.5],[90,84.0],[30,83.8],[0,84.0]],
      attendance: [0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,18,20,22,25,28,30,33,35,38,40,42,45,48,50,55,60,65,70,80,90],
      photos: [],
      workout: 'ppl', nutrition: 'balanced',
    },
    { name: 'Ananya Nair', email: 'ananya@example.com', phone: '+91 98123 40987',
      height: 165, goal: 'Marathon training', joined: 90,
      subPlan: 'Quarterly Standard', subStart: 90, subExpiry: -2, // expires in 2 days!
      weightLog: [[90,60.0],[60,59.2],[30,58.5],[7,58.0],[0,57.8]],
      attendance: [1,2,3,4,6,7,9,10,12,14,16,18,20,22,25,28,32,38,45,55],
      photos: [
        [60, 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&h=300&fit=crop', 'Long-run Sunday'],
      ],
      workout: 'cardio', nutrition: 'endurance',
    },
    { name: 'Ishaan Kumar', email: 'ishaan@example.com', phone: '+91 98789 65432',
      height: 178, goal: 'Cardio + weight loss', joined: 30,
      subPlan: 'Monthly Premium', subStart: 30, subExpiry: -1, // expires tomorrow!
      weightLog: [[30,85.0],[15,84.0],[7,83.2],[0,82.7]],
      attendance: [1,3,4,7,9,11,14,17,20,24,28],
      photos: [],
      workout: 'cardio', nutrition: 'endurance',
    },
  ];

  const admins = [
    { name: 'Coach Ravi',       email: 'ravi@stellarfitness.in',       joined: 900 },
    { name: 'Dr. Neha Kapoor',  email: 'neha@stellarfitness.in',       joined: 400 },
  ];

  // ---------- Insert admins ----------
  for (const a of admins) {
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, joined)
      VALUES ($1,$2,$3,'admin',$4)
      ON CONFLICT (email) DO NOTHING
    `, [a.name, a.email, DEMO_PW, daysAgo(a.joined)]);
  }

  // ---------- Insert members + related data ----------
  for (const m of members) {
    const row = await q1(`
      INSERT INTO users (name, email, password_hash, role, joined, height, goal, phone,
        subscription_plan, subscription_start, subscription_expiry, workout_plan_json, nutrition_plan_json)
      VALUES ($1,$2,$3,'member',$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (email) DO NOTHING RETURNING id
    `, [
      m.name, m.email, DEMO_PW,
      daysAgo(m.joined), m.height, m.goal, m.phone || null,
      m.subPlan, daysAgo(m.subStart), daysAgo(m.subExpiry),
      m.workout ? plans[m.workout] : null,
      m.nutrition ? nutritions[m.nutrition] : null,
    ]);
    if (!row) continue; // already existed — skip related data
    const id = row.id;

    for (const [d, kg] of m.weightLog) {
      await pool.query('INSERT INTO weight_log (user_id, date, kg) VALUES ($1,$2,$3)', [id, daysAgo(d), kg]);
    }
    for (const d of m.attendance) {
      await pool.query('INSERT INTO attendance (user_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, daysAgo(d)]);
    }
    for (const [d, url, caption] of m.photos) {
      await pool.query('INSERT INTO photos (user_id, date, url, caption) VALUES ($1,$2,$3,$4)', [id, daysAgo(d), url, caption]);
    }
  }

  // ---------- Broadcasts + notifications ----------
  // Get the list of member IDs for broadcast fan-out
  const memberRows = await q("SELECT id, name FROM users WHERE role = 'member'");
  const nameToId = Object.fromEntries(memberRows.map(r => [r.name, r.id]));
  const allMemberIds = memberRows.map(r => r.id);

  // Broadcast 1 — everyone got the welcome offer some time ago (already read)
  const b1Sent = daysAgo(15);
  for (const mid of allMemberIds) {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,$6)',
      [mid, 'offer', '🎁 Welcome offer', 'Enjoy your first protein shake on the house this week!', b1Sent, true]
    );
  }
  await pool.query('INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    ['offer', '🎁 Welcome offer', 'Enjoy your first protein shake on the house this week!', b1Sent, allMemberIds.length, 'Coach Ravi']);

  // Broadcast 2 — recent Diwali promotion (mostly unread)
  const b2Sent = daysAgo(2);
  for (const mid of allMemberIds) {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,$6)',
      [mid, 'offer', '🎉 30% off annual plans!', 'Upgrade to our annual plan this week and save 30%. Chat to the front desk to lock it in.', b2Sent, false]
    );
  }
  await pool.query('INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    ['offer', '🎉 30% off annual plans!', 'Upgrade to our annual plan this week and save 30%. Chat to the front desk to lock it in.', b2Sent, allMemberIds.length, 'Dr. Neha Kapoor']);

  // Broadcast 3 — general holiday hours announcement (read by some)
  const b3Sent = daysAgo(5);
  for (const mid of allMemberIds) {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,$6)',
      [mid, 'general', 'Holiday hours next week', 'The gym will be open from 7am–7pm on public holidays. Trainers available on request.', b3Sent, mid % 2 === 0]
    );
  }
  await pool.query('INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    ['general', 'Holiday hours next week', 'The gym will be open from 7am–7pm on public holidays. Trainers available on request.', b3Sent, allMemberIds.length, 'Coach Ravi']);

  // Individual expiry reminders for members expiring soon
  const expiryTargets = [
    { name: 'Ishaan Kumar',   plan: 'Monthly Premium',    daysLeft: 1  },
    { name: 'Ananya Nair',    plan: 'Quarterly Standard', daysLeft: 2  },
    { name: 'Sanjay Khadka',  plan: 'Monthly Premium',    daysLeft: 7  },
  ];
  for (const t of expiryTargets) {
    const id = nameToId[t.name];
    if (!id) continue;
    const title = t.daysLeft === 1
      ? 'Your subscription expires tomorrow'
      : `Your subscription expires in ${t.daysLeft} days`;
    const body = `Hi ${t.name.split(' ')[0]}, your ${t.plan} plan expires soon. Visit the front desk to renew and avoid interruption.`;
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, 'expiry', title, body, daysAgo(1), false]
    );
    await pool.query('INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
      ['expiry', title, body, daysAgo(1), 1, 'Coach Ravi']);
  }

  // ---------- Subscription plans (catalog) ----------
  const planCatalog = [
    { name: 'Monthly Standard',   price: 1500,  duration_days: 30,  description: 'Access to gym floor, group classes' },
    { name: 'Monthly Premium',    price: 2500,  duration_days: 30,  description: 'All Standard + personal trainer sessions (2/mo)' },
    { name: 'Quarterly Standard', price: 4000,  duration_days: 90,  description: 'Standard access, 3-month lock-in (save ~11%)' },
    { name: 'Annual Premium',     price: 22000, duration_days: 365, description: 'Premium access for a year (save ~27% vs monthly)' },
  ];
  const planPriceByName = {};
  for (const p of planCatalog) {
    await pool.query(
      `INSERT INTO subscription_plans (name, price, duration_days, description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (name) DO NOTHING`,
      [p.name, p.price, p.duration_days, p.description]
    );
    planPriceByName[p.name] = p.price;
  }

  // ---------- Historical payments (one per member matching their subscription) ----------
  const paymentMethods = ['upi', 'cash', 'card', 'bank_transfer'];
  const memberRowsFull = await q("SELECT id, name, subscription_plan, subscription_start FROM users WHERE role='member' ORDER BY id");
  const adminRow = await q1("SELECT id, name FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  for (let i = 0; i < memberRowsFull.length; i++) {
    const m = memberRowsFull[i];
    if (!m.subscription_plan || !m.subscription_start) continue;
    const amt = planPriceByName[m.subscription_plan] || 1500;
    const method = paymentMethods[i % paymentMethods.length];
    const ref = method === 'cash' ? null : `TXN${String(1000 + i * 37).padStart(6, '0')}`;
    await pool.query(
      `INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, recorded_by, recorded_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8)`,
      [m.id, m.subscription_plan, amt, m.subscription_start, method, ref, adminRow.id, adminRow.name]
    );
  }

  // A second historical payment for the long-term members (renewal earlier this year)
  const vetRow = await q1("SELECT id, name, subscription_plan FROM users WHERE email='vikram@example.com'");
  if (vetRow) {
    await pool.query(
      `INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, recorded_by, recorded_by_name)
       VALUES ($1,$2,$3,$4,'upi','TXN000042','paid',$5,$6)`,
      [vetRow.id, vetRow.subscription_plan, planPriceByName[vetRow.subscription_plan] || 22000,
       daysAgo(400), adminRow.id, adminRow.name]
    );
  }
  const kavyaRow = await q1("SELECT id, subscription_plan FROM users WHERE email='kavya@example.com'");
  if (kavyaRow) {
    await pool.query(
      `INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, recorded_by, recorded_by_name)
       VALUES ($1,$2,$3,$4,'bank_transfer','TXN000018','paid',$5,$6)`,
      [kavyaRow.id, kavyaRow.subscription_plan, planPriceByName[kavyaRow.subscription_plan] || 22000,
       daysAgo(120), adminRow.id, adminRow.name]
    );
  }

  // A pending renewal request from Ishaan (whose sub expires tomorrow)
  const ishaanRow = await q1("SELECT id FROM users WHERE email='ishaan@example.com'");
  if (ishaanRow) {
    await pool.query(
      `INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, notes)
       VALUES ($1,'Monthly Premium',2500,$2,'upi','pending','Requested via app renewal')`,
      [ishaanRow.id, todayISO()]
    );
  }

  // ---------- Food entries (a few days of history for a couple of members) ----------
  const sanjayFoodId = (await q1("SELECT id FROM users WHERE email='sanjay.khadka@skyboxindia.in'")).id;
  const kavyaFoodId  = (await q1("SELECT id FROM users WHERE email='kavya@example.com'")).id;
  const foodSeed = [
    // Sanjay — last 3 days
    [sanjayFoodId, 0, 'breakfast', 'Oats with banana and peanut butter', 520, 22, 65, 18, 'web'],
    [sanjayFoodId, 0, 'lunch',     'Grilled chicken (200g), brown rice, salad', 650, 55, 60, 15, 'web'],
    [sanjayFoodId, 0, 'snack',     'Whey protein shake + apple', 280, 30, 25, 3, 'android'],
    [sanjayFoodId, 1, 'breakfast', '4 eggs + toast + coffee', 480, 26, 30, 22, 'android'],
    [sanjayFoodId, 1, 'lunch',     'Fish curry with rice and vegetables', 720, 42, 80, 22, 'web'],
    [sanjayFoodId, 1, 'dinner',    'Paneer stir-fry with quinoa', 590, 32, 50, 26, 'android'],
    [sanjayFoodId, 2, 'breakfast', 'Greek yogurt with berries and granola', 380, 22, 45, 10, 'android'],
    [sanjayFoodId, 2, 'lunch',     'Chicken caesar wrap', 610, 38, 55, 24, 'web'],
    // Kavya — powerlifter, high calorie
    [kavyaFoodId, 0, 'breakfast',  '5 whole eggs + 100g oats + banana', 780, 40, 90, 28, 'android'],
    [kavyaFoodId, 0, 'lunch',      '250g chicken thigh + 200g rice', 880, 60, 100, 24, 'android'],
    [kavyaFoodId, 0, 'snack',      'Protein shake + peanut butter', 450, 32, 35, 20, 'android'],
    [kavyaFoodId, 1, 'breakfast',  '3 eggs + paratha + coffee', 640, 24, 60, 30, 'android'],
  ];
  for (const [uid, dayOffset, meal, name, kcal, p, c, f, source] of foodSeed) {
    await pool.query(
      `INSERT INTO food_entries (user_id, entry_date, meal_type, food_name, calories, protein, carbs, fats, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uid, daysAgo(dayOffset), meal, name, kcal, p, c, f, source]
    );
  }

  console.log(`Seeded ${admins.length} admins, ${members.length} members, ${planCatalog.length} plans, payment history, and ${foodSeed.length} food entries.`);
  console.log('Demo password for all accounts: demo1234');
}

// Phase 2 seed runs independently — safe to call on an existing DB (idempotent via trainer count check)
async function seedPhase2IfNeeded() {
  const { count } = await q1("SELECT COUNT(*)::int AS count FROM users WHERE role = 'trainer'");
  if (count > 0) return; // trainers already exist

  console.log('Seeding Phase 2 demo data (trainers, PT, admissions, expenses)…');

  const hash = pw => bcrypt.hashSync(pw, 10);
  const DEMO_PW = hash('demo1234');
  const adminRow = await q1("SELECT id, name FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  if (!adminRow) { console.log('Phase 2 seed skipped: no admin user found.'); return; }

  // ---------- Trainers ----------
  const trainerDefs = [
    { name: 'Deepak Verma',   email: 'deepak@stellarfitness.in',   phone: '+91 98001 11111',
      specialization: 'Strength & Conditioning', commission: 12, target: 80000, joined: 300 },
    { name: 'Sunita Rao',     email: 'sunita@stellarfitness.in',   phone: '+91 98001 22222',
      specialization: 'Yoga & Weight Loss',      commission: 10, target: 50000, joined: 180 },
    { name: 'Kiran Pillai',   email: 'kiran@stellarfitness.in',    phone: '+91 98001 33333',
      specialization: 'Cardio & HIIT',           commission: 11, target: 65000, joined: 90  },
  ];
  const trainerIds = {};
  for (const t of trainerDefs) {
    const row = await q1(`
      INSERT INTO users (name, email, password_hash, role, joined, phone,
        trainer_commission_rate, trainer_specialization, trainer_monthly_target)
      VALUES ($1,$2,$3,'trainer',$4,$5,$6,$7,$8)
      ON CONFLICT (email) DO NOTHING RETURNING id
    `, [t.name, t.email, DEMO_PW, daysAgo(t.joined), t.phone,
        t.commission, t.specialization, t.target]);
    if (!row) {
      // Email conflict — look up the existing id
      const existing = await q1('SELECT id FROM users WHERE email = $1', [t.email]);
      if (existing) trainerIds[t.name] = existing.id;
    } else {
      trainerIds[t.name] = row.id;
    }
  }

  // Assign trainers to some existing members
  const memberEmailToTrainer = {
    'sanjay.khadka@skyboxindia.in': 'Deepak Verma',
    'kavya@example.com':            'Deepak Verma',
    'priya@example.com':            'Sunita Rao',
    'meera@example.com':            'Sunita Rao',
    'arjun@example.com':            'Kiran Pillai',
    'ananya@example.com':           'Kiran Pillai',
    'ishaan@example.com':           'Kiran Pillai',
  };
  for (const [email, tname] of Object.entries(memberEmailToTrainer)) {
    await pool.query(
      'UPDATE users SET assigned_trainer_id = $1 WHERE email = $2',
      [trainerIds[tname], email]
    );
  }

  // ---------- PT Packages ----------
  const ptPkgDefs = [
    { name: 'Starter Pack',      sessions: 8,  price: 4000,  validity_days: 60,  description: '8 one-on-one sessions — ideal for beginners' },
    { name: 'Pro Pack',          sessions: 16, price: 7500,  validity_days: 90,  description: '16 sessions with personalised programming' },
    { name: 'Elite Pack',        sessions: 24, price: 10000, validity_days: 120, description: '24 sessions with nutrition guidance included' },
    { name: 'Transformation',    sessions: 30, price: 12000, validity_days: 180, description: '30 sessions — complete 6-month body transformation' },
  ];
  const ptPkgIds = {};
  for (const p of ptPkgDefs) {
    const row = await q1(`
      INSERT INTO pt_packages (name, sessions, price, validity_days, description)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [p.name, p.sessions, p.price, p.validity_days, p.description]);
    ptPkgIds[p.name] = row.id;
  }

  // ---------- PT Assignments ----------
  // [memberEmail, trainerName, packageName, sessionsUsed, startDaysAgo, status]
  const ptAssignmentDefs = [
    ['sanjay.khadka@skyboxindia.in', 'Deepak Verma', 'Pro Pack',       10, 60, 'active'],
    ['kavya@example.com',            'Deepak Verma', 'Elite Pack',     18, 90, 'active'],
    ['priya@example.com',            'Sunita Rao',   'Transformation', 12, 75, 'active'],
    ['meera@example.com',            'Sunita Rao',   'Starter Pack',   0,  5,  'active'],
    ['arjun@example.com',            'Kiran Pillai', 'Starter Pack',   4,  30, 'active'],
    ['ananya@example.com',           'Kiran Pillai', 'Pro Pack',       7,  45, 'active'],
    ['ishaan@example.com',           'Kiran Pillai', 'Pro Pack',       16, 95, 'completed'],
  ];
  const ptAssignmentIds = [];
  for (const [email, tname, pkgName, sessUsed, startDays, status] of ptAssignmentDefs) {
    const mRow  = await q1('SELECT id FROM users WHERE email = $1', [email]);
    if (!mRow) continue;
    const pkg   = ptPkgDefs.find(p => p.name === pkgName);
    const tid   = trainerIds[tname];
    const start = daysAgo(startDays);
    const endDate = new Date(); endDate.setDate(endDate.getDate() - startDays + pkg.validity_days);
    const aRow = await q1(`
      INSERT INTO pt_assignments
        (user_id, trainer_id, trainer_name, package_id, package_name,
         sessions_total, sessions_used, price_paid, start_date, end_date, status,
         recorded_by, recorded_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
    `, [mRow.id, tid, tname, ptPkgIds[pkgName], pkgName,
        pkg.sessions, sessUsed, pkg.price, start,
        endDate.toISOString().slice(0,10), status,
        adminRow.id, adminRow.name]);
    ptAssignmentIds.push({ id: aRow.id, sessUsed, memberId: mRow.id, tname });

    // Mirror PT payment
    await pool.query(`
      INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, recorded_by, recorded_by_name)
      VALUES ($1,$2,$3,$4,'cash','paid',$5,$6)
    `, [mRow.id, `PT: ${pkgName}`, pkg.price, start, adminRow.id, adminRow.name]);
  }

  // ---------- PT Sessions (mark used sessions with dates) ----------
  for (const asgn of ptAssignmentIds) {
    const tid = trainerIds[asgn.tname];
    for (let s = 0; s < asgn.sessUsed; s++) {
      const sessionDate = daysAgo(asgn.sessUsed - s); // spread sessions over past N days
      await pool.query(`
        INSERT INTO pt_sessions (assignment_id, session_date, notes, marked_by, marked_by_name)
        VALUES ($1,$2,$3,$4,$5)
      `, [asgn.id, sessionDate, s === 0 ? 'Initial assessment completed' : null, tid, asgn.tname]);
    }
  }

  // ---------- Admissions (spread over past 90 days) ----------
  // Use the real nextReceiptNumber() so receipts are always sequential and never conflict

  // Load plans from DB (works whether Phase 1 seed ran or not)
  const planRows = await q('SELECT id, name, price, duration_days FROM subscription_plans');
  const planIdByName   = Object.fromEntries(planRows.map(r => [r.name, r.id]));
  const planInfoByName = Object.fromEntries(planRows.map(r => [r.name, { price: parseFloat(r.price), duration_days: r.duration_days }]));

  // [memberEmail, type, planName, trainerName|null, payMode, paidAmt, discount, daysAgo]
  const admissionDefs = [
    // ~3 months ago
    ['vikram@example.com',           'renewal', 'Annual Premium',     null,            'upi',           22000, 0,    88],
    ['kavya@example.com',            'renewal', 'Annual Premium',     'Deepak Verma',  'card',          22000, 2000, 85],
    ['sanjay.khadka@skyboxindia.in', 'new',     'Monthly Premium',    'Deepak Verma',  'cash',          2500,  0,    75],
    // ~2 months ago (last month dense)
    ['arjun@example.com',            'new',     'Annual Premium',     'Kiran Pillai',  'upi',           22000, 0,    60],
    ['priya@example.com',            'new',     'Quarterly Standard', 'Sunita Rao',    'card',          4000,  0,    57],
    ['rohan@example.com',            'renewal', 'Monthly Standard',   null,            'cash',          1500,  0,    55],
    ['kavya@example.com',            'new',     'Monthly Premium',    'Deepak Verma',  'upi',           2500,  0,    52],
    ['vikram@example.com',           'renewal', 'Monthly Standard',   null,            'bank_transfer', 1500,  0,    50],
    ['ananya@example.com',           'new',     'Quarterly Standard', 'Kiran Pillai',  'upi',           4000,  500,  48],
    ['meera@example.com',            'new',     'Monthly Standard',   'Sunita Rao',    'cash',          1500,  0,    45],
    ['ishaan@example.com',           'renewal', 'Monthly Premium',    'Kiran Pillai',  'card',          2500,  0,    42],
    ['sanjay.khadka@skyboxindia.in', 'renewal', 'Monthly Premium',    'Deepak Verma',  'upi',           2500,  0,    40],
    ['rohan@example.com',            'new',     'Monthly Standard',   null,            'cash',          1000,  0,    38],
    ['priya@example.com',            'renewal', 'Quarterly Standard', 'Sunita Rao',    'cash',          4000,  0,    35],
    ['arjun@example.com',            'renewal', 'Annual Premium',     'Kiran Pillai',  'upi',           22000, 0,    33],
    // ~This month (dense)
    ['meera@example.com',            'renewal', 'Monthly Standard',   'Sunita Rao',    'upi',           1500,  0,    26],
    ['ananya@example.com',           'renewal', 'Quarterly Standard', 'Kiran Pillai',  'upi',           3500,  500,  24],
    ['kavya@example.com',            'renewal', 'Monthly Premium',    'Deepak Verma',  'cash',          2500,  0,    22],
    ['vikram@example.com',           'renewal', 'Annual Premium',     null,            'card',          22000, 0,    20],
    ['ishaan@example.com',           'new',     'Monthly Premium',    'Kiran Pillai',  'upi',           2500,  0,    18],
    ['rohan@example.com',            'renewal', 'Monthly Standard',   null,            'cash',          1500,  0,    16],
    ['sanjay.khadka@skyboxindia.in', 'renewal', 'Monthly Premium',    'Deepak Verma',  'card',          2500,  0,    14],
    ['priya@example.com',            'new',     'Monthly Standard',   'Sunita Rao',    'cash',          1500,  0,    12],
    ['arjun@example.com',            'renewal', 'Annual Premium',     'Kiran Pillai',  'upi',           5000,  0,    9],  // partial
    ['meera@example.com',            'new',     'Monthly Standard',   'Sunita Rao',    'upi',           1500,  0,    7],
    ['ananya@example.com',           'new',     'Monthly Premium',    'Kiran Pillai',  'card',          2500,  0,    5],
    ['kavya@example.com',            'renewal', 'Annual Premium',     'Deepak Verma',  'upi',           22000, 2000, 3],
    ['rohan@example.com',            'new',     'Monthly Standard',   null,            'cash',          1500,  0,    2],
  ];

  for (const [email, type, planName, tname, payMode, paid, discount, daysBefore] of admissionDefs) {
    const mRow = await q1('SELECT id, name FROM users WHERE email = $1', [email]);
    if (!mRow) continue;
    const plan = planInfoByName[planName];
    if (!plan) continue;
    const tid       = tname ? trainerIds[tname] : null;
    const admDate   = daysAgo(daysBefore);
    const startDate = admDate;
    const expDate   = new Date(admDate); expDate.setDate(expDate.getDate() + plan.duration_days);
    const endDate   = expDate.toISOString().slice(0, 10);
    const balance   = Math.max(0, plan.price - discount - paid);
    const rec       = await nextReceiptNumber();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO admissions
          (user_id, admission_date, receipt_number, type, plan_id, plan_name, plan_price,
           trainer_id, trainer_name, payment_mode, paid_amount, discount, balance,
           start_date, end_date, recorded_by, recorded_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (receipt_number) DO NOTHING
      `, [mRow.id, admDate, rec, type,
          planIdByName[planName] || null, planName, plan.price,
          tid, tname || null, payMode, paid, discount, balance,
          startDate, endDate, adminRow.id, adminRow.name]);

      if (paid > 0) {
        await client.query(`
          INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, notes, recorded_by, recorded_by_name)
          VALUES ($1,$2,$3,$4,$5,'paid',$6,$7,$8)
        `, [mRow.id, planName, paid, admDate, payMode, `Receipt ${rec}`, adminRow.id, adminRow.name]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  // ---------- Expenses (3 months of history) ----------
  const expenseDefs = [
    // 3 months ago
    ['rent',          25000, 'Monthly rent — ground floor',         90],
    ['electricity',   8200,  'Electricity bill — June',             88],
    ['salary',        18000, 'Deepak Verma — trainer salary',       85],
    ['salary',        15000, 'Sunita Rao — trainer salary',         85],
    ['salary',        16000, 'Kiran Pillai — trainer salary',       85],
    ['cleaning',      2500,  'Monthly housekeeping & sanitisation',  82],
    ['maintenance',   4500,  'Treadmill belt replacement',           78],
    ['marketing',     3000,  'Instagram ads — June campaign',        75],
    // 2 months ago
    ['rent',          25000, 'Monthly rent — ground floor',         60],
    ['electricity',   9100,  'Electricity bill — July',             58],
    ['salary',        18000, 'Deepak Verma — trainer salary',       55],
    ['salary',        15000, 'Sunita Rao — trainer salary',         55],
    ['salary',        16000, 'Kiran Pillai — trainer salary',       55],
    ['cleaning',      2500,  'Monthly housekeeping & sanitisation',  52],
    ['maintenance',   1200,  'AC servicing — two units',             48],
    ['misc',          800,   'First aid kit restock',                45],
    ['marketing',     5000,  'Pamphlet distribution + Google Ads',  42],
    // Last month
    ['rent',          25000, 'Monthly rent — ground floor',         30],
    ['electricity',   7600,  'Electricity bill — Aug',              28],
    ['salary',        18000, 'Deepak Verma — trainer salary',       25],
    ['salary',        15000, 'Sunita Rao — trainer salary',         25],
    ['salary',        16000, 'Kiran Pillai — trainer salary',       25],
    ['cleaning',      2500,  'Monthly housekeeping & sanitisation',  22],
    ['maintenance',   6800,  'Dumbell set replacement (5–20 kg)',    18],
    ['misc',          1500,  'Stationery & printer ink',             12],
    ['marketing',     4000,  'New membership drive — digital ads',   8],
    // This month
    ['rent',          25000, 'Monthly rent — ground floor',          26],
    ['salary',        18000, 'Deepak Verma — trainer salary',        24],
    ['salary',        15000, 'Sunita Rao — trainer salary',          24],
    ['salary',        16000, 'Kiran Pillai — trainer salary',        24],
    ['electricity',    8100, 'Electricity bill',                     22],
    ['cleaning',       2500, 'Monthly housekeeping',                 20],
    ['maintenance',    3200, 'Cable machine repair',                 17],
    ['marketing',      6000, 'New member drive — banners + digital', 14],
    ['misc',            900, 'Water dispenser servicing',            10],
    ['rent',          25000, 'Monthly rent — ground floor',           5],
    ['salary',        18000, 'Deepak Verma — trainer salary',         3],
    ['salary',        15000, 'Sunita Rao — trainer salary',           3],
    ['salary',        16000, 'Kiran Pillai — trainer salary',         3],
    ['electricity',    6400, 'Electricity bill — partial',            2],
  ];

  for (const [category, amount, description, daysBefore] of expenseDefs) {
    await pool.query(`
      INSERT INTO expenses (expense_date, category, amount, description, recorded_by, recorded_by_name)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [daysAgo(daysBefore), category, amount, description, adminRow.id, adminRow.name]);
  }

  // ---------- Attendance — fill last 60 days for all members ----------
  const memberUserRows = await q("SELECT id FROM users WHERE role = 'member'");
  const today60 = new Date(); today60.setDate(today60.getDate() - 60);
  for (let d = 0; d < 60; d++) {
    const dt = new Date(today60); dt.setDate(dt.getDate() + d);
    if (dt.getDay() === 0) continue; // skip Sundays
    const ds = dt.toISOString().slice(0, 10);
    for (const { id } of memberUserRows) {
      if (Math.random() < 0.62) {
        await pool.query('INSERT INTO attendance (user_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, ds]);
      }
    }
  }

  console.log(`Phase 2 seeded: ${trainerDefs.length} trainers, ${ptPkgDefs.length} PT packages, ${ptAssignmentIds.length} PT assignments, ${admissionDefs.length} admissions, ${expenseDefs.length} expenses + 60 days attendance.`);
}

async function seedWorkoutLogsIfNeeded() {
  const { count } = await q1('SELECT COUNT(*)::int AS count FROM workout_logs');
  if (count > 0) return; // already seeded

  console.log('Seeding workout log history…');

  // plan name → days array (Mon…Sun, index 0-6). Each item: { exercise, muscleGroup }
  const wlPlans = {
    ppl: [
      [{ e:'Bench Press',w:[80,2.5] },{ e:'Overhead Press',w:[55,2.5] },{ e:'Incline Bench Press',w:[70,2.5] },{ e:'Tricep Pushdown',w:[25,2.5] }],
      [{ e:'Deadlift',w:[120,5] },{ e:'Pull-ups',w:null },{ e:'Barbell Row',w:[70,2.5] }],
      [{ e:'Back Squat',w:[100,5] },{ e:'Romanian Deadlift',w:[80,2.5] },{ e:'Calf Raises',w:[30,2.5] }],
      [], // Thu rest
      [{ e:'Incline Bench Press',w:[70,2.5] },{ e:'Chest Dips',w:null },{ e:'Lateral Raises',w:[12,1] }],
      [{ e:'Lat Pulldown',w:[60,2.5] },{ e:'Seated Cable Row',w:[50,2.5] },{ e:'Barbell Curl',w:[30,2.5] }],
      [], // Sun rest
    ],
    powerlifting: [
      [{ e:'Back Squat',w:[85,2.5] },{ e:'Front Squat',w:[65,2.5] },{ e:'Plank',w:null }],
      [], // Tue rest
      [{ e:'Bench Press',w:[65,2.5] },{ e:'Overhead Press',w:[45,2.5] },{ e:'Skull Crushers',w:[25,2.5] }],
      [{ e:'Foam Rolling',w:null }],
      [{ e:'Deadlift',w:[110,5] },{ e:'Barbell Row',w:[60,2.5] },{ e:'Pull-ups',w:null }],
      [{ e:'Barbell Curl',w:[25,2.5] },{ e:'Tricep Pushdown',w:[20,2.5] }],
      [], // Sun rest
    ],
    fatLoss: [
      [{ e:'Back Squat',w:[50,2.5] },{ e:'Push-ups',w:null },{ e:'Dumbbell Row',w:[20,2.5] },{ e:'Plank',w:null }],
      [{ e:'HIIT Intervals',w:null },{ e:'Rowing',w:null }],
      [{ e:'Leg Press',w:[80,5] },{ e:'Hip Thrust',w:[40,2.5] }],
      [], // Thu rest
      [{ e:'Lat Pulldown',w:[45,2.5] },{ e:'Overhead Press',w:[30,2.5] }],
      [{ e:'Stationary Bike',w:null }],
      [], // Sun rest
    ],
    beginner: [
      [{ e:'Bench Press',w:[40,2.5] },{ e:'Lat Pulldown',w:[30,2.5] },{ e:'Overhead Press',w:[25,2.5] },{ e:'Barbell Curl',w:[15,2.5] }],
      [], // Tue rest
      [{ e:'Leg Press',w:[60,5] },{ e:'Leg Curl',w:[25,2.5] },{ e:'Leg Extension',w:[25,2.5] },{ e:'Crunches',w:null }],
      [{ e:'Elliptical',w:null }],
      [{ e:'Push-ups',w:null },{ e:'Seated Cable Row',w:[30,2.5] },{ e:'Tricep Pushdown',w:[15,2.5] }],
      [{ e:'Yoga Flow',w:null }],
      [], // Sun rest
    ],
    cardio: [
      [{ e:'Treadmill Run',w:null }],
      [{ e:'Stationary Bike',w:null },{ e:'Plank',w:null }],
      [{ e:'HIIT Intervals',w:null }],
      [{ e:'Walk',w:null }],
      [{ e:'Treadmill Run',w:null }],
      [{ e:'Back Squat',w:[40,2.5] },{ e:'Push-ups',w:null },{ e:'Pull-ups',w:null }],
      [], // Sun rest
    ],
  };

  const members = [
    { email: 'sanjay.khadka@skyboxindia.in', plan: 'ppl' },
    { email: 'kavya@example.com',            plan: 'powerlifting' },
    { email: 'priya@example.com',            plan: 'fatLoss' },
    { email: 'rohan@example.com',            plan: 'beginner' },
    { email: 'vikram@example.com',           plan: 'ppl' },
    { email: 'ananya@example.com',           plan: 'cardio' },
    { email: 'ishaan@example.com',           plan: 'cardio' },
  ];

  // JS getDay(): 0=Sun 1=Mon … 6=Sat → plan index 0=Mon … 6=Sun
  const dowToIdx = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 0:6 };

  for (const { email, plan } of members) {
    const row = await q1('SELECT id FROM users WHERE email = $1', [email]);
    if (!row) continue;
    const uid = row.id;
    const days = wlPlans[plan];

    for (let daysBack = 30; daysBack >= 1; daysBack--) {
      if (Math.random() > 0.70) continue;
      const dt = new Date(); dt.setDate(dt.getDate() - daysBack);
      if (dt.getDay() === 0) continue;
      const ds = dt.toISOString().slice(0, 10);

      const dayItems = days[dowToIdx[dt.getDay()]];
      if (!dayItems || dayItems.length === 0) continue;

      const weeksAgo = Math.floor(daysBack / 7);
      const completed = dayItems
        .filter(() => Math.random() > 0.1)
        .map(({ e, w }) => {
          let weight = null;
          if (w) {
            const val = w[0] + Math.max(0, 4 - weeksAgo) * w[1];
            weight = Math.round(val * 2) / 2;
          }
          return { exercise: e, weight };
        });

      if (completed.length === 0) continue;
      await pool.query(
        `INSERT INTO workout_logs (user_id, date, completed)
         VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO NOTHING`,
        [uid, ds, JSON.stringify(completed)]
      );
    }
  }

  const { count: wlCount } = await q1('SELECT COUNT(*)::int AS count FROM workout_logs');
  console.log(`Workout logs seeded: ${wlCount} entries across 7 members.`);
}

// ============================== Helpers ==============================
function toUser(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, email: row.email, role: row.role, joined: row.joined,
    height: row.height, goal: row.goal, phone: row.phone || null,
    // Extended profile
    dateOfBirth:  row.date_of_birth  || null,
    bloodGroup:   row.blood_group    || null,
    photoUrl:     row.photo_url      || null,
    medicalHistory: row.medical_history || null,
    emergencyContact: {
      name:     row.emergency_contact_name     || null,
      phone:    row.emergency_contact_phone    || null,
      relation: row.emergency_contact_relation || null,
    },
    assignedTrainerId: row.assigned_trainer_id || null,
    memberType: row.member_type || 'regular',
    batchId: row.batch_id || null,
    permissions: row.permissions || [],
    // Trainer-specific fields (only meaningful when role === 'trainer')
    trainerCommissionRate: row.trainer_commission_rate != null ? parseFloat(row.trainer_commission_rate) : 10,
    trainerSpecialization: row.trainer_specialization || null,
    trainerMonthlyTarget:  row.trainer_monthly_target != null ? parseFloat(row.trainer_monthly_target) : null,
    trainerSessionDurationMinutes: row.trainer_session_duration_minutes || 60,
    subscription: row.subscription_plan ? {
      plan: row.subscription_plan,
      startDate: row.subscription_start,
      expiryDate: row.subscription_expiry,
    } : null,
    workoutPlan: row.workout_plan_json || null,
    nutritionPlan: row.nutrition_plan_json || null,
  };
}

async function fullUser(id) {
  const u = toUser(await q1('SELECT * FROM users WHERE id = $1', [id]));
  if (!u) return null;
  u.weightLog    = await q('SELECT date, kg FROM weight_log WHERE user_id = $1 ORDER BY date', [id]);
  u.photos       = await q('SELECT id, date, url, caption FROM photos WHERE user_id = $1 ORDER BY date DESC', [id]);
  u.attendance   = (await q('SELECT date FROM attendance WHERE user_id = $1 ORDER BY date', [id])).map(r => r.date);
  u.notifications = (await q('SELECT id, type, title, body, sent, is_read FROM notifications WHERE user_id = $1 ORDER BY sent DESC', [id]))
    .map(n => ({ id: n.id, type: n.type, title: n.title, body: n.body, sent: n.sent, read: !!n.is_read }));
  return u;
}

async function memberList() {
  const rows = await q("SELECT * FROM users WHERE role = 'member' ORDER BY name");
  const results = [];
  for (const r of rows) {
    const u = toUser(r);
    u.weightLog  = await q('SELECT date, kg FROM weight_log WHERE user_id = $1 ORDER BY date', [r.id]);
    u.attendance = (await q('SELECT date FROM attendance WHERE user_id = $1', [r.id])).map(x => x.date);
    results.push(u);
  }
  return results;
}

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

// ============================== App ==============================
const app = express();

// CORS is scoped to just the public leads endpoint below — everything else
// (login, admin/trainer/member dashboards) is served same-origin from this
// app's own public/ folder and must never be gated by an origin allowlist,
// or the browser's same-origin requests to e.g. /api/auth/login get rejected
// too (they still carry an Origin header even though same-origin).
const allowedOrigins = PUBLIC_SITE_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
const publicSiteCors = cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
});

app.use(express.json({ limit: '4mb' }));
// Backend's own pages (admin/login/trainer-portal/etc.) always win on a name
// collision, since this is registered first.
app.use(express.static(path.join(__dirname, 'public')));

// The public marketing site (Next.js, built via `npm run build` at the repo
// root with output: "export") gets served from the SAME origin/process as
// the API and the admin pages above — one deployable unit, no second
// project, no cross-origin rewrites to keep in sync. `next build` writes
// flat files like `about.html` for the `/about` route; `extensions: ['html']`
// is what lets a request for `/about` resolve to that file.
const MARKETING_SITE_DIR = path.join(__dirname, '..', 'out');
if (fs.existsSync(MARKETING_SITE_DIR)) {
  // `next export` writes each route as both a flat `<route>.html` file (e.g.
  // about.html for /about) *and* a same-named directory holding non-page RSC
  // payload data with no index.html inside. express.static's directory-then-
  // index resolution finds that directory first and redirects/404s before
  // ever trying the .html file, so extension-less paths are resolved by hand
  // here first; express.static below just handles /_next/*, favicon, etc.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (path.extname(req.path)) return next();
    const candidate = path.join(MARKETING_SITE_DIR, req.path === '/' ? 'index.html' : `${req.path}.html`);
    if (fs.existsSync(candidate)) return res.sendFile(candidate);
    next();
  });
  app.use(express.static(MARKETING_SITE_DIR));
}

// ---- Lazy init (runs once, shared across serverless invocations) ----
let initPromise = null;
function initOnce() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureDatabase();
      await initSchema();
      // Demo/seed data is opt-in only. This is a real gym's production data
      // now — without this guard, deleting the last trainer (or any similar
      // "table looks empty" condition) would silently reseed fake accounts
      // and admissions back into a live database.
      if (process.env.SEED_DEMO_DATA === 'true') {
        await seedIfEmpty();
        await seedPhase2IfNeeded();
        await seedWorkoutLogsIfNeeded();
      }
    })().catch(err => { initPromise = null; throw err; });
  }
  return initPromise;
}
// Every API request awaits the shared init promise. Basically free after the
// first successful call — subsequent requests get an already-resolved promise.
app.use('/api', async (req, res, next) => {
  try { await initOnce(); next(); }
  catch (e) {
    console.error('DB init failed:', e.message);
    res.status(503).json({ error: 'Database not ready' });
  }
});

// ---- File uploads (progress photos) ----
// Serverless filesystems are read-only outside /tmp and files don't persist
// between invocations. On Vercel we disable disk uploads and members should
// paste a URL instead.
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!IS_SERVERLESS) {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase().slice(0, 5);
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

// Trainer certificates/photos — same storage, but certificates are commonly
// PDFs, so this filter is a bit more permissive than the image-only one above.
const uploadDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase().slice(0, 5);
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype) && file.mimetype !== 'application/pdf') {
      return cb(new Error('Only image or PDF files are allowed'));
    }
    cb(null, true);
  },
});

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired session' }); }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireTrainer(req, res, next) {
  if (!req.user || (req.user.role !== 'trainer' && req.user.role !== 'admin'))
    return res.status(403).json({ error: 'Trainer only' });
  next();
}

// ---- Granular permissions (staff accounts, and trainers granted extras) ----
// Single source of truth: also served via GET /api/admin/permissions so the
// "Add Trainer / Staff" UI can build its checklist from this list instead of
// hardcoding it twice.
const PERMISSION_CATALOG = [
  { key: 'members.manage',     label: 'Add & manage members',        group: 'Members' },
  { key: 'batches.manage',     label: 'Manage batches',               group: 'Members' },
  { key: 'attendance.manage',  label: 'Attendance & check-in QR',     group: 'Members' },
  { key: 'pt.manage',          label: 'PT packages & assignments',    group: 'Personal Training' },
  { key: 'trainers.manage',    label: 'Add & manage trainers',        group: 'Team' },
  { key: 'enquiries.manage',   label: 'Enquiries & leads',            group: 'Front Desk' },
  { key: 'notifications.send', label: 'Send WhatsApp & notifications',group: 'Front Desk' },
  { key: 'expenses.manage',    label: 'Manage expenses',              group: 'Money' },
  { key: 'finance.view',       label: 'View & record revenue/payments', group: 'Money' },
  { key: 'reports.view',       label: 'Reports (profit split, commissions)', group: 'Money' },
];
const PERMISSION_KEYS = PERMISSION_CATALOG.map(p => p.key);
const STAFF_DEFAULT_PERMISSIONS = ['members.manage', 'batches.manage', 'attendance.manage'];

function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(k => PERMISSION_KEYS.includes(k)))];
}

async function userHasPermission(user, key) {
  if (user.role === 'admin') return true;
  const row = await q1('SELECT permissions FROM users WHERE id = $1', [user.id]);
  const perms = (row && row.permissions) || [];
  return Array.isArray(perms) && perms.includes(key);
}

// Gate a route behind a single permission — admins always pass.
function requirePermission(key) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'admin') return next();
    try {
      if (await userHasPermission(req.user, key)) return next();
      res.status(403).json({ error: 'You do not have permission to do this' });
    } catch (e) { next(e); }
  };
}

// Gate a route behind ANY of several permissions — used by shared utilities
// (like the generic file-upload route) that several different roles rely on.
function requireAnyPermission(keys) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'admin') return next();
    try {
      const row = await q1('SELECT permissions FROM users WHERE id = $1', [req.user.id]);
      const perms = (row && row.permissions) || [];
      if (Array.isArray(perms) && keys.some(k => perms.includes(k))) return next();
      res.status(403).json({ error: 'You do not have permission to do this' });
    } catch (e) { next(e); }
  };
}

// Trainer-portal routes are scoped by trainer_id = req.user.id everywhere,
// which would leave an admin (who isn't literally the assigned trainer)
// seeing an empty portal. Admin gets full access instead: pass ?trainerId=
// to view/act as that trainer; a real trainer always acts as themselves.
function effectiveTrainerId(req) {
  if (req.user.role === 'admin' && req.query.trainerId) {
    return parseInt(req.query.trainerId, 10);
  }
  return req.user.id;
}

// Small wrapper so thrown errors in async handlers become 500s
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- Audit log helpers ----
// Fields we log edits for. Anything else (bcrypt hashes, JSON plan blobs, etc.)
// is intentionally excluded from the diff.
const AUDITED_FIELDS = ['name', 'email', 'phone', 'goal', 'height',
  'subscription_plan', 'subscription_start', 'subscription_expiry'];

function diffRows(before, after) {
  const changes = {};
  for (const f of AUDITED_FIELDS) {
    if (before[f] !== after[f] && !(before[f] == null && after[f] == null)) {
      changes[f] = { from: before[f] ?? null, to: after[f] ?? null };
    }
  }
  return changes;
}

async function recordEdit({ userId, editor, changes }) {
  if (!changes || Object.keys(changes).length === 0) return;
  await pool.query(
    `INSERT INTO edit_log (user_id, edited_by_id, edited_by_name, edited_by_role, changes)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, editor.id, editor.name, editor.role, changes]
  );
}

// Apply a validated set of column updates + write audit trail.
// updates = { column: value, ... }.  editor = { id, name, role }.
async function updateUserWithAudit(userId, updates, editor) {
  const before = await q1('SELECT * FROM users WHERE id = $1', [userId]);
  if (!before) throw new Error('User not found');

  const parts = []; const vals = []; let i = 1;
  for (const [k, v] of Object.entries(updates)) {
    parts.push(`${k} = $${i++}`); vals.push(v);
  }
  if (parts.length === 0) return before;
  vals.push(userId);
  await pool.query(`UPDATE users SET ${parts.join(', ')} WHERE id = $${i}`, vals);

  const after = await q1('SELECT * FROM users WHERE id = $1', [userId]);
  await recordEdit({ userId, editor, changes: diffRows(before, after) });
  return after;
}

// ============================== WhatsApp ==============================
// Strips everything except digits. WhatsApp needs the full E.164 number without
// the leading '+' (e.g. India: 919812345678).
function normalisePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  // If someone stored a 10-digit Indian mobile without country code, assume +91.
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Trainer commission split, tiered by how many active clients they carry
// this month: >= 10 active clients -> 60% trainer / 40% gym, otherwise
// 50% / 50%. Partner trainers keep 100% of their own personal-training
// revenue regardless of client count (membership/admission revenue still
// follows the normal client-count tier even for partners).
const PT_TIER_CLIENT_THRESHOLD = 10;
function commissionRates({ isPartner, activeClients }) {
  const membershipRate = activeClients >= PT_TIER_CLIENT_THRESHOLD ? 60 : 50;
  const ptRate = isPartner ? 100 : membershipRate;
  return { ptRate, membershipRate };
}

function buildReminderMessage({ memberName, plan, daysLeft, expiryDate }) {
  const firstName = memberName.split(' ')[0];
  const expiryPretty = new Date(expiryDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const status =
    daysLeft < 0  ? `expired ${Math.abs(daysLeft)} day${daysLeft === -1 ? '' : 's'} ago (on ${expiryPretty})` :
    daysLeft === 0 ? `expires today (${expiryPretty})` :
    daysLeft === 1 ? `expires tomorrow (${expiryPretty})` :
                     `expires in ${daysLeft} days (on ${expiryPretty})`;
  return `Hi ${firstName} 👋

Friendly reminder from *Stellar Fitness Club* — your *${plan}* membership ${status}.

Please drop by the front desk to renew, or reply here to arrange payment. We don't want you to miss a session!

— Team Stellar Fitness`;
}

// Plain ASCII on purpose (no emoji) — WhatsApp's own wa.me send-preview page
// has been observed mangling multi-byte emoji into replacement characters on
// its preview screen, even though the underlying link is correctly encoded.
// Asterisks for *bold* are WhatsApp's own markdown and render fine.
function buildDietPlanMessage({ memberName, trainerName, plan }) {
  const firstName = memberName.split(' ')[0];
  const macros = [
    plan.calories ? `${plan.calories} kcal` : null,
    plan.protein  ? `${plan.protein}g protein` : null,
    plan.carbs    ? `${plan.carbs}g carbs` : null,
    plan.fats     ? `${plan.fats}g fat` : null,
  ].filter(Boolean).join(' · ');

  const meals = (plan.meals || [])
    .filter(m => m.name)
    .map(m => `*${m.name}*\n${m.items || '—'}`)
    .join('\n\n');

  return `Hi ${firstName},

Here's your updated diet plan from *${trainerName}* at *Stellar Fitness Club*:
${macros ? `\nDaily target: ${macros}\n` : ''}
${meals || 'Your trainer will add meal details shortly.'}

Stick to this and let your trainer know how it's going.

— ${trainerName}, Stellar Fitness Club`;
}

function buildWorkoutPlanMessage({ memberName, trainerName, plan }) {
  const firstName = memberName.split(' ')[0];
  const days = (plan.days || [])
    .filter(d => (d.items || []).length > 0)
    .map(d => {
      const exercises = d.items.map(it => {
        const name = typeof it === 'string' ? it : it.exercise;
        const sets = typeof it === 'object' && it.sets ? ` (${it.sets})` : '';
        return `  • ${name}${sets}`;
      }).join('\n');
      return `*${d.day}${d.focus ? ` — ${d.focus}` : ''}*\n${exercises}`;
    })
    .join('\n\n');

  return `Hi ${firstName},

Here's your updated workout plan${plan.name ? ` — *${plan.name}*` : ''} from *${trainerName}* at *Stellar Fitness Club*:

${days || 'Your trainer will add exercise details shortly.'}

Stick to this and let your trainer know how it's going.

— ${trainerName}, Stellar Fitness Club`;
}

// Generic WhatsApp text sender (diet plans, and anything else that isn't the
// subscription-reminder template below). Same api/link fallback behaviour.
async function sendWhatsAppText({ phone, message }) {
  const to = normalisePhone(phone);
  if (!to) throw new Error('Member has no phone number on file');

  if (WA_CONFIGURED) {
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message, preview_url: false } }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp API error (${res.status}): ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return { mode: 'api', phone: to, message, messageId: data.messages?.[0]?.id || null };
  }

  return { mode: 'link', phone: to, message, link: `https://wa.me/${to}?text=${encodeURIComponent(message)}` };
}

// Renders a one-page PDF invoice straight into a Buffer — no disk write, so
// this works the same on a serverless host (Vercel) as it does locally.
function buildInvoicePdfBuffer({ payment, memberName, memberPhone }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const amountPretty = Number(payment.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const datePretty = new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.fontSize(22).fillColor('#111').text('Stellar Fitness Club', { continued: false });
    doc.fontSize(10).fillColor('#555').text(COMPANY_NAME);
    doc.moveDown(1.5);

    doc.fontSize(16).fillColor('#111').text('Payment Receipt / Invoice');
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor('#333');
    doc.text(`Invoice #: INV-${String(payment.id).padStart(6, '0')}`);
    doc.text(`Date: ${datePretty}`);
    doc.moveDown(0.6);
    doc.text(`Billed to: ${memberName}`);
    if (memberPhone) doc.text(`Phone: ${memberPhone}`);
    doc.moveDown(1);

    const tableTop = doc.y;
    doc.fontSize(11).fillColor('#111');
    doc.text('Description', 50, tableTop, { width: 300 });
    doc.text('Amount', 400, tableTop, { width: 100, align: 'right' });
    doc.moveTo(50, tableTop + 18).lineTo(500, tableTop + 18).strokeColor('#ccc').stroke();

    const rowY = tableTop + 28;
    doc.fontSize(11).fillColor('#333');
    doc.text(payment.plan_name || 'Payment', 50, rowY, { width: 300 });
    doc.text(`INR ${amountPretty}`, 400, rowY, { width: 100, align: 'right' });
    doc.moveTo(50, rowY + 24).lineTo(500, rowY + 24).strokeColor('#ccc').stroke();

    doc.fontSize(13).fillColor('#111').text('Total Paid', 50, rowY + 36, { width: 300 });
    doc.fontSize(13).fillColor('#111').text(`INR ${amountPretty}`, 400, rowY + 36, { width: 100, align: 'right' });

    doc.moveDown(4);
    doc.fontSize(10).fillColor('#555');
    doc.text(`Method: ${(payment.method || 'cash').toUpperCase()}${payment.reference ? `   •   Reference: ${payment.reference}` : ''}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#888').text('This is a computer-generated invoice from Stellar Fitness Club and does not require a signature.');

    doc.end();
  });
}

// Public, token-gated (not full login) so a member tapping the WhatsApp link
// can open their own invoice without needing to be signed in. Token is an
// HMAC of the payment id under JWT_SECRET, not a guessable sequential id.
function invoiceToken(paymentId) {
  return crypto.createHmac('sha256', JWT_SECRET).update(String(paymentId)).digest('hex').slice(0, 24);
}

app.get('/api/invoices/:id.pdf', wrap(async (req, res) => {
  const id = req.params.id;
  if (req.query.t !== invoiceToken(id)) return res.status(403).json({ error: 'Invalid or expired invoice link' });
  const p = await q1(`
    SELECT pay.*, u.name AS member_name, u.phone AS member_phone
    FROM payments pay LEFT JOIN users u ON u.id = pay.user_id
    WHERE pay.id = $1
  `, [id]);
  if (!p) return res.status(404).json({ error: 'Invoice not found' });
  const pdfBuffer = await buildInvoicePdfBuffer({ payment: p, memberName: p.member_name, memberPhone: p.member_phone });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
  res.send(pdfBuffer);
}));

// Uploads a PDF buffer to WhatsApp's Media API and returns a media id —
// needed before it can be attached to a 'document' message.
async function uploadWhatsAppMedia(buffer, filename) {
  const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/media`;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, body: form });
  if (!res.ok) throw new Error(`WhatsApp media upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.id;
}

function buildReceiptMessage({ memberName, planName, amount, paymentDate, method, reference }) {
  const firstName = memberName.split(' ')[0];
  const datePretty = new Date(paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const amountPretty = Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return `Hi ${firstName},

Payment received — thank you!

*Stellar Fitness Club — Receipt*
Item: ${planName}
Amount: ₹${amountPretty}
Date: ${datePretty}
Method: ${(method || 'cash').toUpperCase()}${reference ? `\nReference: ${reference}` : ''}

Keep this message as your receipt.

— Team Stellar Fitness`;
}

// Sends a WhatsApp payment reminder. Returns { mode, phone, message, link? }
// mode = 'api'  → sent via Meta Cloud API
//        'link' → returning a wa.me deep link (admin will click Send)
async function sendWhatsAppReminder({ phone, memberName, plan, daysLeft, expiryDate }) {
  const to = normalisePhone(phone);
  if (!to) throw new Error('Member has no phone number on file');

  const message = buildReminderMessage({ memberName, plan, daysLeft, expiryDate });

  if (WA_CONFIGURED) {
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

    // Two modes: approved template (recommended for outbound), or plain text
    // (only allowed within a 24-hour session with the user).
    const payload = WHATSAPP_TEMPLATE
      ? {
          messaging_product: 'whatsapp', to, type: 'template',
          template: {
            name: WHATSAPP_TEMPLATE,
            language: { code: 'en' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: memberName.split(' ')[0] },
                { type: 'text', text: plan },
                { type: 'text', text: String(daysLeft) },
              ],
            }],
          },
        }
      : {
          messaging_product: 'whatsapp', to, type: 'text',
          text: { body: message, preview_url: false },
        };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp API error (${res.status}): ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return { mode: 'api', phone: to, message, messageId: data.messages?.[0]?.id || null };
  }

  // Fallback: wa.me deep link (works in browser + WhatsApp Desktop/mobile)
  return {
    mode: 'link',
    phone: to,
    message,
    link: `https://wa.me/${to}?text=${encodeURIComponent(message)}`,
  };
}

// -------- Auth --------
// Public self-signup is intentionally disabled — accounts (member, trainer,
// staff) are only ever created by admin, who then sends login credentials
// over WhatsApp. This route is kept (rather than deleted) so old clients get
// a clear error instead of a broken 404, and so the behaviour is visible and
// easy to find instead of silently vanishing.
app.post('/api/auth/signup', wrap(async (req, res) => {
  res.status(403).json({ error: 'Accounts are created by the gym — visit the front desk or contact admin to get set up.' });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const row = await q1('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  if (!row) return res.status(401).json({ error: 'Incorrect email or password' });
  if (!bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
  const user = toUser(row);
  res.json({ user, token: issueToken(user) });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await fullUser(req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
}));

// Member self-service account update. Members can change their own
// name / email / phone / goal / height. Every change is written to edit_log.
app.patch('/api/me', auth, wrap(async (req, res) => {
  const { name, email, phone, goal, height } = req.body || {};
  const updates = {};
  if (name != null) {
    const trimmed = name.trim();
    if (!trimmed) return res.status(400).json({ error: 'Name cannot be empty' });
    updates.name = trimmed;
  }
  if (email != null) {
    const lower = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(lower)) return res.status(400).json({ error: 'Invalid email address' });
    const clash = await q1('SELECT id FROM users WHERE email = $1 AND id <> $2', [lower, req.user.id]);
    if (clash) return res.status(409).json({ error: 'That email is already in use' });
    updates.email = lower;
  }
  if (phone  != null) updates.phone  = phone.trim() || null;
  if (goal   != null) updates.goal   = goal.trim();
  if (height != null) updates.height = parseFloat(height) || null;

  await updateUserWithAudit(req.user.id, updates, req.user);
  const u = await fullUser(req.user.id);
  res.json(u);
}));

app.post('/api/me/password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const row = await q1('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash))
    return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = bcrypt.hashSync(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  // Log password change (no from/to — just the fact)
  await pool.query(
    `INSERT INTO edit_log (user_id, edited_by_id, edited_by_name, edited_by_role, changes)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.user.id, req.user.id, req.user.name, req.user.role, { password: { from: '••••', to: '••••' } }]
  );
  res.json({ ok: true });
}));

// -------- Member self-service --------
app.post('/api/me/attendance', auth, wrap(async (req, res) => {
  const date = (req.body && req.body.date) || todayISO();
  await pool.query('INSERT INTO attendance (user_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, date]);
  res.json({ ok: true });
}));

// ---- QR check-in ----
// One secret, shared by the whole gym, generated once and reused. The
// common QR code encodes a URL to /checkin.html?t=<secret>; scanning it
// with a phone's native camera opens that page directly (no in-app camera
// scanner needed — this is more reliable than JS-based QR detection).
// checkin.html reads the token + the visitor's own JWT and calls this route.
async function getCheckinSecret() {
  const row = await q1("SELECT value FROM gym_settings WHERE key = 'checkin_secret'");
  if (row) return row.value;
  const secret = crypto.randomBytes(16).toString('hex');
  await pool.query(
    "INSERT INTO gym_settings (key, value) VALUES ('checkin_secret', $1) ON CONFLICT (key) DO NOTHING",
    [secret]
  );
  return (await q1("SELECT value FROM gym_settings WHERE key = 'checkin_secret'")).value;
}

app.get('/api/admin/checkin-qr', auth, requirePermission('attendance.manage'), wrap(async (req, res) => {
  const secret = await getCheckinSecret();
  const checkinUrl = `${req.protocol}://${req.get('host')}/checkin.html?t=${secret}`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 480, margin: 2 });
  res.json({ qrDataUrl, checkinUrl });
}));

app.post('/api/admin/checkin-qr/regenerate', auth, requirePermission('attendance.manage'), wrap(async (req, res) => {
  const secret = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO gym_settings (key, value) VALUES ('checkin_secret', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [secret]
  );
  res.json({ ok: true });
}));

app.post('/api/checkin', auth, wrap(async (req, res) => {
  const { token } = req.body || {};
  const secret = await getCheckinSecret();
  if (!token || token !== secret) return res.status(400).json({ error: 'Invalid or expired QR code' });
  const date = todayISO();
  const already = await q1('SELECT 1 FROM attendance WHERE user_id = $1 AND date = $2', [req.user.id, date]);
  if (!already) {
    await pool.query('INSERT INTO attendance (user_id, date) VALUES ($1,$2)', [req.user.id, date]);
  }
  res.json({ ok: true, alreadyCheckedIn: !!already, date });
}));

// ---- Digital gym pass ----
function passToken(memberId) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`pass:${memberId}`).digest('hex').slice(0, 24);
}

async function buildGymPass(memberId, req) {
  const row = await q1(`
    SELECT u.id, u.name, u.email, u.phone, u.joined, u.photo_url, u.member_type,
           u.subscription_plan, u.subscription_expiry,
           b.name AS batch_name,
           t.name AS trainer_name
    FROM users u
    LEFT JOIN batches b ON b.id = u.batch_id
    LEFT JOIN users t ON t.id = u.assigned_trainer_id
    WHERE u.id = $1 AND u.role = 'member'
  `, [memberId]);
  if (!row) return null;

  const days = daysUntil(row.subscription_expiry);
  const status = row.subscription_expiry == null ? 'inactive' : (days >= 0 ? 'active' : 'expired');
  const verifyUrl = `${req.protocol}://${req.get('host')}/member-verify.html?id=${row.id}&t=${passToken(row.id)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 320, margin: 2 });

  return {
    id: row.id,
    memberId: `SFC-${String(row.id).padStart(6, '0')}`,
    name: row.name, email: row.email, phone: row.phone, photoUrl: row.photo_url,
    memberSince: row.joined, memberType: row.member_type || 'regular',
    plan: row.subscription_plan || null, expiryDate: row.subscription_expiry || null,
    status, batchName: row.batch_name || null, trainerName: row.trainer_name || null,
    qrDataUrl, verifyUrl,
  };
}

app.get('/api/me/gym-pass', auth, wrap(async (req, res) => {
  if (req.user.role !== 'member') return res.status(403).json({ error: 'Gym passes are for members' });
  const pass = await buildGymPass(req.user.id, req);
  if (!pass) return res.status(404).json({ error: 'Member not found' });
  res.json(pass);
}));

app.get('/api/admin/members/:id/gym-pass', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const pass = await buildGymPass(req.params.id, req);
  if (!pass) return res.status(404).json({ error: 'Member not found' });
  res.json(pass);
}));

// Public, token-gated verification endpoint — this is what a front-desk
// staffer's phone camera lands on after scanning a member's pass QR. No
// login required so it works from any phone, not just an admin's.
app.get('/api/verify-member/:id', wrap(async (req, res) => {
  if (req.query.t !== passToken(req.params.id)) return res.status(403).json({ error: 'Invalid or expired pass' });
  const row = await q1("SELECT id, name, photo_url, subscription_plan, subscription_expiry FROM users WHERE id = $1 AND role = 'member'", [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Member not found' });
  const days = daysUntil(row.subscription_expiry);
  const status = row.subscription_expiry == null ? 'inactive' : (days >= 0 ? 'active' : 'expired');
  res.json({
    name: row.name, photoUrl: row.photo_url, plan: row.subscription_plan || null,
    expiryDate: row.subscription_expiry || null, status,
    memberId: `SFC-${String(row.id).padStart(6, '0')}`,
  });
}));

app.post('/api/me/weight', auth, wrap(async (req, res) => {
  const { date, kg } = req.body || {};
  if (!date || !kg) return res.status(400).json({ error: 'date and kg required' });
  await pool.query(`
    INSERT INTO weight_log (user_id, date, kg) VALUES ($1,$2,$3)
    ON CONFLICT (user_id, date) DO UPDATE SET kg = EXCLUDED.kg
  `, [req.user.id, date, kg]);
  res.json({ ok: true });
}));

app.delete('/api/me/weight/:date', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM weight_log WHERE user_id = $1 AND date = $2', [req.user.id, req.params.date]);
  res.json({ ok: true });
}));

app.get('/api/me/workout-logs', auth, wrap(async (req, res) => {
  const rows = await q(
    'SELECT date, completed FROM workout_logs WHERE user_id = $1 ORDER BY date DESC',
    [req.user.id]
  );
  res.json(rows);
}));

app.post('/api/me/workout-log', auth, wrap(async (req, res) => {
  const { date, completed } = req.body || {};
  if (!date || !Array.isArray(completed)) return res.status(400).json({ error: 'date and completed[] required' });
  await pool.query(`
    INSERT INTO workout_logs (user_id, date, completed) VALUES ($1, $2, $3)
    ON CONFLICT (user_id, date) DO UPDATE SET completed = EXCLUDED.completed
  `, [req.user.id, date, JSON.stringify(completed)]);
  res.json({ ok: true });
}));

app.post('/api/me/photos', auth, wrap(async (req, res) => {
  const { url, caption } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const row = await q1(
    'INSERT INTO photos (user_id, date, url, caption) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.user.id, todayISO(), url, caption || '']
  );
  res.json({ id: row.id });
}));

// Member uploads a photo file directly. Saved to public/uploads/, then the
// public URL (/uploads/xxx.jpg) is stored in the photo record.
app.post('/api/me/photos/upload', auth, (req, res, next) => {
  if (IS_SERVERLESS) {
    return res.status(501).json({
      error: 'File uploads are not supported on this deployment. Paste an image URL instead.',
    });
  }
  upload.single('photo')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const publicUrl = `/uploads/${req.file.filename}`;
  const caption = (req.body && req.body.caption) || '';
  const row = await q1(
    'INSERT INTO photos (user_id, date, url, caption) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.user.id, todayISO(), publicUrl, caption]
  );
  res.json({ id: row.id, url: publicUrl });
}));

app.delete('/api/me/photos/:id', auth, wrap(async (req, res) => {
  const row = await q1('SELECT url FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (row && row.url && row.url.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, 'public', row.url);
    fs.promises.unlink(filePath).catch(() => {});
  }
  await pool.query('DELETE FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

app.post('/api/me/notifications/read-all', auth, wrap(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
}));

// -------- Admin --------
app.get('/api/admin/members', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  res.json(await memberList());
}));

app.get('/api/admin/members/:id', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const u = await fullUser(parseInt(req.params.id));
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
}));

app.post('/api/admin/members', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const {
    name, email, password, height, goal, weight, phone, plan, subDays,
    batch_id, member_type, trainer_id, package_id, pt_price,
  } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const existing = await q1('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  if (batch_id) {
    const batchCheck = await checkBatchHasRoom(batch_id);
    if (!batchCheck.ok) return res.status(409).json({ error: batchCheck.message });
  }
  const start = todayISO();
  const expiry = new Date(); expiry.setDate(expiry.getDate() + (parseInt(subDays) || 30));
  const hash = bcrypt.hashSync(password || 'demo1234', 10);
  const isPt = member_type === 'pt';

  // Resolve PT trainer/package up front — same pattern as
  // POST /api/admin/pt-assignments — before opening the transaction.
  const pkg = isPt && package_id
    ? await q1('SELECT id, name, price::float AS price, validity_days FROM pt_packages WHERE id = $1', [package_id])
    : null;
  const trainer = isPt && trainer_id
    ? await q1("SELECT id, name FROM users WHERE id = $1 AND role = 'trainer'", [trainer_id])
    : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query(`
      INSERT INTO users (name, email, password_hash, role, joined, height, goal, phone,
        subscription_plan, subscription_start, subscription_expiry, batch_id, member_type,
        assigned_trainer_id)
      VALUES ($1,$2,$3,'member',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [name, email.toLowerCase(), hash, start, height || null, goal || null, phone || null,
        plan || 'Monthly Standard', start, expiry.toISOString().slice(0, 10),
        batch_id || null, isPt ? 'pt' : 'regular', trainer?.id || null]);
    const userId = row.rows[0].id;

    if (weight) {
      await client.query('INSERT INTO weight_log (user_id, date, kg) VALUES ($1,$2,$3)', [userId, start, weight]);
    }

    if (isPt && trainer) {
      const parsedPtPrice = parseFloat(pt_price);
      const ptPricePaid = !isNaN(parsedPtPrice) && parsedPtPrice !== 0 ? parsedPtPrice : (pkg?.price || 0);
      let ptEndDate = null;
      if (pkg?.validity_days) {
        const ed = new Date(start); ed.setDate(ed.getDate() + pkg.validity_days);
        ptEndDate = ed.toISOString().slice(0, 10);
      }
      const assignRow = await client.query(`
        INSERT INTO pt_assignments (user_id, trainer_id, trainer_name, package_id, package_name,
          price_paid, start_date, end_date, recorded_by, recorded_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
      `, [userId, trainer.id, trainer.name, pkg?.id || null, pkg?.name || null,
          ptPricePaid, start, ptEndDate, req.user.id, req.user.name]);

      if (ptPricePaid > 0) {
        await client.query(`
          INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, notes, recorded_by, recorded_by_name, pt_assignment_id)
          VALUES ($1,'PT Package',$2,$3,'cash','paid',$4,$5,$6,$7)
        `, [userId, ptPricePaid, start, `PT: ${pkg?.name || 'Custom'}`, req.user.id, req.user.name, assignRow.rows[0].id]);
      }
    }

    await client.query('COMMIT');
    res.json({ id: userId });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.patch('/api/admin/members/:id', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const {
    name, goal, height, phone,
    date_of_birth, blood_group, photo_url,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    medical_history, assigned_trainer_id, batch_id,
  } = req.body || {};
  if (batch_id !== undefined && batch_id) {
    const batchCheck = await checkBatchHasRoom(batch_id, parseInt(req.params.id));
    if (!batchCheck.ok) return res.status(409).json({ error: batchCheck.message });
  }
  const updates = {};
  if (name   != null) updates.name   = name;
  if (goal   != null) updates.goal   = goal;
  if (height != null) updates.height = height;
  if (phone  != null) updates.phone  = phone || null;
  if (date_of_birth               != null) updates.date_of_birth               = date_of_birth || null;
  if (blood_group                 != null) updates.blood_group                 = blood_group || null;
  if (photo_url                   != null) updates.photo_url                   = photo_url || null;
  if (emergency_contact_name      != null) updates.emergency_contact_name      = emergency_contact_name || null;
  if (emergency_contact_phone     != null) updates.emergency_contact_phone     = emergency_contact_phone || null;
  if (emergency_contact_relation  != null) updates.emergency_contact_relation  = emergency_contact_relation || null;
  if (medical_history             != null) updates.medical_history             = medical_history || null;
  if (assigned_trainer_id         != null) updates.assigned_trainer_id         = assigned_trainer_id || null;
  if (batch_id                    !== undefined) updates.batch_id             = batch_id || null;
  await updateUserWithAudit(parseInt(req.params.id), updates, req.user);
  res.json({ ok: true });
}));

app.get('/api/admin/members/:id/history', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, edited_by_id, edited_by_name, edited_by_role, changes, changed_at
    FROM edit_log
    WHERE user_id = $1
    ORDER BY changed_at DESC
    LIMIT 100
  `, [req.params.id]);
  res.json(rows);
}));

app.get('/api/me/history', auth, wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, edited_by_id, edited_by_name, edited_by_role, changes, changed_at
    FROM edit_log
    WHERE user_id = $1
    ORDER BY changed_at DESC
    LIMIT 100
  `, [req.user.id]);
  res.json(rows);
}));

// Send WhatsApp payment reminder for one member. Also records it as a broadcast
// so the admin's Recent Broadcasts log shows the outreach.
app.post('/api/admin/members/:id/whatsapp-reminder', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const u = await q1('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Member not found' });
  if (!u.subscription_plan || !u.subscription_expiry) return res.status(400).json({ error: 'Member has no subscription' });
  if (!u.phone) return res.status(400).json({ error: 'Member has no phone number on file' });

  const days = daysUntil(u.subscription_expiry);
  const result = await sendWhatsAppReminder({
    phone: u.phone, memberName: u.name, plan: u.subscription_plan,
    daysLeft: days, expiryDate: u.subscription_expiry,
  });

  const title = days < 0 ? 'WhatsApp: subscription expired' : `WhatsApp: expires in ${days}d`;
  const body = result.message;
  const now = new Date().toISOString();
  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, title, body, now, 1, req.user.name]
  );
  res.json(result);
}));

// Client-facing config: which channels are wired up
app.get('/api/config', wrap(async (req, res) => {
  res.json({ whatsapp: { configured: WA_CONFIGURED } });
}));

// ============================== Finance ==============================
// ---- Subscription plans (catalog) ----
app.get('/api/plans', auth, wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, name, price::float AS price, currency, duration_days, description, is_active
    FROM subscription_plans WHERE is_active = TRUE ORDER BY duration_days, price
  `);
  res.json(rows);
}));

app.get('/api/admin/plans', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, name, price::float AS price, currency, duration_days, description, is_active, created_at
    FROM subscription_plans ORDER BY is_active DESC, duration_days
  `);
  res.json(rows);
}));

app.post('/api/admin/plans', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { name, price, duration_days, description } = req.body || {};
  if (!name || price == null || !duration_days) return res.status(400).json({ error: 'name, price, duration_days required' });
  try {
    const row = await q1(`
      INSERT INTO subscription_plans (name, price, duration_days, description)
      VALUES ($1,$2,$3,$4) RETURNING id
    `, [name.trim(), price, duration_days, description || null]);
    res.json({ id: row.id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A plan with that name already exists' });
    throw e;
  }
}));

app.patch('/api/admin/plans/:id', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { name, price, duration_days, description, is_active } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (name          != null) { parts.push(`name = $${i++}`);          vals.push(name); }
  if (price         != null) { parts.push(`price = $${i++}`);         vals.push(price); }
  if (duration_days != null) { parts.push(`duration_days = $${i++}`); vals.push(duration_days); }
  if (description   != null) { parts.push(`description = $${i++}`);   vals.push(description); }
  if (is_active     != null) { parts.push(`is_active = $${i++}`);     vals.push(is_active); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE subscription_plans SET ${parts.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
}));

app.delete('/api/admin/plans/:id', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  // Soft-delete via is_active flag so historical payments still reference something.
  await pool.query('UPDATE subscription_plans SET is_active = FALSE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Payments (member self-service) ----
app.get('/api/me/payments', auth, wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, plan_name, amount::float AS amount, currency, payment_date, method, reference, status, notes, recorded_by_name, created_at
    FROM payments WHERE user_id = $1 ORDER BY payment_date DESC, id DESC
  `, [req.user.id]);
  res.json(rows);
}));

// Member submits a renewal request → creates a pending payment for admin approval
app.post('/api/me/payments/request', auth, wrap(async (req, res) => {
  const { plan_id, method, notes } = req.body || {};
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });
  const plan = await q1('SELECT name, price::float AS price FROM subscription_plans WHERE id = $1 AND is_active = TRUE', [plan_id]);
  if (!plan) return res.status(404).json({ error: 'Plan not found or inactive' });
  const row = await q1(`
    INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, notes)
    VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id
  `, [req.user.id, plan.name, plan.price, todayISO(), method || 'upi', notes || 'Requested via app']);
  res.json({ id: row.id });
}));

// ---- Payments (admin) ----
app.get('/api/admin/payments', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const status = req.query.status || null;
  const rows = await q(`
    SELECT p.id, p.user_id, u.name AS member_name, u.email AS member_email,
           p.plan_name, p.amount::float AS amount, p.currency, p.payment_date,
           p.method, p.reference, p.status, p.notes,
           p.recorded_by_name, p.created_at
    FROM payments p LEFT JOIN users u ON u.id = p.user_id
    ${status ? 'WHERE p.status = $1' : ''}
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 200
  `, status ? [status] : []);
  res.json(rows.map(r => ({ ...r, invoice_token: invoiceToken(r.id) })));
}));

// Send a WhatsApp receipt for any payment record — covers membership,
// admission, and PT payments alike, since they all land in this one table.
app.post('/api/admin/payments/:id/receipt', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const p = await q1(`
    SELECT pay.*, u.name AS member_name, u.phone AS member_phone
    FROM payments pay LEFT JOIN users u ON u.id = pay.user_id
    WHERE pay.id = $1
  `, [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  if (!p.member_phone) return res.status(400).json({ error: 'Member has no phone number on file' });

  const invoiceUrl = `${req.protocol}://${req.get('host')}/api/invoices/${p.id}.pdf?t=${invoiceToken(p.id)}`;
  const to = normalisePhone(p.member_phone);
  if (!to) return res.status(400).json({ error: 'Member has no phone number on file' });

  let result;
  if (WA_CONFIGURED) {
    // Real delivery: attach the actual PDF as a WhatsApp document message.
    const pdfBuffer = await buildInvoicePdfBuffer({ payment: p, memberName: p.member_name, memberPhone: p.member_phone });
    const mediaId = await uploadWhatsAppMedia(pdfBuffer, `invoice-${p.id}.pdf`);
    const caption = buildReceiptMessage({
      memberName: p.member_name, planName: p.plan_name, amount: parseFloat(p.amount),
      paymentDate: p.payment_date, method: p.method, reference: p.reference,
    });
    const sendRes = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'document',
        document: { id: mediaId, filename: `invoice-${p.id}.pdf`, caption },
      }),
    });
    if (!sendRes.ok) throw new Error(`WhatsApp API error (${sendRes.status}): ${(await sendRes.text()).slice(0, 300)}`);
    const data = await sendRes.json();
    result = { mode: 'api', phone: to, message: caption, messageId: data.messages?.[0]?.id || null };
  } else {
    // No Cloud API creds configured — wa.me can only pre-fill text, not attach
    // a file, so the message includes a direct link the member taps to open/download the PDF.
    const message = buildReceiptMessage({
      memberName: p.member_name, planName: p.plan_name, amount: parseFloat(p.amount),
      paymentDate: p.payment_date, method: p.method, reference: p.reference,
    }) + `\n\nDownload your PDF invoice:\n${invoiceUrl}`;
    result = await sendWhatsAppText({ phone: p.member_phone, message });
  }

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: PDF invoice sent to ${p.member_name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json({ ...result, invoiceUrl });
}));

// Record a payment for a member. Optionally extend their subscription by the plan's duration.
app.post('/api/admin/members/:id/payments', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { plan_name, amount, method, reference, notes, payment_date, extend_subscription } = req.body || {};
  if (!plan_name || amount == null) return res.status(400).json({ error: 'plan_name and amount required' });

  const member = await q1('SELECT id, subscription_expiry FROM users WHERE id = $1', [req.params.id]);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payment = await client.query(`
      INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, notes, recorded_by, recorded_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$9)
      RETURNING id
    `, [req.params.id, plan_name, amount, payment_date || todayISO(), method || 'cash', reference || null, notes || null, req.user.id, req.user.name]);

    if (extend_subscription) {
      const plan = await client.query('SELECT duration_days FROM subscription_plans WHERE name = $1', [plan_name]);
      const durationDays = plan.rows[0]?.duration_days || 30;
      // Extend from the later of (current expiry, today). Handles both renewals and lapsed accounts.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const currentExpiry = member.subscription_expiry ? new Date(member.subscription_expiry) : today;
      const base = currentExpiry >= today ? currentExpiry : today;
      base.setDate(base.getDate() + durationDays);
      const newExpiry = base.toISOString().slice(0, 10);
      const newStart  = todayISO();

      const before = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
      await client.query(`
        UPDATE users SET subscription_plan = $1, subscription_start = $2, subscription_expiry = $3 WHERE id = $4
      `, [plan_name, newStart, newExpiry, req.params.id]);
      const after = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
      const changes = diffRows(before.rows[0], after.rows[0]);
      if (Object.keys(changes).length) {
        await client.query(
          `INSERT INTO edit_log (user_id, edited_by_id, edited_by_name, edited_by_role, changes) VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, req.user.id, req.user.name, req.user.role, changes]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ id: payment.rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// Approve a pending payment → marks paid + extends subscription
app.post('/api/admin/payments/:id/approve', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const payment = await q1('SELECT * FROM payments WHERE id = $1', [req.params.id]);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment is not pending' });

  const plan = await q1('SELECT duration_days FROM subscription_plans WHERE name = $1', [payment.plan_name]);
  const durationDays = plan?.duration_days || 30;

  const member = await q1('SELECT id, subscription_expiry FROM users WHERE id = $1', [payment.user_id]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentExpiry = member?.subscription_expiry ? new Date(member.subscription_expiry) : today;
  const base = currentExpiry >= today ? currentExpiry : today;
  base.setDate(base.getDate() + durationDays);
  const newExpiry = base.toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE payments SET status = 'paid', payment_date = $1, recorded_by = $2, recorded_by_name = $3 WHERE id = $4
    `, [todayISO(), req.user.id, req.user.name, req.params.id]);

    const before = await client.query('SELECT * FROM users WHERE id = $1', [payment.user_id]);
    await client.query(`
      UPDATE users SET subscription_plan = $1, subscription_start = $2, subscription_expiry = $3 WHERE id = $4
    `, [payment.plan_name, todayISO(), newExpiry, payment.user_id]);
    const after = await client.query('SELECT * FROM users WHERE id = $1', [payment.user_id]);
    const changes = diffRows(before.rows[0], after.rows[0]);
    if (Object.keys(changes).length) {
      await client.query(
        `INSERT INTO edit_log (user_id, edited_by_id, edited_by_name, edited_by_role, changes) VALUES ($1,$2,$3,$4,$5)`,
        [payment.user_id, req.user.id, req.user.name, req.user.role, changes]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/api/admin/payments/:id', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Aggregate finance stats + monthly revenue trend for admin dashboard
app.get('/api/admin/finance', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const yearStart  = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);

  // Every PT payment is recorded with the literal plan_name 'PT Package' (see
  // POST /api/admin/pt-assignments) — the one reliable marker to split gym
  // membership revenue from personal-training revenue in the same ledger.
  const [mtd, ytd, pending, activeSubs, byMethod, monthly, mtdGym, ytdGym, mtdPt, ytdPt, monthlyGym] = await Promise.all([
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND payment_date >= $1`, [monthStart]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND payment_date >= $1`, [yearStart]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0)::float AS s FROM payments WHERE status='pending'`),
    q1(`SELECT COUNT(*)::int AS n FROM users WHERE role='member' AND subscription_expiry >= $1`, [todayISO()]),
    q(`SELECT method, COALESCE(SUM(amount),0)::float AS total FROM payments
       WHERE status='paid' GROUP BY method ORDER BY total DESC`),
    q(`SELECT to_char(payment_date::date, 'YYYY-MM') AS ym,
              COALESCE(SUM(amount),0)::float AS total
       FROM payments WHERE status='paid'
         AND payment_date::date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY ym ORDER BY ym`),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND plan_name <> 'PT Package' AND payment_date >= $1`, [monthStart]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND plan_name <> 'PT Package' AND payment_date >= $1`, [yearStart]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND plan_name = 'PT Package' AND payment_date >= $1`, [monthStart]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s, COUNT(*)::int AS n FROM payments
        WHERE status='paid' AND plan_name = 'PT Package' AND payment_date >= $1`, [yearStart]),
    q(`SELECT to_char(payment_date::date, 'YYYY-MM') AS ym,
              COALESCE(SUM(amount),0)::float AS total
       FROM payments WHERE status='paid' AND plan_name <> 'PT Package'
         AND payment_date::date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY ym ORDER BY ym`),
  ]);

  res.json({
    mtdRevenue:   mtd.s, mtdPayments:   mtd.n,
    ytdRevenue:   ytd.s, ytdPayments:   ytd.n,
    pendingCount: pending.n, pendingAmount: pending.s,
    activeSubscriptions: activeSubs.n,
    byMethod,
    monthly,
    // Gym revenue = membership/admission fees only, PT revenue excluded.
    gymRevenue: { mtd: mtdGym.s, mtdPayments: mtdGym.n, ytd: ytdGym.s, ytdPayments: ytdGym.n, monthly: monthlyGym },
    ptRevenue:  { mtd: mtdPt.s,  mtdPayments: mtdPt.n,  ytd: ytdPt.s,  ytdPayments: ytdPt.n },
  });
}));

app.delete('/api/admin/members/:id', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1 AND role = 'member'", [req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/admin/members/:id/workout', auth, requireAdmin, wrap(async (req, res) => {
  await pool.query('UPDATE users SET workout_plan_json = $1 WHERE id = $2', [req.body, req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/admin/members/:id/nutrition', auth, requireAdmin, wrap(async (req, res) => {
  await pool.query('UPDATE users SET nutrition_plan_json = $1 WHERE id = $2', [req.body, req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/admin/members/:id/subscription', auth, requireAdmin, wrap(async (req, res) => {
  const { plan, startDate, expiryDate } = req.body || {};
  await pool.query(
    'UPDATE users SET subscription_plan = $1, subscription_start = $2, subscription_expiry = $3 WHERE id = $4',
    [plan || null, startDate || null, expiryDate || null, req.params.id]
  );
  res.json({ ok: true });
}));

app.post('/api/admin/members/:id/attendance/toggle', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date required' });
  const exists = await q1('SELECT 1 FROM attendance WHERE user_id = $1 AND date = $2', [req.params.id, date]);
  if (exists) await pool.query('DELETE FROM attendance WHERE user_id = $1 AND date = $2', [req.params.id, date]);
  else await pool.query('INSERT INTO attendance (user_id, date) VALUES ($1,$2)', [req.params.id, date]);
  res.json({ ok: true, present: !exists });
}));

app.post('/api/admin/broadcasts', auth, requirePermission('notifications.send'), wrap(async (req, res) => {
  const { type, title, body, recipientId } = req.body || {};
  if (!type || !title || !body) return res.status(400).json({ error: 'type, title, body required' });
  const now = new Date().toISOString();

  let recipients = [];
  if (recipientId) {
    const u = await q1("SELECT id FROM users WHERE id = $1 AND role = 'member'", [recipientId]);
    if (u) recipients = [u.id];
  } else {
    recipients = (await q("SELECT id FROM users WHERE role = 'member'")).map(r => r.id);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const uid of recipients) {
      await client.query(
        'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,FALSE)',
        [uid, type, title, body, now]
      );
    }
    await client.query(
      'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [type, title, body, now, recipients.length, req.user.name]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true, count: recipients.length });
}));

app.get('/api/admin/broadcasts', auth, requirePermission('notifications.send'), wrap(async (req, res) => {
  res.json(await q('SELECT * FROM broadcasts ORDER BY sent DESC LIMIT 30'));
}));

// Daily quote (or any free-text message) over WhatsApp to every member whose
// subscription is currently active and has a phone on file. Each recipient
// is sent individually — with WA_CONFIGURED it's a true one-click bulk send
// (mode 'api' per recipient); without it, each comes back as a 'link' the
// admin clicks through once per person (WhatsApp has no way to pre-fill a
// message into an existing group chat via URL, so that's the "group" flow's
// realistic ceiling without a bot in the group).
app.post('/api/admin/broadcasts/quote', auth, requirePermission('notifications.send'), wrap(async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message required' });

  const active = await q(`
    SELECT id, name, phone FROM users
    WHERE role = 'member' AND phone IS NOT NULL AND phone <> ''
      AND subscription_expiry IS NOT NULL AND subscription_expiry >= $1
    ORDER BY name
  `, [todayISO()]);

  const results = [];
  for (const m of active) {
    try {
      const r = await sendWhatsAppText({ phone: m.phone, message: message.trim() });
      results.push({ memberId: m.id, name: m.name, phone: r.phone, mode: r.mode, link: r.link || null });
    } catch (e) {
      results.push({ memberId: m.id, name: m.name, phone: m.phone, mode: 'error', error: e.message });
    }
  }

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    ['whatsapp-quote', 'Daily quote', message.trim(), new Date().toISOString(), results.length, req.user.name]
  );
  res.json({ results, waConfigured: WA_CONFIGURED });
}));

// Custom renewal-reminder message. Admin types the message; the server
// appends a computed "days remaining" line so it's always accurate and the
// admin never has to do that math by hand.
app.post('/api/admin/members/:id/renewal-message', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message required' });

  const member = await q1('SELECT name, phone, subscription_plan, subscription_expiry FROM users WHERE id = $1', [req.params.id]);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.phone) return res.status(400).json({ error: 'Member has no phone number on file' });
  if (!member.subscription_expiry) return res.status(400).json({ error: 'Member has no subscription on file' });

  const days = daysUntil(member.subscription_expiry);
  const expiryPretty = new Date(member.subscription_expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const daysLine =
    days < 0  ? `Your ${member.subscription_plan} membership expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago (on ${expiryPretty}).` :
    days === 0 ? `Your ${member.subscription_plan} membership expires today (${expiryPretty}).` :
    days === 1 ? `Your ${member.subscription_plan} membership expires tomorrow (${expiryPretty}).` :
                 `Your ${member.subscription_plan} membership expires in ${days} days (on ${expiryPretty}).`;

  const finalMessage = `${message.trim()}\n\n${daysLine}`;
  const result = await sendWhatsAppText({ phone: member.phone, message: finalMessage });

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: renewal message to ${member.name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json(result);
}));

// Send a newly created member their login credentials over WhatsApp. The
// server never stores or recovers plaintext passwords (only bcrypt hashes),
// so the password must be passed in here — the frontend already has it,
// it's whatever was just typed into (or defaulted in) the Add Member form.
app.post('/api/admin/members/:id/send-credentials', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const member = await q1('SELECT name, email, phone FROM users WHERE id = $1', [req.params.id]);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.phone) return res.status(400).json({ error: 'Member has no phone number on file' });

  const loginUrl = `${req.protocol}://${req.get('host')}/login.html`;
  const message = `Hi ${member.name.split(' ')[0]},

Your Stellar Fitness Club account is ready!

Login: ${loginUrl}
Email: ${member.email}
Password: ${password}

Please change your password after your first login.

— Team Stellar Fitness`;

  const result = await sendWhatsAppText({ phone: member.phone, message });

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: login credentials sent to ${member.name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json(result);
}));

app.get('/api/admin/insights', auth, requirePermission('reports.view'), wrap(async (req, res) => {
  const members = await memberList();
  const today = todayISO();
  const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

  const attendanceTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    attendanceTrend.push({
      date: iso,
      count: members.filter(u => u.attendance.includes(iso)).length,
    });
  }

  res.json({
    totalMembers:  members.length,
    newThisMonth:  members.filter(u => new Date(u.joined) >= monthAgo).length,
    todayCheckIns: members.filter(u => u.attendance.includes(today)).length,
    activeWeek:    members.filter(u => u.attendance.some(d => new Date(d) >= weekAgo)).length,
    plansAssigned: members.filter(u => u.workoutPlan).length,
    attendanceTrend,
  });
}));

// ============================== Food & calorie log ==============================
function sumMacros(rows) {
  return rows.reduce((acc, r) => {
    acc.calories += r.calories || 0;
    acc.protein  += r.protein  || 0;
    acc.carbs    += r.carbs    || 0;
    acc.fats     += r.fats     || 0;
    acc.entries  += 1;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, entries: 0 });
}

app.get('/api/me/food', auth, wrap(async (req, res) => {
  const date = (req.query && req.query.date) || todayISO();
  const rows = await q(`
    SELECT id, entry_date, meal_type, food_name, calories, protein, carbs, fats, notes, source, logged_at
    FROM food_entries WHERE user_id = $1 AND entry_date = $2 ORDER BY logged_at
  `, [req.user.id, date]);
  const user = await q1('SELECT nutrition_plan_json FROM users WHERE id = $1', [req.user.id]);
  const target = user?.nutrition_plan_json
    ? { calories: user.nutrition_plan_json.calories, protein: user.nutrition_plan_json.protein,
        carbs: user.nutrition_plan_json.carbs, fats: user.nutrition_plan_json.fats }
    : null;
  res.json({ date, entries: rows, total: sumMacros(rows), target });
}));

app.get('/api/me/food/summary', auth, wrap(async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 60);
  const start = new Date(); start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);
  const rows = await q(`
    SELECT entry_date,
           SUM(calories)::int AS calories,
           SUM(protein)::float AS protein,
           SUM(carbs)::float AS carbs,
           SUM(fats)::float AS fats,
           COUNT(*)::int AS entries
    FROM food_entries WHERE user_id = $1 AND entry_date >= $2
    GROUP BY entry_date ORDER BY entry_date
  `, [req.user.id, startIso]);
  res.json({ from: startIso, to: todayISO(), days: rows });
}));

app.post('/api/me/food', auth, wrap(async (req, res) => {
  const { entry_date, meal_type, food_name, calories, protein, carbs, fats, notes, source } = req.body || {};
  if (!meal_type || !food_name || calories == null) {
    return res.status(400).json({ error: 'meal_type, food_name, calories required' });
  }
  const validMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!validMeals.includes(meal_type)) return res.status(400).json({ error: 'Invalid meal_type' });
  const row = await q1(`
    INSERT INTO food_entries (user_id, entry_date, meal_type, food_name, calories, protein, carbs, fats, notes, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, entry_date, meal_type, food_name, calories, protein, carbs, fats, notes, source, logged_at
  `, [
    req.user.id, entry_date || todayISO(), meal_type, food_name.trim(),
    parseInt(calories) || 0,
    protein != null ? parseFloat(protein) : null,
    carbs   != null ? parseFloat(carbs)   : null,
    fats    != null ? parseFloat(fats)    : null,
    notes || null,
    source || 'web',
  ]);
  res.json(row);
}));

app.delete('/api/me/food/:id', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM food_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

app.get('/api/admin/members/:id/food', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const date = req.query.date || todayISO();
  const rows = await q(`
    SELECT id, entry_date, meal_type, food_name, calories, protein, carbs, fats, notes, source, logged_at
    FROM food_entries WHERE user_id = $1 AND entry_date = $2 ORDER BY logged_at
  `, [req.params.id, date]);
  const user = await q1('SELECT nutrition_plan_json FROM users WHERE id = $1', [req.params.id]);
  const target = user?.nutrition_plan_json
    ? { calories: user.nutrition_plan_json.calories, protein: user.nutrition_plan_json.protein,
        carbs: user.nutrition_plan_json.carbs, fats: user.nutrition_plan_json.fats }
    : null;
  res.json({ date, entries: rows, total: sumMacros(rows), target });
}));

app.get('/api/admin/members/:id/food/summary', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 60);
  const start = new Date(); start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);
  const rows = await q(`
    SELECT entry_date, SUM(calories)::int AS calories, SUM(protein)::float AS protein,
           SUM(carbs)::float AS carbs, SUM(fats)::float AS fats, COUNT(*)::int AS entries
    FROM food_entries WHERE user_id = $1 AND entry_date >= $2
    GROUP BY entry_date ORDER BY entry_date
  `, [req.params.id, startIso]);
  res.json({ from: startIso, to: todayISO(), days: rows });
}));

app.get('/api/admin/food/today', auth, requirePermission('members.manage'), wrap(async (req, res) => {
  const date = req.query.date || todayISO();
  const rows = await q(`
    SELECT u.id, u.name, u.email, u.nutrition_plan_json,
           COALESCE(SUM(f.calories)::int, 0) AS calories,
           COALESCE(SUM(f.protein)::float, 0) AS protein,
           COALESCE(SUM(f.carbs)::float, 0) AS carbs,
           COALESCE(SUM(f.fats)::float, 0) AS fats,
           COUNT(f.id)::int AS entries,
           MAX(f.logged_at) AS last_logged_at
    FROM users u
    LEFT JOIN food_entries f ON f.user_id = u.id AND f.entry_date = $1
    WHERE u.role = 'member' GROUP BY u.id
    ORDER BY calories DESC, u.name
  `, [date]);
  const members = rows.map(r => {
    const target = r.nutrition_plan_json?.calories || null;
    const percentOfTarget = target ? Math.round((r.calories / target) * 100) : null;
    return {
      id: r.id, name: r.name, email: r.email,
      calories: r.calories, protein: r.protein, carbs: r.carbs, fats: r.fats,
      entries: r.entries, lastLoggedAt: r.last_logged_at, target, percentOfTarget,
    };
  });
  res.json({ date, members });
}));

// ============================== Admissions ==============================

async function nextReceiptNumber() {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const rows = await q(
    `SELECT receipt_number FROM admissions WHERE receipt_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  if (rows.length === 0) return `${prefix}000001`;
  const lastNum = parseInt(rows[0].receipt_number.slice(prefix.length), 10) || 0;
  return `${prefix}${String(lastNum + 1).padStart(6, '0')}`;
}

app.get('/api/admin/admissions/next-receipt', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  res.json({ receipt_number: await nextReceiptNumber() });
}));

app.get('/api/admin/admissions', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { from, to, member_id, type } = req.query;
  const conds = []; const vals = []; let i = 1;
  if (from)      { conds.push(`a.admission_date >= $${i++}`); vals.push(from); }
  if (to)        { conds.push(`a.admission_date <= $${i++}`); vals.push(to); }
  if (member_id) { conds.push(`a.user_id = $${i++}`);        vals.push(parseInt(member_id)); }
  if (type)      { conds.push(`a.type = $${i++}`);           vals.push(type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await q(`
    SELECT a.*, u.name AS member_name, u.email AS member_email, u.phone AS member_phone
    FROM admissions a LEFT JOIN users u ON u.id = a.user_id
    ${where} ORDER BY a.admission_date DESC, a.id DESC LIMIT 500
  `, vals);
  res.json(rows.map(r => ({
    ...r,
    plan_price:  parseFloat(r.plan_price)  || 0,
    paid_amount: parseFloat(r.paid_amount) || 0,
    discount:    parseFloat(r.discount)    || 0,
    balance:     parseFloat(r.balance)     || 0,
  })));
}));

app.post('/api/admin/admissions', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { user_id, admission_date, type, plan_id, trainer_id, payment_mode,
          paid_amount, discount, start_date, end_date, remarks } = req.body || {};
  if (!user_id || !start_date || !end_date)
    return res.status(400).json({ error: 'user_id, start_date, end_date required' });

  const member = await q1('SELECT id FROM users WHERE id = $1', [user_id]);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const plan = plan_id
    ? await q1('SELECT id, name, price::float AS price FROM subscription_plans WHERE id = $1', [plan_id])
    : null;
  const trainer = trainer_id
    ? await q1("SELECT id, name FROM users WHERE id = $1 AND role = 'trainer'", [trainer_id])
    : null;

  const planPrice  = plan ? plan.price : 0;
  const paidAmt    = parseFloat(paid_amount) || 0;
  const discAmt    = parseFloat(discount)    || 0;
  const balance    = Math.max(0, planPrice - discAmt - paidAmt);
  const receiptNum = await nextReceiptNumber();
  const admDate    = admission_date || todayISO();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const admRow = await client.query(`
      INSERT INTO admissions (
        user_id, admission_date, receipt_number, type,
        plan_id, plan_name, plan_price, trainer_id, trainer_name,
        payment_mode, paid_amount, discount, balance,
        start_date, end_date, remarks, recorded_by, recorded_by_name
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id
    `, [
      user_id, admDate, receiptNum, type || 'new',
      plan?.id || null, plan?.name || 'Custom', planPrice,
      trainer?.id || null, trainer?.name || null,
      payment_mode || 'cash', paidAmt, discAmt, balance,
      start_date, end_date, remarks || null,
      req.user.id, req.user.name,
    ]);

    // Mirror paid amount into the payments ledger
    if (paidAmt > 0) {
      await client.query(`
        INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, notes, recorded_by, recorded_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$9)
      `, [user_id, plan?.name || 'Custom', paidAmt, admDate,
          payment_mode || 'cash', receiptNum,
          `Admission ${receiptNum}`, req.user.id, req.user.name]);
    }

    // Update member's subscription dates and trainer assignment
    const uParts = ['subscription_plan = $1', 'subscription_start = $2', 'subscription_expiry = $3'];
    const uVals  = [plan?.name || 'Custom', start_date, end_date];
    if (trainer?.id) { uParts.push(`assigned_trainer_id = $${uVals.length + 1}`); uVals.push(trainer.id); }
    uVals.push(user_id);
    const before = await client.query('SELECT * FROM users WHERE id = $1', [user_id]);
    await client.query(`UPDATE users SET ${uParts.join(', ')} WHERE id = $${uVals.length}`, uVals);
    const after  = await client.query('SELECT * FROM users WHERE id = $1', [user_id]);
    const changes = diffRows(before.rows[0], after.rows[0]);
    if (Object.keys(changes).length) {
      await client.query(
        `INSERT INTO edit_log (user_id, edited_by_id, edited_by_name, edited_by_role, changes) VALUES ($1,$2,$3,$4,$5)`,
        [user_id, req.user.id, req.user.name, req.user.role, changes]
      );
    }
    await client.query('COMMIT');
    res.json({ id: admRow.rows[0].id, receipt_number: receiptNum });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/api/admin/admissions/:id', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  await pool.query('DELETE FROM admissions WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Record a balance payment against an existing admission
app.post('/api/admin/admissions/:id/payment', auth, requirePermission('finance.view'), wrap(async (req, res) => {
  const { amount, payment_mode } = req.body || {};
  if (!amount) return res.status(400).json({ error: 'amount required' });
  const adm = await q1('SELECT * FROM admissions WHERE id = $1', [req.params.id]);
  if (!adm) return res.status(404).json({ error: 'Admission not found' });
  const pay = parseFloat(amount);
  const newBalance = Math.max(0, parseFloat(adm.balance) - pay);
  const newPaid    = parseFloat(adm.paid_amount) + pay;
  await pool.query(
    'UPDATE admissions SET paid_amount = $1, balance = $2 WHERE id = $3',
    [newPaid, newBalance, req.params.id]
  );
  await pool.query(`
    INSERT INTO payments (user_id, plan_name, amount, payment_date, method, reference, status, notes, recorded_by, recorded_by_name)
    VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$9)
  `, [adm.user_id, adm.plan_name, pay, todayISO(),
      payment_mode || adm.payment_mode, adm.receipt_number,
      `Balance payment for ${adm.receipt_number}`, req.user.id, req.user.name]);
  res.json({ ok: true, new_balance: newBalance });
}));

// ============================== Leads (public site enquiries) ==============================
// Book Visit / Contact form submissions from the marketing site. Public and
// unauthenticated on purpose — a visitor filling out the form isn't logged in.

// Public, unauthenticated list of active plans — lets the enquiry form on the
// marketing site offer a real "which plan are you interested in?" dropdown
// sourced from what admin actually set up, without requiring a login
// (unlike GET /api/plans, which is for the logged-in app).
app.get('/api/public/plans', publicSiteCors, wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, name, price::float AS price, duration_days
    FROM subscription_plans WHERE is_active = TRUE ORDER BY duration_days, price
  `);
  res.json(rows);
}));

app.post('/api/leads', publicSiteCors, wrap(async (req, res) => {
  const { source, name, phone, whatsapp, email, goal, preferredTrainer, date, time, message, interestedPlanId } = req.body || {};
  if (!source || !['book-visit', 'contact'].includes(source))
    return res.status(400).json({ error: "source must be 'book-visit' or 'contact'" });
  if (!name || !String(name).trim())
    return res.status(400).json({ error: 'name required' });
  if (!phone && !email)
    return res.status(400).json({ error: 'phone or email required' });

  const row = await q1(`
    INSERT INTO leads (source, name, phone, whatsapp, email, goal, preferred_trainer, preferred_date, preferred_time, message, interested_plan_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id, source, name, phone, whatsapp, email, goal, preferred_trainer, preferred_date, preferred_time, message, interested_plan_id, status, created_at
  `, [
    source,
    String(name).trim(),
    phone || null,
    whatsapp || null,
    email || null,
    goal || null,
    preferredTrainer || null,
    date || null,
    time || null,
    message || null,
    interestedPlanId ? parseInt(interestedPlanId, 10) : null,
  ]);
  res.status(201).json(row);
}));

app.get('/api/admin/leads', auth, requirePermission('enquiries.manage'), wrap(async (req, res) => {
  const { status, source } = req.query;
  const conds = []; const vals = []; let i = 1;
  if (status) { conds.push(`l.status = $${i++}`); vals.push(status); }
  if (source) { conds.push(`l.source = $${i++}`); vals.push(source); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await q(`
    SELECT l.*, p.name AS interested_plan_name
    FROM leads l
    LEFT JOIN subscription_plans p ON p.id = l.interested_plan_id
    ${where}
    ORDER BY l.created_at DESC LIMIT 500
  `, vals);
  res.json(rows);
}));

app.patch('/api/admin/leads/:id', auth, requirePermission('enquiries.manage'), wrap(async (req, res) => {
  const { status } = req.body || {};
  const valid = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  const row = await q1('UPDATE leads SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lead not found' });
  res.json(row);
}));

app.delete('/api/admin/leads/:id', auth, requirePermission('enquiries.manage'), wrap(async (req, res) => {
  const row = await q1('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lead not found' });
  res.json({ ok: true });
}));

// Generic admin upload — trainer photos and certificates (image or PDF).
// Returns a public /uploads/ URL to store on the trainer's profile fields.
app.post('/api/admin/upload', auth, requireAnyPermission(['members.manage', 'trainers.manage', 'pt.manage']), (req, res, next) => {
  if (IS_SERVERLESS) {
    return res.status(501).json({ error: 'File uploads are not supported on this deployment. Paste a URL instead.' });
  }
  uploadDoc.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  res.json({ url: `/uploads/${req.file.filename}` });
}));

// ============================== Batches ==============================
// Named groups only ("Morning Batch", "Evening Batch", "Yoga") — no
// location/floor concept, just a label members can be grouped under.

app.get('/api/admin/batches', auth, requirePermission('batches.manage'), wrap(async (req, res) => {
  const rows = await q(`
    SELECT b.id, b.name, b.is_active, b.capacity, b.created_at,
           COUNT(u.id)::int AS member_count
    FROM batches b
    LEFT JOIN users u ON u.batch_id = b.id AND u.role = 'member'
    GROUP BY b.id ORDER BY b.is_active DESC, b.name
  `);
  res.json(rows);
}));

app.post('/api/admin/batches', auth, requirePermission('batches.manage'), wrap(async (req, res) => {
  const { name, capacity } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  const existing = await q1('SELECT id FROM batches WHERE name = $1', [name.trim()]);
  if (existing) return res.status(409).json({ error: 'A batch with that name already exists' });
  const parsedCapacity = parseInt(capacity, 10);
  const cap = !isNaN(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : null;
  const row = await q1('INSERT INTO batches (name, capacity) VALUES ($1,$2) RETURNING id', [name.trim(), cap]);
  res.json({ id: row.id });
}));

app.patch('/api/admin/batches/:id', auth, requirePermission('batches.manage'), wrap(async (req, res) => {
  const { name, is_active, capacity } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (name != null)      { parts.push(`name = $${i++}`);      vals.push(name.trim()); }
  if (is_active != null) { parts.push(`is_active = $${i++}`); vals.push(!!is_active); }
  if (capacity !== undefined) {
    const parsedCapacity = parseInt(capacity, 10);
    parts.push(`capacity = $${i++}`);
    vals.push(!isNaN(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : null);
  }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE batches SET ${parts.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
}));

// Returns { ok: true } or { ok: false, message } — never throws, so callers
// can just `if (!check.ok) return res.status(409).json({ error: check.message })`.
// excludeUserId lets a member keep their own seat while being re-saved into
// the same batch (a no-op save shouldn't get rejected as "full of themselves").
async function checkBatchHasRoom(batchId, excludeUserId) {
  if (!batchId) return { ok: true };
  const batch = await q1('SELECT id, name, capacity FROM batches WHERE id = $1', [batchId]);
  if (!batch || batch.capacity == null) return { ok: true };
  const countRow = await q1(
    `SELECT COUNT(*)::int AS n FROM users WHERE batch_id = $1 AND role = 'member' ${excludeUserId ? 'AND id <> $2' : ''}`,
    excludeUserId ? [batchId, excludeUserId] : [batchId]
  );
  if (countRow.n >= batch.capacity) {
    return { ok: false, message: `"${batch.name}" is full (${batch.capacity}/${batch.capacity}) — pick another batch or raise its limit.` };
  }
  return { ok: true };
}

app.delete('/api/admin/batches/:id', auth, requirePermission('batches.manage'), wrap(async (req, res) => {
  await pool.query('DELETE FROM batches WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================== Permissions & Staff ==============================
// Admin-only end to end: creating an account or changing what it can do is a
// structural/security action, never delegated to a granted permission
// itself (otherwise a staff member with e.g. trainers.manage could create
// new accounts and hand out permissions, including to themselves).

app.get('/api/admin/permissions', auth, requireAdmin, wrap(async (req, res) => {
  res.json({ catalog: PERMISSION_CATALOG, staffDefaults: STAFF_DEFAULT_PERMISSIONS });
}));

app.get('/api/admin/staff', auth, requireAdmin, wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, name, email, phone, joined, permissions
    FROM users WHERE role = 'staff' ORDER BY name
  `);
  res.json(rows);
}));

app.post('/api/admin/staff', auth, requireAdmin, wrap(async (req, res) => {
  const { name, email, password, phone, permissions } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const existing = await q1('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const hash = bcrypt.hashSync(password || 'staff1234', 10);
  const perms = JSON.stringify(sanitizePermissions(permissions && permissions.length ? permissions : STAFF_DEFAULT_PERMISSIONS));
  const row = await q1(`
    INSERT INTO users (name, email, password_hash, role, joined, phone, permissions)
    VALUES ($1,$2,$3,'staff',$4,$5,$6) RETURNING id
  `, [name, email.toLowerCase(), hash, todayISO(), phone || null, perms]);
  res.json({ id: row.id });
}));

app.patch('/api/admin/staff/:id', auth, requireAdmin, wrap(async (req, res) => {
  const { name, phone, permissions } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (name        != null) { parts.push(`name = $${i++}`);  vals.push(name); }
  if (phone       != null) { parts.push(`phone = $${i++}`); vals.push(phone || null); }
  if (permissions != null) { parts.push(`permissions = $${i++}`); vals.push(JSON.stringify(sanitizePermissions(permissions))); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE users SET ${parts.join(', ')} WHERE id = $${i} AND role = 'staff'`, vals);
  res.json({ ok: true });
}));

app.delete('/api/admin/staff/:id', auth, requireAdmin, wrap(async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1 AND role = 'staff'", [req.params.id]);
  res.json({ ok: true });
}));

// Same "send login credentials on WhatsApp" pattern as new members — the
// plaintext password only exists in the create-staff request body at the
// moment of creation, so this must be called right after POST /api/admin/staff.
app.post('/api/admin/staff/:id/send-credentials', auth, requireAdmin, wrap(async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const account = await q1("SELECT name, email, phone FROM users WHERE id = $1 AND role = 'staff'", [req.params.id]);
  if (!account) return res.status(404).json({ error: 'Staff account not found' });
  if (!account.phone) return res.status(400).json({ error: 'Staff account has no phone number on file' });

  const loginUrl = `${req.protocol}://${req.get('host')}/login.html`;
  const message = `Hi ${account.name.split(' ')[0]},

Your Stellar Fitness Club staff account is ready!

Login: ${loginUrl}
Email: ${account.email}
Password: ${password}

Please change your password after your first login.

— Team Stellar Fitness`;

  const result = await sendWhatsAppText({ phone: account.phone, message });

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: staff login credentials sent to ${account.name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json(result);
}));

// ============================== Trainers ==============================

app.get('/api/admin/trainers', auth, requirePermission('trainers.manage'), wrap(async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  const ms = monthStart.toISOString().slice(0, 10);

  // Subqueries (not a single multi-join + GROUP BY) on purpose: joining
  // admissions and pt_assignments to the same trainer row in one query fans
  // out row counts and double-counts the SUMs the moment a trainer has more
  // than one row in either table.
  const rows = await q(`
    SELECT u.id, u.name, u.email, u.phone, u.joined, u.permissions,
           u.trainer_specialization          AS specialization,
           u.trainer_monthly_target::float   AS monthly_target,
           u.trainer_bio                     AS bio,
           u.trainer_qualifications          AS qualifications,
           u.trainer_achievements            AS achievements,
           u.trainer_certificate_url         AS certificate_url,
           u.trainer_instagram               AS instagram,
           u.photo_url                       AS photo_url,
           u.trainer_is_partner              AS is_partner,
           COALESCE(adm.cnt, 0)::int         AS admissions_mtd,
           COALESCE(adm.revenue, 0)::float   AS admission_revenue,
           COALESCE(pt.revenue, 0)::float    AS pt_revenue,
           COALESCE(active.cnt, 0)::int      AS active_clients
    FROM users u
    LEFT JOIN (
      SELECT trainer_id, COUNT(*)::int AS cnt, SUM(paid_amount) AS revenue
      FROM admissions WHERE admission_date >= $1 GROUP BY trainer_id
    ) adm ON adm.trainer_id = u.id
    LEFT JOIN (
      SELECT trainer_id, SUM(price_paid) AS revenue
      FROM pt_assignments WHERE start_date >= $1 AND status <> 'cancelled' GROUP BY trainer_id
    ) pt ON pt.trainer_id = u.id
    LEFT JOIN (
      SELECT trainer_id, COUNT(*)::int AS cnt
      FROM pt_assignments WHERE status = 'active' GROUP BY trainer_id
    ) active ON active.trainer_id = u.id
    WHERE u.role = 'trainer'
    ORDER BY u.name
  `, [ms]);

  res.json(rows.map(r => {
    const { ptRate, membershipRate } = commissionRates({ isPartner: r.is_partner, activeClients: r.active_clients });
    const commission = (r.admission_revenue || 0) * membershipRate / 100 + (r.pt_revenue || 0) * ptRate / 100;
    return {
      ...r,
      revenue: (r.admission_revenue || 0) + (r.pt_revenue || 0),
      commission: Math.round(commission * 100) / 100,
      pt_rate: ptRate,
      membership_rate: membershipRate,
    };
  }));
}));

app.post('/api/admin/trainers', auth, requireAdmin, wrap(async (req, res) => {
  const {
    name, email, password, phone, specialization, monthly_target,
    bio, qualifications, achievements, certificate_url, instagram, photo_url, is_partner,
    permissions,
  } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const existing = await q1('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const hash = bcrypt.hashSync(password || 'trainer123', 10);
  const row = await q1(`
    INSERT INTO users (name, email, password_hash, role, joined, phone,
      trainer_specialization, trainer_monthly_target,
      trainer_bio, trainer_qualifications, trainer_achievements,
      trainer_certificate_url, trainer_instagram, photo_url, trainer_is_partner, permissions)
    VALUES ($1,$2,$3,'trainer',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id
  `, [name, email.toLowerCase(), hash, todayISO(), phone || null,
      specialization || null, monthly_target ? parseFloat(monthly_target) : null,
      bio || null, qualifications || null, achievements || null,
      certificate_url || null, instagram || null, photo_url || null, !!is_partner,
      JSON.stringify(sanitizePermissions(permissions))]);
  res.json({ id: row.id });
}));

app.patch('/api/admin/trainers/:id', auth, requireAdmin, wrap(async (req, res) => {
  const {
    name, phone, specialization, monthly_target,
    bio, qualifications, achievements, certificate_url, instagram, photo_url, is_partner,
    permissions,
  } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (name            != null) { parts.push(`name = $${i++}`);                     vals.push(name); }
  if (phone           != null) { parts.push(`phone = $${i++}`);                    vals.push(phone || null); }
  if (specialization  != null) { parts.push(`trainer_specialization = $${i++}`);   vals.push(specialization || null); }
  if (monthly_target  != null) { parts.push(`trainer_monthly_target = $${i++}`);   vals.push(parseFloat(monthly_target) || null); }
  if (bio             != null) { parts.push(`trainer_bio = $${i++}`);              vals.push(bio || null); }
  if (qualifications  != null) { parts.push(`trainer_qualifications = $${i++}`);   vals.push(qualifications || null); }
  if (achievements    != null) { parts.push(`trainer_achievements = $${i++}`);     vals.push(achievements || null); }
  if (certificate_url != null) { parts.push(`trainer_certificate_url = $${i++}`);  vals.push(certificate_url || null); }
  if (instagram        != null) { parts.push(`trainer_instagram = $${i++}`);       vals.push(instagram || null); }
  if (photo_url        != null) { parts.push(`photo_url = $${i++}`);               vals.push(photo_url || null); }
  if (is_partner       != null) { parts.push(`trainer_is_partner = $${i++}`);      vals.push(!!is_partner); }
  if (permissions      != null) { parts.push(`permissions = $${i++}`);             vals.push(JSON.stringify(sanitizePermissions(permissions))); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE users SET ${parts.join(', ')} WHERE id = $${i} AND role = 'trainer'`, vals);
  res.json({ ok: true });
}));

app.delete('/api/admin/trainers/:id', auth, requireAdmin, wrap(async (req, res) => {
  await pool.query('UPDATE users SET assigned_trainer_id = NULL WHERE assigned_trainer_id = $1', [req.params.id]);
  await pool.query("DELETE FROM users WHERE id = $1 AND role = 'trainer'", [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/admin/trainers/:id/stats', auth, requirePermission('trainers.manage'), wrap(async (req, res) => {
  const tid = parseInt(req.params.id);
  const today      = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const yearStart  = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [trainer, assigned, activeClients, admMTD, ptMTD, ptYTD] = await Promise.all([
    q1(`SELECT id, name, trainer_monthly_target::float AS monthly_target,
               trainer_specialization AS specialization, trainer_is_partner AS is_partner
        FROM users WHERE id = $1 AND role = 'trainer'`, [tid]),
    q1(`SELECT COUNT(*)::int AS n FROM users WHERE assigned_trainer_id = $1`, [tid]),
    q1(`SELECT COUNT(*)::int AS n FROM pt_assignments WHERE trainer_id = $1 AND status = 'active'`, [tid]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(paid_amount),0)::float AS revenue
        FROM admissions WHERE trainer_id = $1 AND admission_date >= $2`, [tid, monthStart]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price_paid),0)::float AS revenue
        FROM pt_assignments WHERE trainer_id = $1 AND start_date >= $2 AND status <> 'cancelled'`, [tid, monthStart]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price_paid),0)::float AS revenue
        FROM pt_assignments WHERE trainer_id = $1 AND start_date >= $2 AND status <> 'cancelled'`, [tid, yearStart]),
  ]);

  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

  const { ptRate, membershipRate } = commissionRates({ isPartner: trainer.is_partner, activeClients: activeClients.n });
  const mtdRevenue = (admMTD.revenue || 0) + (ptMTD.revenue || 0);
  const commission = Math.round(((admMTD.revenue || 0) * membershipRate / 100 + (ptMTD.revenue || 0) * ptRate / 100) * 100) / 100;
  const progress   = trainer.monthly_target
    ? Math.round((mtdRevenue / trainer.monthly_target) * 100)
    : null;

  res.json({
    trainer,
    membersAssigned: assigned.n,
    activeClients: activeClients.n,
    ptRate, membershipRate,
    mtd: {
      admissions: admMTD.n, admissionRevenue: admMTD.revenue || 0,
      ptSessions: ptMTD.n,  ptRevenue:        ptMTD.revenue  || 0,
      totalRevenue: mtdRevenue, commissionEarned: commission, targetProgress: progress,
    },
    ytd: { ptSessions: ptYTD.n, ptRevenue: ptYTD.revenue || 0 },
  });
}));

// ============================== PT Packages ==============================

app.get('/api/admin/pt-packages', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const rows = await q(`
    SELECT id, name, price::float AS price, validity_days, description, is_active, created_at
    FROM pt_packages ORDER BY is_active DESC, price
  `);
  res.json(rows);
}));

app.post('/api/admin/pt-packages', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const { name, price, validity_days, description } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  const row = await q1(`
    INSERT INTO pt_packages (name, price, validity_days, description)
    VALUES ($1,$2,$3,$4) RETURNING id
  `, [name, parseFloat(price), parseInt(validity_days) || 90, description || null]);
  res.json({ id: row.id });
}));

app.patch('/api/admin/pt-packages/:id', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const { name, price, validity_days, description, is_active } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (name          != null) { parts.push(`name = $${i++}`);          vals.push(name); }
  if (price         != null) { parts.push(`price = $${i++}`);         vals.push(parseFloat(price)); }
  if (validity_days != null) { parts.push(`validity_days = $${i++}`); vals.push(parseInt(validity_days)); }
  if (description   != null) { parts.push(`description = $${i++}`);   vals.push(description || null); }
  if (is_active     != null) { parts.push(`is_active = $${i++}`);     vals.push(is_active); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE pt_packages SET ${parts.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
}));

app.delete('/api/admin/pt-packages/:id', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  // Real delete, not a soft-deactivate. Past assignments keep their
  // denormalized package_name, so deleting a package doesn't erase history —
  // pt_assignments.package_id just goes NULL (ON DELETE SET NULL).
  await pool.query('DELETE FROM pt_packages WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================== PT Assignments ==============================

app.get('/api/admin/pt-assignments', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const { member_id, trainer_id, status } = req.query;
  const conds = []; const vals = []; let i = 1;
  if (member_id)  { conds.push(`pa.user_id = $${i++}`);    vals.push(parseInt(member_id)); }
  if (trainer_id) { conds.push(`pa.trainer_id = $${i++}`); vals.push(parseInt(trainer_id)); }
  if (status)     { conds.push(`pa.status = $${i++}`);     vals.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await q(`
    SELECT pa.*, u.name AS member_name, u.email AS member_email
    FROM pt_assignments pa LEFT JOIN users u ON u.id = pa.user_id
    ${where} ORDER BY pa.created_at DESC LIMIT 200
  `, vals);
  res.json(rows.map(r => ({ ...r, price_paid: parseFloat(r.price_paid) || 0 })));
}));

app.get('/api/admin/pt-assignments/:id', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const a = await q1(`
    SELECT pa.*, u.name AS member_name, u.email AS member_email
    FROM pt_assignments pa LEFT JOIN users u ON u.id = pa.user_id
    WHERE pa.id = $1
  `, [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({ ...a, price_paid: parseFloat(a.price_paid) || 0 });
}));

app.post('/api/admin/pt-assignments', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const { user_id, trainer_id, package_id, price_paid, start_date, remarks } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const pkg = package_id
    ? await q1('SELECT id, name, price::float AS price, validity_days FROM pt_packages WHERE id = $1', [package_id])
    : null;
  const trainer = trainer_id
    ? await q1("SELECT id, name FROM users WHERE id = $1 AND role = 'trainer'", [trainer_id])
    : null;

  // parseFloat(undefined) is NaN, and NaN !== 0 is true — so omitting
  // price_paid entirely used to insert NaN instead of falling back to the
  // package price. Guard explicitly for NaN as well as 0.
  const parsedPrice = parseFloat(price_paid);
  const pricePaid = !isNaN(parsedPrice) && parsedPrice !== 0 ? parsedPrice : (pkg?.price || 0);
  const sDate     = start_date || todayISO();
  let endDate     = null;
  if (pkg?.validity_days) {
    const ed = new Date(sDate); ed.setDate(ed.getDate() + pkg.validity_days);
    endDate = ed.toISOString().slice(0, 10);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query(`
      INSERT INTO pt_assignments (user_id, trainer_id, trainer_name, package_id, package_name,
        price_paid, start_date, end_date, remarks, recorded_by, recorded_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
    `, [user_id, trainer?.id || null, trainer?.name || null, pkg?.id || null, pkg?.name || null,
        pricePaid, sDate, endDate, remarks || null, req.user.id, req.user.name]);

    if (pricePaid > 0) {
      await client.query(`
        INSERT INTO payments (user_id, plan_name, amount, payment_date, method, status, notes, recorded_by, recorded_by_name, pt_assignment_id)
        VALUES ($1,'PT Package',$2,$3,'cash','paid',$4,$5,$6,$7)
      `, [user_id, pricePaid, sDate, `PT: ${pkg?.name || 'Custom'}`, req.user.id, req.user.name, row.rows[0].id]);
    }
    // Keep the member's "assigned trainer" (shown in the Members list) in
    // sync — otherwise a PT assignment made from this page never shows up
    // there, only ones made through Admissions did.
    if (trainer?.id) {
      await client.query('UPDATE users SET assigned_trainer_id = $1 WHERE id = $2', [trainer.id, user_id]);
    }
    await client.query('COMMIT');
    res.json({ id: row.rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.patch('/api/admin/pt-assignments/:id', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  const { status, remarks } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (status  != null) { parts.push(`status = $${i++}`);  vals.push(status); }
  if (remarks != null) { parts.push(`remarks = $${i++}`); vals.push(remarks); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE pt_assignments SET ${parts.join(', ')} WHERE id = $${i}`, vals);
    // Cancelling voids the revenue this assignment brought in — otherwise
    // Finance/Trainers/Reports keep counting a payment for a PT arrangement
    // that no longer exists. Re-activating restores it symmetrically.
    if (status === 'cancelled') {
      await client.query(
        `UPDATE payments SET status = 'refunded' WHERE pt_assignment_id = $1 AND status = 'paid'`,
        [req.params.id]
      );
    } else if (status === 'active') {
      await client.query(
        `UPDATE payments SET status = 'paid' WHERE pt_assignment_id = $1 AND status = 'refunded'`,
        [req.params.id]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

app.delete('/api/admin/pt-assignments/:id', auth, requirePermission('pt.manage'), wrap(async (req, res) => {
  await pool.query('DELETE FROM pt_assignments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================== Expenses ==============================

app.get('/api/admin/expenses', auth, requirePermission('expenses.manage'), wrap(async (req, res) => {
  const { from, to, category } = req.query;
  const conds = []; const vals = []; let i = 1;
  if (from)     { conds.push(`expense_date >= $${i++}`); vals.push(from); }
  if (to)       { conds.push(`expense_date <= $${i++}`); vals.push(to); }
  if (category) { conds.push(`category = $${i++}`);      vals.push(category); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await q(`
    SELECT id, expense_date, category, amount::float AS amount, description, recorded_by_name, created_at
    FROM expenses ${where} ORDER BY expense_date DESC, id DESC LIMIT 500
  `, vals);
  res.json(rows);
}));

app.post('/api/admin/expenses', auth, requirePermission('expenses.manage'), wrap(async (req, res) => {
  const { expense_date, category, amount, description } = req.body || {};
  if (!category || amount == null) return res.status(400).json({ error: 'category and amount required' });
  const row = await q1(`
    INSERT INTO expenses (expense_date, category, amount, description, recorded_by, recorded_by_name)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [expense_date || todayISO(), category, parseFloat(amount), description || null, req.user.id, req.user.name]);
  res.json({ id: row.id });
}));

// /summary must come before /:id to avoid Express matching "summary" as an id
app.get('/api/admin/expenses/summary', auth, requirePermission('expenses.manage'), wrap(async (req, res) => {
  const today = new Date();
  const year  = parseInt(req.query.year)  || today.getFullYear();
  const month = parseInt(req.query.month) || (today.getMonth() + 1);
  const from  = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0).toISOString().slice(0, 10);
  const rows = await q(`
    SELECT category, COALESCE(SUM(amount),0)::float AS total, COUNT(*)::int AS n
    FROM expenses WHERE expense_date >= $1 AND expense_date <= $2
    GROUP BY category ORDER BY total DESC
  `, [from, toDate]);
  res.json({ year, month, from, to: toDate, total: rows.reduce((s,r)=>s+r.total,0), byCategory: rows });
}));

app.patch('/api/admin/expenses/:id', auth, requirePermission('expenses.manage'), wrap(async (req, res) => {
  const { expense_date, category, amount, description } = req.body || {};
  const parts = []; const vals = []; let i = 1;
  if (expense_date != null) { parts.push(`expense_date = $${i++}`); vals.push(expense_date); }
  if (category     != null) { parts.push(`category = $${i++}`);     vals.push(category); }
  if (amount       != null) { parts.push(`amount = $${i++}`);       vals.push(parseFloat(amount)); }
  if (description  != null) { parts.push(`description = $${i++}`);  vals.push(description || null); }
  if (!parts.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE expenses SET ${parts.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
}));

app.delete('/api/admin/expenses/:id', auth, requirePermission('expenses.manage'), wrap(async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================== Owner Dashboard ==============================

app.get('/api/admin/dashboard', auth, requirePermission('reports.view'), wrap(async (req, res) => {
  const today      = todayISO();
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const in14       = new Date(now); in14.setDate(in14.getDate() + 14);
  const in14ISO    = in14.toISOString().slice(0, 10);
  const last30     = new Date(now); last30.setDate(last30.getDate() - 29);
  const last30ISO  = last30.toISOString().slice(0, 10);

  const [
    todayAdm, todayRev, monthRev, monthExp,
    outstanding, activeMembers, expiring,
    todayAtt, recentAdm, revTrend, admTrend, trainerPerf,
  ] = await Promise.all([
    q1(`SELECT COUNT(*)::int AS n FROM admissions WHERE admission_date = $1`, [today]),
    q1(`SELECT COALESCE(SUM(paid_amount),0)::float AS s FROM admissions WHERE admission_date = $1`, [today]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s FROM payments WHERE status='paid' AND payment_date >= $1`, [monthStart]),
    q1(`SELECT COALESCE(SUM(amount),0)::float AS s FROM expenses WHERE expense_date >= $1`, [monthStart]),
    q1(`SELECT COALESCE(SUM(balance),0)::float AS s, COUNT(*)::int AS n FROM admissions WHERE balance > 0`),
    q1(`SELECT COUNT(*)::int AS n FROM users WHERE role='member' AND subscription_expiry >= $1`, [today]),
    q(`SELECT id, name, phone, subscription_plan, subscription_expiry
       FROM users WHERE role='member' AND subscription_expiry >= $1 AND subscription_expiry <= $2
       ORDER BY subscription_expiry LIMIT 10`, [today, in14ISO]),
    q1(`SELECT COUNT(*)::int AS n FROM attendance WHERE date = $1`, [today]),
    q(`SELECT a.id, a.receipt_number, a.type, a.paid_amount::float AS paid_amount,
              a.balance::float AS balance, a.plan_name, a.admission_date, u.name AS member_name
       FROM admissions a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 8`),
    q(`SELECT to_char(payment_date::date,'YYYY-MM-DD') AS d, COALESCE(SUM(amount),0)::float AS revenue
       FROM payments WHERE status='paid' AND payment_date >= $1 GROUP BY d ORDER BY d`, [last30ISO]),
    q(`SELECT admission_date AS d, COUNT(*)::int AS n
       FROM admissions WHERE admission_date >= $1 GROUP BY d ORDER BY d`, [last30ISO]),
    q(`SELECT u.id, u.name, COUNT(a.id)::int AS admissions,
              COALESCE(SUM(a.paid_amount),0)::float AS revenue,
              u.trainer_commission_rate::float AS rate
       FROM users u
       LEFT JOIN admissions a ON a.trainer_id = u.id AND a.admission_date >= $1
       WHERE u.role = 'trainer'
       GROUP BY u.id, u.name, u.trainer_commission_rate
       ORDER BY revenue DESC LIMIT 5`, [monthStart]),
  ]);

  res.json({
    today: { admissions: todayAdm.n, revenue: todayRev.s, attendance: todayAtt.n },
    monthly: { revenue: monthRev.s, expenses: monthExp.s, profit: (monthRev.s || 0) - (monthExp.s || 0) },
    outstanding,
    activeMembers: activeMembers.n,
    expiringMemberships: expiring,
    trainerPerformance: trainerPerf.map(t => ({
      ...t,
      commission: Math.round((t.revenue || 0) * (t.rate || 10) / 100 * 100) / 100,
    })),
    recentAdmissions: recentAdm,
    charts: { revenue: revTrend, admissions: admTrend },
  });
}));

// ============================== Reports ==============================

app.get('/api/admin/reports', auth, requirePermission('reports.view'), wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const [admByType, revByMethod, expByCat, ptSummary,
         trainerSummary, attendanceSummary, attendancePeak, attendanceDays,
         newMembers, renewals] = await Promise.all([
    q(`SELECT type, COUNT(*)::int AS count, COALESCE(SUM(paid_amount),0)::float AS revenue,
              COALESCE(SUM(discount),0)::float AS discount, COALESCE(SUM(balance),0)::float AS outstanding
       FROM admissions WHERE admission_date >= $1 AND admission_date <= $2 GROUP BY type`, [from, to]),
    q(`SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total
       FROM payments WHERE status='paid' AND payment_date >= $1 AND payment_date <= $2
       GROUP BY method ORDER BY total DESC`, [from, to]),
    q(`SELECT category, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total
       FROM expenses WHERE expense_date >= $1 AND expense_date <= $2
       GROUP BY category ORDER BY total DESC`, [from, to]),
    q1(`SELECT COUNT(DISTINCT pa.user_id)::int AS members, COALESCE(SUM(price_paid),0)::float AS revenue,
               COUNT(*)::int AS assignments
        FROM pt_assignments pa WHERE start_date >= $1 AND start_date <= $2 AND status <> 'cancelled'`, [from, to]),
    q(`SELECT u.id, u.name, u.trainer_is_partner AS is_partner,
              COALESCE(adm.cnt, 0)::int AS admissions,
              COALESCE(adm.revenue, 0)::float AS admission_revenue,
              COALESCE(pt.revenue, 0)::float AS pt_revenue,
              COALESCE(active.cnt, 0)::int AS active_clients
       FROM users u
       LEFT JOIN (
         SELECT trainer_id, COUNT(*)::int AS cnt, SUM(paid_amount) AS revenue
         FROM admissions WHERE admission_date >= $1 AND admission_date <= $2 GROUP BY trainer_id
       ) adm ON adm.trainer_id = u.id
       LEFT JOIN (
         SELECT trainer_id, SUM(price_paid) AS revenue
         FROM pt_assignments WHERE start_date >= $1 AND start_date <= $2 AND status <> 'cancelled' GROUP BY trainer_id
       ) pt ON pt.trainer_id = u.id
       LEFT JOIN (
         SELECT trainer_id, COUNT(*)::int AS cnt FROM pt_assignments WHERE status = 'active' GROUP BY trainer_id
       ) active ON active.trainer_id = u.id
       WHERE u.role = 'trainer'
       ORDER BY u.name`, [from, to]),
    q1(`SELECT COUNT(*)::int AS total, COUNT(DISTINCT user_id)::int AS unique
        FROM attendance WHERE date >= $1 AND date <= $2`, [from, to]),
    q1(`SELECT date AS peak_date, COUNT(*)::int AS peak_count
        FROM attendance WHERE date >= $1 AND date <= $2
        GROUP BY date ORDER BY peak_count DESC LIMIT 1`, [from, to]),
    q1(`SELECT COUNT(DISTINCT date)::int AS days FROM attendance WHERE date >= $1 AND date <= $2`, [from, to]),
    q1(`SELECT COUNT(*)::int AS n FROM users WHERE role='member' AND joined >= $1 AND joined <= $2`, [from, to]),
    q1(`SELECT COUNT(*)::int AS n FROM admissions WHERE type='renewal' AND admission_date >= $1 AND admission_date <= $2`, [from, to]),
  ]);

  const totalAdmissions = admByType.reduce((s, r) => s + r.count, 0);
  const totalRevenue    = revByMethod.reduce((s, r) => s + r.total, 0);
  const totalExpenses   = expByCat.reduce((s, r) => s + r.total, 0);

  res.json({
    period: { from, to },
    admissions: {
      total_count: totalAdmissions,
      new_count: newMembers.n,
      renewal_count: renewals.n,
      by_type: admByType,
    },
    revenue: {
      total: totalRevenue,
      count: revByMethod.reduce((s, r) => s + r.count, 0),
      by_method: revByMethod,
    },
    expenses: {
      total: totalExpenses,
      count: expByCat.reduce((s, r) => s + r.count, 0),
      by_category: expByCat,
    },
    trainers: trainerSummary.map(t => {
      const { ptRate, membershipRate } = commissionRates({ isPartner: t.is_partner, activeClients: t.active_clients });
      const revenue = (t.admission_revenue || 0) + (t.pt_revenue || 0);
      const commission = (t.admission_revenue || 0) * membershipRate / 100 + (t.pt_revenue || 0) * ptRate / 100;
      return { ...t, revenue, commission: Math.round(commission * 100) / 100, ptRate, membershipRate };
    }),
    pt: {
      revenue: ptSummary?.revenue || 0,
      assignments: ptSummary?.assignments || 0,
      members: ptSummary?.members || 0,
    },
    attendance: {
      total: attendanceSummary?.total || 0,
      unique: attendanceSummary?.unique || 0,
      days: attendanceDays?.days || 0,
      peak_date: attendancePeak?.peak_date || null,
      peak_count: attendancePeak?.peak_count || 0,
    },
  });
}));

// Net profit split, one row per calendar month that has any revenue or
// expense activity: total revenue (membership + PT combined) minus total
// expenses = net profit, split 50/50 between the owning company and
// whichever trainer is flagged as the partner. Most recent month first, so
// this doubles as "this month's split" (row 0) plus a running history below.
app.get('/api/admin/reports/monthly-summary', auth, requirePermission('reports.view'), wrap(async (req, res) => {
  const partner = await q1(`SELECT name FROM users WHERE role = 'trainer' AND trainer_is_partner = TRUE ORDER BY id LIMIT 1`);
  const partnerName = partner?.name || 'Partner Trainer';

  const [revByMonth, expByMonth, membersByMonth, checkinsByMonth] = await Promise.all([
    q(`SELECT to_char(payment_date::date, 'YYYY-MM') AS ym, COALESCE(SUM(amount),0)::float AS total
       FROM payments WHERE status = 'paid' GROUP BY ym`),
    q(`SELECT to_char(expense_date::date, 'YYYY-MM') AS ym, COALESCE(SUM(amount),0)::float AS total
       FROM expenses GROUP BY ym`),
    q(`SELECT to_char(joined::date, 'YYYY-MM') AS ym, COUNT(*)::int AS n
       FROM users WHERE role = 'member' GROUP BY ym`),
    q(`SELECT to_char(date::date, 'YYYY-MM') AS ym, COUNT(*)::int AS n
       FROM attendance GROUP BY ym`),
  ]);

  const revMap = Object.fromEntries(revByMonth.map(r => [r.ym, r.total]));
  const expMap = Object.fromEntries(expByMonth.map(r => [r.ym, r.total]));
  const newMembersMap = Object.fromEntries(membersByMonth.map(r => [r.ym, r.n]));
  const checkinsMap = Object.fromEntries(checkinsByMonth.map(r => [r.ym, r.n]));
  const months = [...new Set([
    ...Object.keys(revMap), ...Object.keys(expMap), ...Object.keys(newMembersMap), ...Object.keys(checkinsMap),
  ])].sort().reverse();

  const rows = months.map(ym => {
    const revenue    = revMap[ym] || 0;
    const expenses   = expMap[ym] || 0;
    const netProfit   = revenue - expenses;
    const companyShare = Math.round((netProfit / 2) * 100) / 100;
    const partnerShare = Math.round((netProfit / 2) * 100) / 100;
    return {
      month: ym, revenue, expenses, netProfit, companyShare, partnerShare,
      newMembers: newMembersMap[ym] || 0, checkins: checkinsMap[ym] || 0,
    };
  });

  res.json({ companyName: COMPANY_NAME, partnerName, months: rows });
}));

// ============================== Trainer Portal ==============================

// A trainer's own earnings/commission — same numbers admin sees on the
// Trainers page, just self-scoped (no trainers.manage permission needed) so
// a trainer can check their own commission without asking admin.
app.get('/api/trainer/stats', auth, requireTrainer, wrap(async (req, res) => {
  const tid = effectiveTrainerId(req);
  const today      = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const yearStart  = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [trainer, assigned, activeClients, admMTD, ptMTD, ptYTD] = await Promise.all([
    q1(`SELECT id, name, trainer_monthly_target::float AS monthly_target,
               trainer_specialization AS specialization, trainer_is_partner AS is_partner
        FROM users WHERE id = $1 AND role = 'trainer'`, [tid]),
    q1(`SELECT COUNT(*)::int AS n FROM users WHERE assigned_trainer_id = $1`, [tid]),
    q1(`SELECT COUNT(*)::int AS n FROM pt_assignments WHERE trainer_id = $1 AND status = 'active'`, [tid]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(paid_amount),0)::float AS revenue
        FROM admissions WHERE trainer_id = $1 AND admission_date >= $2`, [tid, monthStart]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price_paid),0)::float AS revenue
        FROM pt_assignments WHERE trainer_id = $1 AND start_date >= $2 AND status <> 'cancelled'`, [tid, monthStart]),
    q1(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price_paid),0)::float AS revenue
        FROM pt_assignments WHERE trainer_id = $1 AND start_date >= $2 AND status <> 'cancelled'`, [tid, yearStart]),
  ]);

  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

  const { ptRate, membershipRate } = commissionRates({ isPartner: trainer.is_partner, activeClients: activeClients.n });
  const mtdRevenue = (admMTD.revenue || 0) + (ptMTD.revenue || 0);
  const commission = Math.round(((admMTD.revenue || 0) * membershipRate / 100 + (ptMTD.revenue || 0) * ptRate / 100) * 100) / 100;
  const progress   = trainer.monthly_target
    ? Math.round((mtdRevenue / trainer.monthly_target) * 100)
    : null;

  res.json({
    trainer,
    membersAssigned: assigned.n,
    activeClients: activeClients.n,
    ptRate, membershipRate,
    mtd: {
      admissions: admMTD.n, admissionRevenue: admMTD.revenue || 0,
      ptSessions: ptMTD.n,  ptRevenue:        ptMTD.revenue  || 0,
      totalRevenue: mtdRevenue, commissionEarned: commission, targetProgress: progress,
    },
    ytd: { ptSessions: ptYTD.n, ptRevenue: ptYTD.revenue || 0 },
  });
}));

// My clients — members with an active PT assignment under this trainer
app.get('/api/trainer/clients', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  // One row per member: their active assignment with this trainer if they have
  // one, otherwise their most recent completed one — so a client whose package
  // just ran out (e.g. via the booking flow) still shows up here instead of
  // disappearing from the trainer's list.
  const rows = await q(`
    SELECT * FROM (
      SELECT DISTINCT ON (u.id)
        u.id, u.name, u.email, u.phone, u.goal, u.height,
        u.workout_plan_json  AS workout_plan,
        u.nutrition_plan_json AS nutrition_plan,
        pa.id        AS assignment_id,
        pa.sessions_total,
        pa.sessions_used,
        pa.start_date,
        pa.end_date,
        pa.status    AS assignment_status,
        pkg.name     AS package_name,
        (SELECT date FROM weight_log WHERE user_id = u.id ORDER BY date DESC LIMIT 1) AS last_weight_date,
        (SELECT kg   FROM weight_log WHERE user_id = u.id ORDER BY date DESC LIMIT 1) AS last_weight_kg,
        (SELECT COUNT(*)::int FROM attendance WHERE user_id = u.id
           AND date::date >= CURRENT_DATE - INTERVAL '30 days') AS attendance_30d
      FROM pt_assignments pa
      JOIN users u   ON u.id = pa.user_id
      LEFT JOIN pt_packages pkg ON pkg.id = pa.package_id
      WHERE pa.trainer_id = $1 AND pa.status IN ('active', 'completed')
      ORDER BY u.id, (pa.status = 'active') DESC, pa.created_at DESC
    ) sub
    ORDER BY name
  `, [trainerId]);
  res.json(rows);
}));

// Single client detail (trainer must own an active or completed assignment)
app.get('/api/trainer/clients/:id', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const memberId  = parseInt(req.params.id, 10);
  const assignment = await q1(
    `SELECT id FROM pt_assignments WHERE trainer_id = $1 AND user_id = $2 AND status IN ('active','completed') ORDER BY created_at DESC LIMIT 1`,
    [trainerId, memberId]
  );
  if (!assignment) return res.status(403).json({ error: 'Not your client' });

  const u = toUser(await q1('SELECT * FROM users WHERE id = $1', [memberId]));
  if (!u) return res.status(404).json({ error: 'Member not found' });
  u.weightLog  = await q('SELECT date, kg FROM weight_log WHERE user_id = $1 ORDER BY date', [memberId]);
  u.attendance = (await q('SELECT date FROM attendance WHERE user_id = $1 ORDER BY date DESC LIMIT 60', [memberId])).map(r => r.date);
  u.ptSessions = await q(
    `SELECT session_date AS date, notes FROM pt_sessions WHERE assignment_id = $1 ORDER BY session_date DESC`,
    [assignment.id]
  );
  res.json(u);
}));

// Update workout plan (trainer must own an active or completed assignment)
app.put('/api/trainer/clients/:id/workout', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const memberId  = parseInt(req.params.id, 10);
  const ok = await q1(
    `SELECT id FROM pt_assignments WHERE trainer_id = $1 AND user_id = $2 AND status IN ('active','completed') ORDER BY created_at DESC LIMIT 1`,
    [trainerId, memberId]
  );
  if (!ok) return res.status(403).json({ error: 'Not your client' });
  await pool.query('UPDATE users SET workout_plan_json = $1 WHERE id = $2', [req.body, memberId]);
  res.json({ ok: true });
}));

// Send the client's current workout plan over WhatsApp.
app.post('/api/trainer/clients/:id/workout/whatsapp', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const memberId  = parseInt(req.params.id, 10);
  const assignment = await q1(
    `SELECT id FROM pt_assignments WHERE trainer_id = $1 AND user_id = $2 AND status IN ('active','completed') ORDER BY created_at DESC LIMIT 1`,
    [trainerId, memberId]
  );
  if (!assignment) return res.status(403).json({ error: 'Not your client' });

  const member  = await q1('SELECT name, phone, workout_plan_json FROM users WHERE id = $1', [memberId]);
  const trainer = await q1('SELECT name FROM users WHERE id = $1', [trainerId]);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.phone) return res.status(400).json({ error: 'Member has no phone number on file' });

  const plan = req.body?.plan || member.workout_plan_json;
  if (!plan) return res.status(400).json({ error: 'No workout plan to send yet — save one first' });

  const message = buildWorkoutPlanMessage({ memberName: member.name, trainerName: trainer?.name || 'Your trainer', plan });
  const result = await sendWhatsAppText({ phone: member.phone, message });

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: workout plan sent to ${member.name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json(result);
}));

// Update nutrition plan (trainer must own an active or completed assignment)
app.put('/api/trainer/clients/:id/nutrition', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const memberId  = parseInt(req.params.id, 10);
  const ok = await q1(
    `SELECT id FROM pt_assignments WHERE trainer_id = $1 AND user_id = $2 AND status IN ('active','completed') ORDER BY created_at DESC LIMIT 1`,
    [trainerId, memberId]
  );
  if (!ok) return res.status(403).json({ error: 'Not your client' });
  await pool.query('UPDATE users SET nutrition_plan_json = $1 WHERE id = $2', [req.body, memberId]);
  res.json({ ok: true });
}));

// Send the client's current diet plan over WhatsApp. Body may include a
// `plan` to send (e.g. right after saving, before a reload) — otherwise it
// sends whatever is currently stored on the member.
app.post('/api/trainer/clients/:id/nutrition/whatsapp', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const memberId  = parseInt(req.params.id, 10);
  const assignment = await q1(
    `SELECT id FROM pt_assignments WHERE trainer_id = $1 AND user_id = $2 AND status IN ('active','completed') ORDER BY created_at DESC LIMIT 1`,
    [trainerId, memberId]
  );
  if (!assignment) return res.status(403).json({ error: 'Not your client' });

  const member  = await q1('SELECT name, phone, nutrition_plan_json FROM users WHERE id = $1', [memberId]);
  const trainer = await q1('SELECT name FROM users WHERE id = $1', [trainerId]);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.phone) return res.status(400).json({ error: 'Member has no phone number on file' });

  const plan = req.body?.plan || member.nutrition_plan_json;
  if (!plan) return res.status(400).json({ error: 'No diet plan to send yet — save one first' });

  const message = buildDietPlanMessage({ memberName: member.name, trainerName: trainer?.name || 'Your trainer', plan });
  const result = await sendWhatsAppText({ phone: member.phone, message });

  await pool.query(
    'INSERT INTO broadcasts (type, title, body, sent, recipients, sent_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [`whatsapp-${result.mode}`, `WhatsApp: diet plan sent to ${member.name}`, result.message, new Date().toISOString(), 1, req.user.name]
  );
  res.json(result);
}));

// ============================== PT Booking ==============================
// Gym operates in India — all "today"/cutoff logic is pinned to IST rather
// than the server's OS timezone (serverless hosts run UTC).
const IST_OFFSET_MINUTES = 330; // UTC+5:30
const BOOKING_LEAD_MINUTES = 60; // can't book a slot starting within the next hour
const CANCEL_CUTOFF_HOURS = 4;   // members can't cancel within 4h of the session start

function istNow() { return new Date(Date.now() + IST_OFFSET_MINUTES * 60000); }
function istTodayISO() { return istNow().toISOString().slice(0, 10); }
function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
// Subtract [bs,be) from a list of open [start,end) windows, all in minutes-of-day.
function subtractWindow(windows, bs, be) {
  const out = [];
  for (const [s, e] of windows) {
    if (be <= s || bs >= e) { out.push([s, e]); continue; }
    if (bs > s) out.push([s, bs]);
    if (be < e) out.push([be, e]);
  }
  return out;
}

async function notify(client, userId, type, title, body) {
  await client.query(
    'INSERT INTO notifications (user_id, type, title, body, sent, is_read) VALUES ($1,$2,$3,$4,$5,FALSE)',
    [userId, type, title, body, new Date().toISOString()]
  );
}

// Computes open slots for a trainer across [fromDate,toDate] (inclusive, 'YYYY-MM-DD'),
// from recurring weekly hours, minus/plus per-date exceptions, minus existing
// confirmed bookings, sliced into the trainer's fixed session duration.
async function computeAvailability(trainerId, fromDate, toDate) {
  const trainerRow = await q1('SELECT trainer_session_duration_minutes FROM users WHERE id = $1', [trainerId]);
  const duration = trainerRow?.trainer_session_duration_minutes || 60;

  const [hours, exceptions, bookings] = await Promise.all([
    q('SELECT day_of_week, start_time, end_time FROM trainer_working_hours WHERE trainer_id = $1 AND is_active', [trainerId]),
    q('SELECT exception_date, type, start_time, end_time FROM trainer_schedule_exceptions WHERE trainer_id = $1 AND exception_date BETWEEN $2 AND $3', [trainerId, fromDate, toDate]),
    q(`SELECT booking_date, start_time FROM pt_bookings WHERE trainer_id = $1 AND booking_date BETWEEN $2 AND $3 AND status = 'confirmed'`, [trainerId, fromDate, toDate]),
  ]);

  const hoursByDow = {};
  for (const h of hours) (hoursByDow[h.day_of_week] ||= []).push([timeToMinutes(h.start_time), timeToMinutes(h.end_time)]);
  const exceptionsByDate = {};
  for (const e of exceptions) (exceptionsByDate[e.exception_date] ||= []).push(e);
  const bookedByDate = {};
  for (const b of bookings) (bookedByDate[b.booking_date] ||= new Set()).add(b.start_time);

  const today = istTodayISO();
  const nowMinutes = timeToMinutes(istNow().toISOString().slice(11, 16));

  const result = {};
  const cursor = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dow = cursor.getUTCDay();
    let windows = (hoursByDow[dow] || []).map(w => [...w]);

    for (const ex of exceptionsByDate[dateStr] || []) {
      if (ex.type === 'block') {
        windows = ex.start_time == null ? [] : subtractWindow(windows, timeToMinutes(ex.start_time), timeToMinutes(ex.end_time));
      } else if (ex.type === 'add') {
        windows.push([timeToMinutes(ex.start_time), timeToMinutes(ex.end_time)]);
      }
    }

    const slots = [];
    for (const [s, e] of windows) {
      for (let t = s; t + duration <= e; t += duration) {
        if (dateStr === today && t < nowMinutes + BOOKING_LEAD_MINUTES) continue;
        const timeStr = minutesToTime(t);
        if (bookedByDate[dateStr]?.has(timeStr)) continue;
        slots.push(timeStr);
      }
    }
    if (slots.length) result[dateStr] = slots.sort();
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

// ---- Trainer working hours (self-service) ----
app.get('/api/trainer/working-hours', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const [hours, u] = await Promise.all([
    q('SELECT id, day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime", is_active AS "isActive" FROM trainer_working_hours WHERE trainer_id = $1 ORDER BY day_of_week', [trainerId]),
    q1('SELECT trainer_session_duration_minutes FROM users WHERE id = $1', [trainerId]),
  ]);
  res.json({ sessionDurationMinutes: u?.trainer_session_duration_minutes || 60, hours });
}));

app.put('/api/trainer/working-hours', auth, requireTrainer, wrap(async (req, res) => {
  const trainerId = effectiveTrainerId(req);
  const { sessionDurationMinutes, hours } = req.body || {};
  if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours array required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM trainer_working_hours WHERE trainer_id = $1', [trainerId]);
    for (const h of hours) {
      if (h.dayOfWeek == null || !h.startTime || !h.endTime) continue;
      await client.query(
        'INSERT INTO trainer_working_hours (trainer_id, day_of_week, start_time, end_time, is_active) VALUES ($1,$2,$3,$4,$5)',
        [trainerId, h.dayOfWeek, h.startTime, h.endTime, h.isActive !== false]
      );
    }
    if (sessionDurationMinutes) {
      await client.query('UPDATE users SET trainer_session_duration_minutes = $1 WHERE id = $2', [parseInt(sessionDurationMinutes, 10), trainerId]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// ---- Trainer schedule exceptions (block time off / add extra availability) ----
app.get('/api/trainer/schedule-exceptions', auth, requireTrainer, wrap(async (req, res) => {
  const { from, to } = req.query;
  const conds = ['trainer_id = $1']; const vals = [effectiveTrainerId(req)]; let i = 2;
  if (from) { conds.push(`exception_date >= $${i++}`); vals.push(from); }
  if (to)   { conds.push(`exception_date <= $${i++}`); vals.push(to); }
  const rows = await q(
    `SELECT id, exception_date AS date, type, start_time AS "startTime", end_time AS "endTime", reason
     FROM trainer_schedule_exceptions WHERE ${conds.join(' AND ')} ORDER BY exception_date`,
    vals
  );
  res.json(rows);
}));

app.post('/api/trainer/schedule-exceptions', auth, requireTrainer, wrap(async (req, res) => {
  const { date, type, startTime, endTime, reason } = req.body || {};
  if (!date || !['block', 'add'].includes(type)) return res.status(400).json({ error: 'date and type (block|add) required' });
  if (type === 'add' && (!startTime || !endTime)) return res.status(400).json({ error: 'startTime and endTime required for add exceptions' });
  const row = await q1(
    `INSERT INTO trainer_schedule_exceptions (trainer_id, exception_date, type, start_time, end_time, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [effectiveTrainerId(req), date, type, startTime || null, endTime || null, reason || null, req.user.id]
  );
  res.json({ id: row.id });
}));

app.delete('/api/trainer/schedule-exceptions/:id', auth, requireTrainer, wrap(async (req, res) => {
  await pool.query('DELETE FROM trainer_schedule_exceptions WHERE id = $1 AND trainer_id = $2', [req.params.id, effectiveTrainerId(req)]);
  res.json({ ok: true });
}));

// ---- Member-facing PT context + availability ----
app.get('/api/me/pt-context', auth, wrap(async (req, res) => {
  const me = await q1('SELECT assigned_trainer_id FROM users WHERE id = $1', [req.user.id]);
  if (!me?.assigned_trainer_id) return res.json({ hasTrainer: false });

  const trainer = await q1(
    `SELECT id, name, trainer_specialization AS specialization, trainer_session_duration_minutes AS "sessionDurationMinutes"
     FROM users WHERE id = $1 AND role = 'trainer'`,
    [me.assigned_trainer_id]
  );
  if (!trainer) return res.json({ hasTrainer: false });

  const assignments = await q(
    `SELECT id, sessions_total AS "sessionsTotal", sessions_used AS "sessionsUsed"
     FROM pt_assignments WHERE user_id = $1 AND trainer_id = $2 AND status = 'active' ORDER BY start_date`,
    [req.user.id, trainer.id]
  );
  const remainingCredits = assignments.reduce((sum, a) => sum + Math.max(0, a.sessionsTotal - a.sessionsUsed), 0);

  const workingHours = await q(
    `SELECT day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime"
     FROM trainer_working_hours WHERE trainer_id = $1 AND is_active ORDER BY day_of_week`,
    [trainer.id]
  );
  trainer.workingHours = workingHours;

  res.json({ hasTrainer: true, trainer, remainingCredits });
}));

app.get('/api/trainer/:trainerId/availability', auth, wrap(async (req, res) => {
  const trainerId = parseInt(req.params.trainerId, 10);
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  if (req.user.role === 'member') {
    const me = await q1('SELECT assigned_trainer_id FROM users WHERE id = $1', [req.user.id]);
    if (me?.assigned_trainer_id !== trainerId) return res.status(403).json({ error: 'Not your trainer' });
  } else if (req.user.role === 'trainer' && req.user.id !== trainerId) {
    return res.status(403).json({ error: 'Not your calendar' });
  }

  res.json(await computeAvailability(trainerId, from, to));
}));

// ---- Booking lifecycle ----
app.post('/api/pt-bookings', auth, wrap(async (req, res) => {
  if (req.user.role !== 'member') return res.status(403).json({ error: 'Only members can book sessions' });
  const { date, startTime } = req.body || {};
  if (!date || !startTime) return res.status(400).json({ error: 'date and startTime required' });

  const me = await q1('SELECT assigned_trainer_id FROM users WHERE id = $1', [req.user.id]);
  const trainerId = me?.assigned_trainer_id;
  if (!trainerId) return res.status(400).json({ error: 'You have no assigned trainer' });

  const trainer = await q1('SELECT name, trainer_session_duration_minutes AS duration FROM users WHERE id = $1', [trainerId]);
  const duration = trainer?.duration || 60;

  const assignment = await q1(
    `SELECT id, sessions_total, sessions_used FROM pt_assignments
     WHERE user_id = $1 AND trainer_id = $2 AND status = 'active' AND sessions_used < sessions_total
     ORDER BY start_date ASC LIMIT 1`,
    [req.user.id, trainerId]
  );
  if (!assignment) return res.status(400).json({ error: 'You have no active PT sessions remaining with your trainer' });

  // Recompute availability server-side rather than trusting the client's slot choice.
  const dayMap = await computeAvailability(trainerId, date, date);
  if (!dayMap[date]?.includes(startTime)) return res.status(400).json({ error: 'That slot is no longer available' });

  const endTime = minutesToTime(timeToMinutes(startTime) + duration);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let bookingId;
    try {
      const row = await client.query(
        `INSERT INTO pt_bookings (assignment_id, member_id, trainer_id, booking_date, start_time, end_time)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [assignment.id, req.user.id, trainerId, date, startTime, endTime]
      );
      bookingId = row.rows[0].id;
    } catch (e) {
      if (e.code === '23505') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'That slot was just booked by someone else' });
      }
      throw e;
    }

    await client.query(
      `INSERT INTO pt_sessions (assignment_id, session_date, notes, marked_by, marked_by_name, booking_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [assignment.id, date, `Booked session ${startTime}-${endTime}`, req.user.id, req.user.name, bookingId]
    );
    const upd = await client.query(
      `UPDATE pt_assignments SET sessions_used = sessions_used + 1,
         status = CASE WHEN sessions_used + 1 >= sessions_total THEN 'completed' ELSE status END
       WHERE id = $1 RETURNING sessions_used, sessions_total`,
      [assignment.id]
    );

    await notify(client, trainerId, 'booking', 'New session booked', `${req.user.name} booked a session on ${date} at ${startTime}.`);
    await notify(client, req.user.id, 'booking', 'Session booked', `Your session with ${trainer.name} on ${date} at ${startTime} is confirmed.`);

    await client.query('COMMIT');
    res.json({
      id: bookingId, date, startTime, endTime, trainerName: trainer.name,
      remainingCredits: upd.rows[0].sessions_total - upd.rows[0].sessions_used,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.get('/api/me/pt-bookings', auth, wrap(async (req, res) => {
  const scope = req.query.scope === 'past' ? 'past' : 'upcoming';
  const today = istTodayISO();
  const cmp = scope === 'past' ? '<' : '>=';
  const rows = await q(
    `SELECT b.id, b.booking_date AS date, b.start_time AS "startTime", b.end_time AS "endTime", b.status,
            u.name AS "trainerName"
     FROM pt_bookings b JOIN users u ON u.id = b.trainer_id
     WHERE b.member_id = $1 AND b.booking_date ${cmp} $2
     ORDER BY b.booking_date ${scope === 'past' ? 'DESC' : 'ASC'}, b.start_time`,
    [req.user.id, today]
  );
  res.json(rows);
}));

app.delete('/api/pt-bookings/:id', auth, wrap(async (req, res) => {
  const booking = await q1('SELECT * FROM pt_bookings WHERE id = $1', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Booking already cancelled' });

  const isOwner = req.user.role === 'member' && booking.member_id === req.user.id;
  const isTrainer = req.user.role === 'trainer' && booking.trainer_id === req.user.id;
  if (!isOwner && !isTrainer && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your booking' });

  if (isOwner) {
    const startsAt = new Date(`${booking.booking_date}T${booking.start_time}:00+05:30`);
    const hoursUntil = (startsAt.getTime() - Date.now()) / 3600000;
    if (hoursUntil < CANCEL_CUTOFF_HOURS) {
      return res.status(400).json({ error: `Cancellations must be made at least ${CANCEL_CUTOFF_HOURS} hours in advance. Please contact your trainer.` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE pt_bookings SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW(), cancel_reason = $2 WHERE id = $3`,
      [req.user.id, req.body?.reason || null, booking.id]
    );
    await client.query('DELETE FROM pt_sessions WHERE booking_id = $1', [booking.id]);
    await client.query(
      `UPDATE pt_assignments SET sessions_used = GREATEST(sessions_used - 1, 0),
         status = CASE WHEN status = 'completed' THEN 'active' ELSE status END
       WHERE id = $1`,
      [booking.assignment_id]
    );

    const [member, trainer] = await Promise.all([
      q1('SELECT name FROM users WHERE id = $1', [booking.member_id]),
      q1('SELECT name FROM users WHERE id = $1', [booking.trainer_id]),
    ]);
    const notifyUserId = isOwner ? booking.trainer_id : booking.member_id;
    const cancellerName = isOwner ? member?.name : trainer?.name;
    await notify(client, notifyUserId, 'booking', 'Session cancelled',
      `${cancellerName || 'The other party'} cancelled the session on ${booking.booking_date} at ${booking.start_time}.`);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.get('/api/trainer/pt-bookings', auth, requireTrainer, wrap(async (req, res) => {
  const { from, to } = req.query;
  const conds = ['b.trainer_id = $1', "b.status = 'confirmed'"]; const vals = [effectiveTrainerId(req)]; let i = 2;
  if (from) { conds.push(`b.booking_date >= $${i++}`); vals.push(from); }
  if (to)   { conds.push(`b.booking_date <= $${i++}`); vals.push(to); }
  const rows = await q(
    `SELECT b.id, u.name AS title, b.booking_date, b.start_time, b.end_time, b.status, b.member_id AS "memberId"
     FROM pt_bookings b JOIN users u ON u.id = b.member_id
     WHERE ${conds.join(' AND ')} ORDER BY b.booking_date, b.start_time`,
    vals
  );
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    start: `${r.booking_date}T${r.start_time}:00`,
    end: `${r.booking_date}T${r.end_time}:00`,
    status: r.status,
    memberId: r.memberId,
  })));
}));

// SPA fallback
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler for wrapped async routes
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ============================== Boot ==============================
// Local dev — start the HTTP server. In Vercel / serverless environments the
// platform imports `app` directly and this branch is skipped.
if (require.main === module) {
  initOnce()
    .then(() => {
      app.listen(parseInt(PORT, 10), () => {
        console.log(`\n  Stellar Fitness Club running at  http://localhost:${PORT}`);
        console.log(`  PostgreSQL: ${CONNECTION_STRING ? '<connection string>' : `${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`}`);
        if (process.env.SEED_DEMO_DATA === 'true') {
          console.log(`  Demo password for all seeded accounts: demo1234\n`);
        } else {
          console.log('');
        }
      });
    })
    .catch(e => {
      console.error('\n  Failed to start server:');
      console.error(`  ${e.message}\n`);
      console.error('  Check that PostgreSQL is running and that the credentials in .env are correct.');
      process.exit(1);
    });
}

module.exports = app;
