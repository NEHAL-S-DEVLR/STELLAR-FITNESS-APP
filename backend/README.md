# FitCore Gym

A gym management web app with **member** and **admin** dashboards. Members track weight, BMI, workouts, nutrition, attendance and progress photos. Admins manage members, assign workout / nutrition plans (grouped by muscle group, with machine selection), track attendance, monitor subscriptions and send offer / expiry notifications.

- **Backend:** Node.js + Express + PostgreSQL (`pg`) + bcrypt password hashing + JWT sessions
- **Frontend:** vanilla HTML/CSS/JS with a Material Design 3–inspired dark theme, Chart.js for charts, Material Symbols for icons

---

## Prerequisites

- **Node.js 18+** (`node --version`)
- **PostgreSQL 12+** running locally, reachable on the credentials in `.env`

The included `.env` uses:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_DIALECT=postgres
DB_NAME=fitcore_gym

PORT=3000
```

If your Postgres uses different credentials, edit `.env` before starting.

---

## Setup and run

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

On the first launch the server will:

1. Connect to the default `postgres` database and **create `fitcore_gym`** if it doesn't exist
2. Create all 6 tables (`users`, `attendance`, `weight_log`, `photos`, `notifications`, `broadcasts`)
3. **Seed 11 demo accounts** (2 admins, 9 members) with realistic weight logs, attendance history, plans and notifications

You'll see something like:

```
Created database "fitcore_gym"
Seeding demo data…
Seeded 2 admins and 9 members.
Demo password for all accounts: demo1234

  FitCore Gym running at  http://localhost:3000
  PostgreSQL: postgres@localhost:5432/fitcore_gym
```

Subsequent launches skip both the DB creation and the seed.

---

## Demo accounts

The password for **every** seeded account is `demo1234`.

### Admins

| Name | Email |
|---|---|
| Coach Ravi | `ravi@fitcore.gym` |
| Dr. Neha Kapoor | `neha@fitcore.gym` |

### Members

| Name | Email | Notes |
|---|---|---|
| Sanjay Khadka   | `sanjay.khadka@skyboxindia.in` | PPL hypertrophy, expires in 7 days |
| Priya Sharma    | `priya@example.com`     | Fat-loss circuit, mid-plan |
| Arjun Mehta     | `arjun@example.com`     | Beginner, no plan yet |
| Kavya Reddy     | `kavya@example.com`     | Powerlifting 5x5, long-term active |
| Rohan Patel     | `rohan@example.com`     | **Subscription expired 12 days ago** |
| Meera Iyer      | `meera@example.com`     | Brand-new joiner, no plan |
| Vikram Singh    | `vikram@example.com`    | 2-year veteran, checks in almost daily |
| Ananya Nair     | `ananya@example.com`    | Marathon training, **expires in 2 days** |
| Ishaan Kumar    | `ishaan@example.com`    | Cardio focus, **expires tomorrow** |

Try signing in as `neha@fitcore.gym` and opening the **Notifications** tab to see the Subscription Watch — the members above will already be listed as needing attention.

---

## Creating your own account

The login page has a **Create account** tab. New signups are always created as **members**. To promote someone to admin, update their row directly in Postgres:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## Resetting demo data

```bash
# Drop the database — the next `npm start` will recreate + reseed it.
PGPASSWORD=root psql -h localhost -U postgres -d postgres -c "DROP DATABASE fitcore_gym;"
npm start
```

---

## Project layout

```
.
├── server.js          Express server, routes, PG connection, schema, seed
├── package.json
├── .env               DB credentials (git-ignored)
└── public/
    ├── index.html     Login + signup
    ├── profile.html   Member dashboard
    ├── admin.html     Admin dashboard
    ├── styles.css     Material 3–inspired dark theme
    ├── api.js         fetch wrapper + JWT storage + shared helpers
    ├── library.js     Exercise library grouped by muscle group + machines
    ├── profile.js     Member dashboard logic
    └── admin.js       Admin dashboard logic
```

---

## API overview

All endpoints return JSON. Send `Authorization: Bearer <token>` on any endpoint other than `/api/auth/*`.

### Auth
- `POST /api/auth/signup` — `{ name, email, password }` → `{ user, token }`
- `POST /api/auth/login`  — `{ email, password }` → `{ user, token }`
- `GET  /api/me`          — current user, fully hydrated

### Member self-service
- `POST   /api/me/attendance`
- `POST   /api/me/weight` `{ date, kg }`
- `DELETE /api/me/weight/:date`
- `POST   /api/me/photos` `{ url, caption }`
- `DELETE /api/me/photos/:id`
- `POST   /api/me/notifications/read-all`

### Admin (requires `role = 'admin'`)
- `GET    /api/admin/members` — list all members
- `GET    /api/admin/members/:id` — full member
- `POST   /api/admin/members` — create
- `PATCH  /api/admin/members/:id` — update goal / height / name
- `DELETE /api/admin/members/:id`
- `PUT    /api/admin/members/:id/workout` — body is the structured workout plan
- `PUT    /api/admin/members/:id/nutrition`
- `PUT    /api/admin/members/:id/subscription` — `{ plan, startDate, expiryDate }`
- `POST   /api/admin/members/:id/attendance/toggle` — `{ date }`
- `POST   /api/admin/broadcasts` — `{ type, title, body, recipientId | null }` (null = all members)
- `GET    /api/admin/broadcasts`
- `GET    /api/admin/insights`

---

## WhatsApp payment reminders

Admins can send **subscription expiry / payment reminders over WhatsApp** — a button per member in the Subscription Watch and in the member detail's Subscription tab.

Two modes:

- **Fallback (default, no setup):** the server returns a `wa.me` deep link. Clicking the button opens WhatsApp Web / Desktop with the message pre-filled to the member's number — the admin taps *Send*.
- **Cloud API mode:** actually sends the message via Meta's WhatsApp Business Cloud API. To enable, set these in `.env`:

  ```
  WHATSAPP_TOKEN=EAAG…                              # system-user access token
  WHATSAPP_PHONE_ID=123456789012345                 # WABA phone number ID
  WHATSAPP_TEMPLATE=subscription_expiry_reminder    # optional approved template
  ```

  With `WHATSAPP_TEMPLATE` set, the server sends an **approved template message** with three body parameters (`{{firstName}}`, `{{plan}}`, `{{daysLeft}}`). Leave it blank to send a plain-text message (Meta only allows this inside an active 24-hour session).

Every WhatsApp send is also logged in the **Recent Broadcasts** panel with type `whatsapp-link` or `whatsapp-api` so admins have a paper trail.

Each member has a `phone` field (Indian mobile numbers auto-prefixed with `91` if entered without country code). Members can edit their own phone from the **Account** tab; admins can edit it from the member modal's **Overview** tab.

---

## Account management + edit history

- **Members** can edit their own **name, email, phone, goal, height, and password** from the **Account** tab on their dashboard.
- **Admins** can edit the same fields (except password) from the member detail modal.
- Every edit is written to an `edit_log` table with:
  - who made the change (name + role: admin or member)
  - what changed (before → after, per field)
  - when
- Members can see their own history at the bottom of the Account tab.
- Admins see the full history in a new **Edit History** tab on each member's modal.

---

## Finance — subscriptions & payments

Both admins and members have a **Finance** tab.

**Admin (`Finance` tab in the top nav):**
- Stat cards: **Revenue this Month**, **Revenue this Year**, **Pending Renewals** (₹ amount + count), **Active Subscriptions**
- **Revenue chart** — bar chart of the last 6 months (auto-fills empty months as ₹0)
- **Payment methods** doughnut — cash / UPI / card / bank transfer share
- **Pending Renewal Requests** — members who requested a plan renewal from the app; one click **Approve** marks the payment paid, extends the member's subscription by the plan's duration, and writes an entry to the audit log
- **Subscription Plans** catalog — create, edit, hide/show plans (soft-delete via `is_active`)
- **Record payment** modal — pick a member + plan, choose method (cash/UPI/card/bank_transfer), enter reference/notes. The "Also extend subscription" checkbox (on by default) rolls the expiry forward by the plan's duration
- **Recent Payments** table with a status filter (All / Paid / Pending)

**Member (`Finance` tab on their dashboard):**
- Current plan card with countdown to expiry
- **Total Paid** and any **Pending** renewal request status
- **Available Plans** — tap **Request renewal** on any plan to submit a request. The admin gets it in their pending queue; once approved, the subscription updates automatically
- Personal **Payment History** table

**Tables added:**
- `subscription_plans` — id, name, price, duration_days, description, is_active
- `payments` — id, user_id, plan_name, amount, currency, payment_date, method, reference, status (paid|pending), notes, recorded_by

Subscription extensions and approvals write to `edit_log` too, so admins can trace every change in the member's Edit History.

---

## Progress photos — upload or link

The "Add photo" modal has two modes:

- **Upload from device** — pick a file (JPG/PNG/etc., max 8 MB). The file is stored under `public/uploads/` and served statically. Deleting the photo also removes the file from disk.
- **Paste URL** — for photos hosted elsewhere (e.g. Google Photos public link).

---

## Mobile app — Expo Go (`/mobile`) — **easiest to test**

A React Native + Expo app that runs inside **Expo Go** on any Android or iPhone — no Android Studio, no Xcode, no APK sideloading. Same feature set as the native Android app; talks to the same REST backend.

### Quick start (5 minutes)

1. Install **Expo Go** on your phone from Play Store / App Store
2. Make sure your phone and laptop are on the **same Wi-Fi**
3. In one terminal, run the backend:
   ```bash
   cd /Users/nikhil/Desktop/krithik
   npm start
   ```
4. In another terminal, start the Expo dev server:
   ```bash
   cd /Users/nikhil/Desktop/krithik/mobile
   npm install    # first time only
   npm start      # or: npm run start:lan  (both do the same LAN-mode start)
   ```
5. A QR code appears in the terminal. Open **Expo Go** on your phone → **Scan QR code**
6. The app opens; sign in with a demo account (password `demo1234`) or create your own

The API base URL is **auto-detected** from Metro's LAN host, so you don't need to enter your laptop's IP anywhere — it just works. If the phone can't reach the laptop (guest Wi-Fi / firewall), tap the "Server: …" link on the login screen to enter it manually.

If your Wi-Fi blocks LAN traffic, use tunnel mode instead — slower but works everywhere:

```bash
cd mobile
npm run start:tunnel
```

Note: tunnel mode routes traffic through Expo's servers. Your API URL must be publicly reachable OR you'll need to enter a public backend URL on the login screen.

### Features

- **Home** — welcome, stats cards (weight / BMI / calories today / attendance), subscription countdown, today's workout preview, today's nutrition summary, check-in
- **Workout** — full weekly plan, today highlighted
- **Food** — the star feature. Big calorie ring with target progress, macro cards (P/C/F), four meal sections, extended FAB opens a bottom-sheet form with meal chips, macro fields and six quick-add presets
- **Alerts** — notifications with unread badge on the tab bar; tapping the tab auto-marks read
- **Account** — edit name/email/phone/goal/height, view progress photos, sign out

Every meal logged from the Expo app is tagged `source: "expo"` in the DB, distinct from `web`, `android` (native Kotlin) so admins can see which channel each entry came from.

### Layout

```
mobile/
├── package.json
├── app.json            (Expo config — dark mode, cleartext HTTP for LAN dev)
├── babel.config.js
├── App.js              (auth flow + bottom-tab navigator)
└── src/
    ├── api.js          (fetch wrapper, auto-detects laptop IP via Metro)
    ├── theme.js        (colors matching the web dark palette)
    ├── components/
    │   └── Common.js   (Card, StatCard, Chip, Button, ProgressBar, Empty)
    └── screens/
        ├── LoginScreen.js
        ├── HomeScreen.js
        ├── WorkoutScreen.js
        ├── FoodScreen.js         # bottom-sheet meal logger + quick-add chips
        ├── NotificationsScreen.js
        └── AccountScreen.js
```

Tech: Expo SDK 50, React Navigation (bottom tabs), AsyncStorage for the JWT + base URL, `@expo/vector-icons`, `expo-image` for progress photos, plain `fetch` for API calls.

---

## Android app (`/android`)

A native Kotlin + Jetpack Compose Android app that talks to the same REST API. Members get most of what the website offers, plus a **food & calorie logger** designed for on-the-go use.

### Features

- **Sign in / create account** (calls the same `/api/auth/*` endpoints)
- **Home** — welcome header, current weight / BMI / calories today / attendance stats, subscription countdown, today's workout and nutrition summary, one-tap gym check-in
- **Workout** — full weekly plan with today highlighted, muscle-group and machine chips per exercise
- **Food log (new)** — the reason this app exists:
  - Big calorie summary with target progress bar and macros (P/C/F)
  - Four meal sections: Breakfast, Lunch, Snack, Dinner — each showing entries with kcal and macro chips
  - Extended FAB opens a bottom sheet to log a meal: meal-type filter chips, food name, calories, optional macros, notes
  - Six **quick-add chips** for common foods (eggs+toast, protein shake, banana, chicken, rice, almonds) that prefill the form
  - Everything member logs is tagged `source=android` so admins can see which platform each entry came from
- **Notifications** — bell in the top bar with unread badge; tapping opens the list and marks them read
- **Account** — edit name, email, phone, goal, height; view progress photos; sign out. Every edit lands in the same server-side `edit_log` that the website reads.

### Building the app

1. Install **Android Studio** (Hedgehog / Iguana or newer)
2. `File → Open` and point at `/Users/nikhil/Desktop/krithik/android`
3. Let Gradle sync (first run downloads Gradle 8.5 + Compose BOM)
4. Choose an emulator (API 24+) or connect a device with USB debugging
5. Click **Run** ▶︎

Alternatively, from a shell with the Android SDK on `$PATH`:

```bash
cd android
./gradlew assembleDebug          # builds app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug           # installs to attached device / emulator
```

### Pointing the app at your backend

The app defaults to `http://10.0.2.2:3000` — the Android emulator's alias for the host machine's `localhost`. If you're testing on a physical phone:

1. Make sure the phone is on the same Wi-Fi as your laptop
2. Find your laptop's LAN IP (`ifconfig | grep 'inet '`)
3. On the app's login screen, tap **"Server: …"** at the bottom, enter `http://<your-lan-ip>:3000`, hit Save

The URL is stored in DataStore so subsequent launches remember it.

### Admin monitoring on the website

Everything a member logs from the app flows through the same `food_entries` table the website uses. Admins can:

- **Overview → Today's Nutrition Log** — live snapshot of every member's calories consumed today, with target progress bars. Members who haven't logged are flagged; those over 110% of target get a red "Over target" chip. Clicking a row opens their full detail modal.
- **Member modal → Food Log tab** — pick any date, see meal-by-meal breakdown with source chips (📱 App vs 💻 Web), macros vs target, and a 7-day calorie trend chart with the target line overlaid.

### Android project layout

```
android/
├── build.gradle.kts, settings.gradle.kts, gradle.properties
├── gradle/wrapper/gradle-wrapper.properties
└── app/
    ├── build.gradle.kts
    └── src/main/
        ├── AndroidManifest.xml
        ├── res/{values,drawable,...}
        └── java/com/fitcore/gym/
            ├── MainActivity.kt                # Scaffold, nav, top bar, data refresh
            ├── data/
            │   ├── Models.kt                  # kotlinx.serialization data classes
            │   ├── Session.kt                 # DataStore for token + base URL
            │   └── Api.kt                     # Retrofit + OkHttp + auth interceptor
            └── ui/
                ├── theme/Theme.kt             # M3 dark palette matching the web
                └── screens/
                    ├── LoginScreen.kt         # Sign in / signup / demo accounts / server URL
                    ├── HomeScreen.kt          # Stats, subscription, today's plan + food
                    ├── WorkoutScreen.kt       # Full weekly plan
                    ├── FoodScreen.kt          # Food logger with bottom-sheet add + quick chips
                    └── MoreScreens.kt         # Notifications + Account (kept together)
```

Tech: Retrofit 2 + OkHttp + kotlinx-serialization for networking, DataStore for token, Coil for progress photos, Material 3 dark theme matching the website exactly.

---

## Deploying the webapp to Vercel

The Express server + `public/` frontend can be hosted on Vercel with a managed Postgres. The `mobile/` and `android/` folders are excluded from the deployment via `.vercelignore`.

### 1. Get a Postgres database

Easiest path: **Vercel Postgres** (free tier, no extra signup):

1. Go to your Vercel dashboard → **Storage** → **Create Database** → choose **Postgres**
2. Pick a name (e.g. `fitcore`) and region
3. Once created, click **Connect** → select your project (you'll create it in step 2 below) → Vercel injects the env vars automatically

Any managed Postgres works too — **Neon**, **Supabase**, **Railway**, **Render**. Just get its connection URL.

### 2. Deploy

1. Push this repo to GitHub / GitLab / Bitbucket
2. Vercel dashboard → **Add New… → Project** → pick the repo
3. Framework preset: leave as **Other** (Vercel auto-detects the config)
4. **Environment Variables** — set these before the first deploy:

   | Variable | Value | Required |
   |---|---|---|
   | `POSTGRES_URL` or `DATABASE_URL` | full Postgres connection string (auto-set if you used Vercel Postgres) | **yes** |
   | `JWT_SECRET` | any long random string (`openssl rand -hex 32` on Mac) | **yes** — otherwise sessions invalidate on every cold start |
   | `WHATSAPP_TOKEN` | Meta Cloud API access token | only if wiring WhatsApp |
   | `WHATSAPP_PHONE_ID` | Meta WABA phone number ID | only if wiring WhatsApp |
   | `WHATSAPP_TEMPLATE` | approved template name | optional |

5. Click **Deploy**

On the first hit to `/api/*` after a cold start, the server auto-creates all tables and seeds the demo data (2 admins + 9 members + plans + food entries). Subsequent requests skip both.

### 3. Sign in

Open the deployment URL Vercel gives you (`https://your-project.vercel.app`) and use any demo account with password `demo1234` — same as local dev. If you want to disable the seed data, comment out the `await seedIfEmpty()` line in `server.js`.

### What the refactor does

- **`api/index.js`** — the Vercel serverless entry. Just re-exports the Express app.
- **`server.js`** — now detects `POSTGRES_URL` / `DATABASE_URL` and connects with SSL; otherwise uses the local `DB_*` vars. Only calls `app.listen()` when run directly with `node server.js`, so Vercel imports the app cleanly.
- **`vercel.json`** — routes `/api/*` to the function, everything else to the static `public/` files.
- **`.vercelignore`** — excludes `mobile/` and `android/` (they'd otherwise inflate the bundle).

### Caveats

- **File uploads** (`/api/me/photos/upload`) are disabled on Vercel because serverless filesystems are read-only. The photo modal's **"Paste URL"** tab still works — good candidates: `imgbb.com`, `imgur.com`, direct S3/Cloudinary URLs. Fixing this properly means adding **Vercel Blob** or S3 — see the [Vercel Blob docs](https://vercel.com/docs/storage/vercel-blob) if you want to wire that up.
- **JWT_SECRET is critical.** Serverless functions cold-start with a fresh Node process. If you don't set the env var, `server.js` generates a random secret each time, and every existing token becomes invalid the moment Vercel spins up a new instance.
- Vercel Postgres has connection limits on the free tier. `pg.Pool` is already shared across invocations, so under normal use you'll be well within them.
- For custom domains: Vercel dashboard → **Settings → Domains**.

---

## Notes

- Passwords are stored as **bcrypt** hashes (10 rounds). Plaintext passwords never touch the database.
- Sessions use **JWT** with a 7-day expiry; the token is generated with a random secret each time the server starts unless `JWT_SECRET` is set in `.env`. Restarting the server invalidates existing tokens.
- Workout and nutrition plans are stored as **JSONB** columns for flexibility.
- Every user-record change routes through `updateUserWithAudit()`, which computes a field-level diff and writes to `edit_log`.
- All foreign keys use `ON DELETE CASCADE`, so removing a member also removes their attendance, weights, photos, notifications and edit history.
