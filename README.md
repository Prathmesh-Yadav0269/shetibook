# ShetiBook (शेतीबुक)

> **तुमची शेती, तुमचा हिशोब, तुमच्या हातात!**

ShetiBook is a mobile-first, Marathi-first family-based farm management application designed for farming families in Maharashtra and beyond. Built around the core product philosophy: **"Minimum Input – Maximum Automation"**, ShetiBook allows family members to collaborate on managing shared agricultural operations, records, and financial accounting with robust data integrity and strict privacy.

---

## 🌾 Phase 1 Scope: Foundation & Core Infrastructure

Phase 1 establishes the foundational architecture and security infrastructure for ShetiBook:
- **Project Structure**: Clean monorepo containing `client` and `server`.
- **Database Architecture**: Turso-compatible SQLite database adapter with deterministic migration tracking and foreign-key enforcement.
- **Authentication**: Phone Number + Argon2id Password + One-Time Secure Recovery Code (zero SMS/email dependencies).
- **Session Management**: Secure, database-backed HTTP-only cookie sessions with SHA-256 token hashing and revocation.
- **Family Group Management**: Group creation, owner/member roles, invitation code generation (SHA-256 hashed), single-use acceptance, member removal, and complete cross-group isolation.
- **Localization**: Full Marathi (Devanagari) default interface with seamless English bilingual support.

*(Note: Farm plots, crop management, farm activities, expenses, harvest, and sales records are explicitly scheduled for subsequent phases).*

---

## 🛠️ Technology Stack

| Layer | Approved Technology |
|---|---|
| **Frontend** | React 18, Vite 6, TypeScript 5, Tailwind CSS 3, React Router 7, TanStack Query 5, React Hook Form, Zod, i18next, Lucide React |
| **Backend** | Node.js (v22+), Express 4, TypeScript 5, Zod, Argon2id, Cookie-Parser, Helmet, Express-Rate-Limit |
| **Database** | Turso / SQLite relational database via official `@libsql/client` |
| **Testing** | Vitest 3, Supertest 7 |
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
│   │   ├── features/           # Feature modules (auth, family)
│   │   ├── locales/            # Marathi (mr) and English (en) translations
│   │   ├── services/           # API client & i18n initialization
│   │   ├── styles/             # Tailwind global styles
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
│   │   │   └── migrations/     # Version-controlled SQL schema migrations
│   │   ├── middleware/         # Auth, group RBAC, error handling, rate limiting
│   │   ├── modules/            # Domain modules (auth, users, family)
│   │   ├── utils/              # Argon2id crypto, token hashing, structured logger
│   │   ├── validators/         # Zod schemas for input validation
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # Server bootstrap & migration auto-run
│   ├── tests/                  # Automated integration tests
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
├── .editorconfig
├── .gitignore
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

Defaults are configured to work out-of-the-box using local SQLite (`file:./data/shetibook.db`).

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

Run automated test suites covering registration, Argon2id hashing, sessions, password recovery, group creation, member invitations, and cross-group isolation:

```bash
# Run server test suite
npm run test:server

# Run strict TypeScript checks
npm run typecheck

# Run linter
npm run lint

# Build production artifacts
npm run build
```

---

## 🔒 Security Summary

1. **Argon2id Password Hashing**: Hashed using OWASP recommended parameters (19 MiB memory cost, 2 iterations, 1 parallelism).
2. **One-Time Recovery Code**: 8-character high-entropy code formatted as `XXXX-XXXX`. Displayed strictly once upon registration/recovery. Stored in database as a SHA-256 hash.
3. **Database-Backed Sessions**: Session tokens are cryptographically random (32 bytes hex) and stored in the database only as SHA-256 hashes. Sent via secure `HttpOnly`, `SameSite=Lax` cookies.
4. **Group Isolation**: Every protected group route rigorously verifies active user membership in the requested group ID.

---

## 📖 Known Limitations in Phase 1
- **Agricultural Features Pending**: In accordance with Phase 1 boundaries, farm plots, crops, activities, and finances are not yet active.
- **Account Recovery**: Recovery relies on the phone number and recovery code. If both are lost, manual recovery requires a separately governed administrative verification process.
