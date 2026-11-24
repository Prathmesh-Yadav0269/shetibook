# ShetiBook (शेतीबुक)

> **तुमची शेती, तुमचा हिशोब, तुमच्या हातात!**

ShetiBook is a mobile-first, Marathi-first family-based farm management application designed for farming families in Maharashtra and beyond. Built around the core product philosophy: **"Minimum Input – Maximum Automation"**, ShetiBook allows family members to collaborate on managing shared agricultural operations, records, and financial accounting with robust data integrity and strict privacy.

---

## 🗺️ Approved Five-Phase Product Roadmap

ShetiBook is developed under a strict, phased engineering lifecycle:

- **Phase 1: Foundation & Core Infrastructure** *(Completed & Verified)*
  - Monorepo repository architecture, TypeScript standards, automated testing.
  - Relational database schema migrations (Turso / SQLite) with foreign-key enforcement.
  - Secure phone authentication with Argon2id password hashing and 128-bit keyed recovery secrets.
  - Database-backed HTTP-only session management and CSRF defense-in-depth.
  - Family group collaboration with atomic single-use invitation consumption, single active owner constraint, and database trigger immutability for audit logs.
  - Full Marathi (Devanagari) default interface with seamless bilingual English support.
- **Phase 2: Farm & Agricultural Management** *(Completed & Verified)*
  - Farm management: multiple farms per group, survey numbers, village, taluka, district.
  - Land area conversion engine: Acre, Guntha, and Hectare conversions with normalized square-metre storage and zero cumulative rounding errors.
  - Plot management: multiple physical plots per farm, physical area bounds checking, unallocated area tracking, duplicate name prevention.
  - Intercropping architecture: separate vs intercropping cultivation modes, multiple active crops on a single physical plot without double-counting land area.
  - Maharashtra crop types & seasons: 11 pre-seeded regional crops, 4 seasons (Kharif, Rabi, Zaid, Annual/Baramahi), custom crop names, sowing and harvest tracking.
  - Agricultural activities & event timeline: 6 activity types, lifecycle state machine (pending, in_progress, paused, completed, cancelled), append-only event audit history with actor tracking.
  - Group authorization: shared family access across all agricultural assets with strict outsider isolation.
- **Phase 3: Financial & Business Management** *(Completed & Verified)*
  - Integer paise accounting engine: exact integer storage for all monetary amounts with zero floating-point drift.
  - Expense tracking & pre-seeded Maharashtra categories: 10 regional agricultural categories (Seeds, Fertilizers, Pesticides, Labor, Machinery, Irrigation, Electricity, Transport, Lease, Other).
  - Flexible crop cost allocation: full or partial allocation to individual crops or plots, with automatic farm-general residual allocation.
  - Reusable polymorphic payment model: multi-installment tracking for expenses (payables) and sales (receivables) with overpayment prevention.
  - Harvest inventory management: yield tracking in metric/regional units (Quintal, Ton, Kg, Crates), sold vs remaining balance calculation, and overselling protection.
  - Agricultural sales & market buyers: direct sales or sales from harvest stock, APMC market and buyer tracking, unit rates, and instant receivable status calculation.
  - Executive financial dashboard & reports: Accrual P&L, Realized Cash Flow, outstanding receivables/payables, and category expense distribution in Marathi and English.
- **Phase 4: Intelligence & Application Experience** *(Pending Phase 3 Approval)*
  - Dashboard, reports, notifications, offline synchronization, and Progressive Web App (PWA).
- **Phase 5: Quality Assurance & Production Release** *(Pending Phase 4)*
  - Integration, security hardening, performance tuning, deployment, backup/recovery, and handover.

*(Strict project boundary: Offline sync and PWA enhancements belong exclusively to Phase 4 and remain untouched).*

---

## 🛠️ Technology Stack

| Layer | Approved Technology |
|---|---|
| **Frontend** | React 18, Vite 6, TypeScript 5, Tailwind CSS 3, React Router 7, TanStack Query 5, React Hook Form, Zod, i18next, Lucide React |
| **Backend** | Node.js (v22+), Express 4, TypeScript 5, Zod, Argon2id, Cookie-Parser, Helmet, Express-Rate-Limit |
| **Database** | Turso / SQLite relational database via official `@libsql/client` (Foreign Keys enabled) |
| **Testing** | Vitest 3, Supertest 7 (78 automated tests across 7 suites) |
| **Version Control** | Git, GitHub (`main` branch) |

---

## 📁 Repository Structure

```text
shetibook/
├── client/                     # Frontend Single Page Application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── app/                # Layouts, providers, router
│   │   ├── components/         # Reusable UI & common components
│   │   ├── features/           # Feature modules:
│   │   │   ├── auth/           # Login, register, recovery, account
│   │   │   ├── family/         # Group overview, invite, join, members
│   │   │   ├── agriculture/    # Farms, plots, crops, intercropping, activities
│   │   │   └── finance/        # Expenses, allocations, harvests, sales, payments, summary
│   │   ├── locales/            # Marathi (mr) and English (en) translations
│   │   ├── services/           # API client (GET, POST, PUT, PATCH, DELETE) & i18n
│   │   ├── styles/             # Tailwind global styles
│   │   ├── utils/              # Area & financial conversion helpers (paise, kg)
│   │   ├── App.tsx             # Root component with Query & Auth providers
│   │   └── main.tsx            # Application entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                     # Modular-Monolith REST API
│   ├── src/
│   │   ├── config/             # Typed environment configuration
│   │   ├── database/           # LibSQL client & migration engine
│   │   │   └── migrations/     # Version-controlled SQL schema migrations:
│   │   │       ├── 001_initial_schema.sql
│   │   │       ├── 002_owner_constraint_and_audit.sql
│   │   │       ├── 003_agricultural_management.sql
│   │   │       └── 004_financial_management.sql
│   │   ├── middleware/         # Auth, group RBAC, error handling, rate limiting
│   │   ├── modules/            # Domain modules:
│   │   │   ├── auth/           # Argon2id crypto, session issuance, recovery
│   │   │   ├── family/         # Group management, invitations, members
│   │   │   ├── agriculture/    # Farms, plots, crops, activities, event history
│   │   │   └── finance/        # Expenses, allocations, harvests, sales, payments, P&L
│   │   ├── utils/              # Crypto, logger, area & finance math (paise, kg)
│   │   ├── validators/         # Zod schemas for auth, family, agriculture, finance
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # Server bootstrap & migration auto-run
│   ├── tests/                  # Automated integration tests (78 tests)
│   │   ├── auth.test.ts
│   │   ├── family.test.ts
│   │   ├── area.test.ts
│   │   ├── agriculture.test.ts
│   │   ├── agriculture.integration.test.ts
│   │   ├── finance.test.ts
│   │   └── finance.integration.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── docs/                       # Technical & Architectural Documentation
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── security.md
│   └── setup.md
│
├── netlify.toml                # Netlify reverse proxy rewrite configuration
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x or v11.x
- **Git**

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Prathmesh-Yadav0269/shetibook.git
cd shetibook
npm install
```

### 3. Environment Configuration
Copy environment example files in both client and server:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Defaults are configured to work out-of-the-box using local SQLite (`file:./data/shetibook.db`). For remote Turso, configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

### 4. Running Migrations
```bash
npm run migrate --workspace=server
```

### 5. Running in Development
Run both frontend and backend concurrently:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: Frontend Client (port 3000)
npm run dev:client
```

Visit `http://localhost:3000` in your browser.

---

## 🧪 Testing and Verification

Run automated test suites covering authentication, family groups, area conversions, farm management, intercropping, and activity lifecycles:

```bash
# Run server test suite (60 automated tests)
npm run test:server

# Run strict TypeScript typecheck across monorepo
npm run typecheck

# Run linter across monorepo
npm run lint

# Build production artifacts (server tsc + client vite build)
npm run build
```

---

## 🔒 Security Summary

1. **Argon2id Password Hashing**: Hashed using OWASP-recommended parameters (19 MiB memory cost, 2 iterations, 1 parallelism).
2. **128-Bit Recovery Secret**: Cryptographically generated 16-byte random secret (32 hex characters, `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`). Stored strictly as a keyed Argon2id hash using a server-side pepper. Displayed only once. Old secret and all active sessions are revoked immediately upon recovery. Constant-time dummy verification prevents account enumeration.
3. **Atomic Invitation Acceptance**: Concurrently safe invitation claiming using conditional write transactions (`UPDATE ... WHERE status = 'pending' AND expires_at > now`) asserting `rowsAffected === 1`. Only one concurrent actor can consume an invitation.
4. **Single Active Owner Database Constraint**: Partial unique index (`idx_group_members_single_active_owner`) enforces at the database level that a group cannot have more than one active owner.
5. **Database-Level Audit Immutability**: SQLite triggers (`trg_audit_logs_no_update` and `trg_audit_logs_no_delete`) enforce that audit logs cannot be updated or deleted, providing true database-level immutability beyond mere application-level convention.
6. **CSRF & Origin Protection**: Multi-layered defense validating request origin/referer and requiring custom anti-CSRF headers (`X-Requested-With`, `X-CSRF-Protection`) on state-changing operations.
7. **Cross-Site Cookie Architecture**: Full documentation and configuration for Netlify frontend (`.netlify.app`) and Render backend (`.onrender.com`), supporting both same-origin reverse-proxying (`netlify.toml`) and partition-ready `SameSite=None; Secure` cookies.
8. **Group-Scoped Agricultural RBAC**: Every farm, plot, crop, and activity operation strictly checks membership in the parent group. Outsiders cannot read or manipulate any agricultural records.
9. **Physical Area Conservation**: Cultivation plot areas cannot silently exceed available unallocated farm area. Intercropping plots count physical land area strictly once.
