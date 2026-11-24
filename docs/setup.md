# ShetiBook — Local Setup & Development Guide

Follow this guide to set up, run, and verify ShetiBook locally on your workstation.

---

## 1. Prerequisites

- **Node.js**: v20.x or v22.x LTS (`node -v`)
- **npm**: v10.x or v11.x (`npm -v`)
- **Git** (`git --version`)

---

## 2. Clone the Repository

```bash
git clone https://github.com/Prathmesh-Yadav0269/shetibook.git
cd shetibook
```

---

## 3. Install Workspace Dependencies

Install dependencies across the monorepo:

```bash
npm install
```

---

## 4. Configure Environment Variables

### 4.1 Server Environment
Copy the server example environment file:
```bash
cp server/.env.example server/.env
```

Default values in `server/.env`:
```ini
PORT=5000
NODE_ENV=development
TURSO_DATABASE_URL=file:./data/shetibook.db
TURSO_AUTH_TOKEN=
SESSION_SECRET=shetibook-default-dev-secret-key-32b
RECOVERY_PEPPER=shetibook-default-recovery-pepper-32b
CLIENT_ORIGIN=http://localhost:3000
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false
```

*(Note: If you have a remote Turso database, set `TURSO_DATABASE_URL=libsql://your-db.turso.io` and `TURSO_AUTH_TOKEN=your-token`. Otherwise, leave default local SQLite file).*

### 4.2 Client Environment
Copy the client example environment file:
```bash
cp client/.env.example client/.env
```

Default values in `client/.env`:
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 5. Run Database Migrations

Apply database schema migrations:

```bash
npm run migrate --workspace=server
```

You should see:
```text
[Migrations] Applying: 001_initial_schema.sql...
[Migrations] Successfully applied: 001_initial_schema.sql
[Migrations] Applying: 002_owner_constraint_and_audit.sql...
[Migrations] Successfully applied: 002_owner_constraint_and_audit.sql
[Migrations] Applying: 003_agricultural_management.sql...
[Migrations] Successfully applied: 003_agricultural_management.sql
[Migrations] Applying: 004_financial_management.sql...
[Migrations] Successfully applied: 004_financial_management.sql
[Migrations] Database is up to date.
Migrations complete.
```

---

## 6. (Optional) Seed Phase 3 Demo Data

To populate a local development database with a demonstration farming family, farm, plots, crops, expenses, crop allocations, harvests, sales, and payment transactions:

```bash
cd server
npx tsx src/database/seed_phase3_demo.ts
```

Demo User Credentials:
- **Phone Number**: `9876543210`
- **Password**: `Password123!`

---

## 7. Start the Development Servers

Open two terminal windows:

### Terminal 1: Backend Server (Port 5000)
```bash
npm run dev:server
```

Verify backend health at: [http://localhost:5000/health](http://localhost:5000/health)

### Terminal 2: Frontend Client (Port 3000)
```bash
npm run dev:client
```

Open your browser at: [http://localhost:3000](http://localhost:3000)

---

## 8. Run Quality & Verification Checks

```bash
# 1. Run automated test suite (78 automated tests across 7 suites)
npm run test:server

# 2. Strict TypeScript checks across monorepo
npm run typecheck

# 3. Code style & linting across monorepo
npm run lint

# 4. Production build verification (Server tsc + Client vite build)
npm run build
```
