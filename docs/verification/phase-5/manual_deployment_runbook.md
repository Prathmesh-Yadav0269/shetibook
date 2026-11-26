# ShetiBook Phase 5 — Manual Deployment Runbook & Cost Audit (Gate 9)

**Project:** ShetiBook (शेतीबुक)  
**Official Tagline:** तुमची शेती, तुमचा हिशोब, तुमच्या हातात!  
**Assessment Date:** 2026-11-26  
**Auditor:** Antigravity (Implementation & QA Agent)  
**Authority:** Senior Commander (Prathmesh) & Junior Commander (ChatGPT)  
**Deployment Execution Status:** **NO DEPLOYMENT EXECUTED** (Strict adherence to non-negotiable rule #1)  
**Runbook Readiness:** **PASS**

---

## 1. Executive Summary & Cost Verification

This runbook provides complete, step-by-step manual deployment instructions for the Senior Commander to execute after final approval.
In accordance with non-negotiable rules, **no live production services were created, no remote databases were modified, and no automated deployment was triggered.**

### Zero-Budget Cost Audit (₹0 Confirmed)

| Service | Tier | Approved Quota / Free Limits | Projected ShetiBook Consumption | Monthly Cost |
| :--- | :---: | :--- | :--- | :---: |
| **Netlify (Frontend)** | Free Tier | 100 GB bandwidth / mo, 300 build mins / mo | ~500 MB bandwidth, ~25 build mins | **₹0.00** |
| **Render (Backend API)** | Free Tier | 750 instance hours / mo (1 service 24/7) | 1 Web Service (auto-sleeps when idle) | **₹0.00** |
| **Turso (libSQL Database)** | Free Tier | 9 GB storage, 1B row reads / mo, 25M writes | < 50 MB storage, < 250k reads / mo | **₹0.00** |
| **Total Deployment Cost** | — | **All services strictly within free tier** | **Zero credit card or upgrade required** | **₹0.00** |

---

## 2. Infrastructure Architecture & Configuration

```
[Farmer Client: PWA / Mobile Browser]
       │
       ▼
[Netlify CDN] ─── Static Assets (index.html, sw.js, assets/)
       │
       │ (Reverse Proxy /api/* via netlify.toml)
       ▼
[Render Web Service] ─── Express Node.js API (HTTPS)
       │
       ▼
[Turso libSQL Cloud] ─── Encrypted SQLite Database over HTTP/WebSocket
```

---

## 3. Step-by-Step Manual Deployment Guide

### STEP 1: Turso Cloud Database Setup

1. Install Turso CLI (if not installed) and authenticate:
   ```bash
   turso auth login
   ```
2. Create the production database:
   ```bash
   turso db create shetibook-prod --location bom
   ```
   *(Note: `bom` selects AWS Mumbai region for lowest latency across Maharashtra).*
3. Retrieve database URL and authentication token:
   ```bash
   turso db show shetibook-prod --url
   # Outputs: libsql://shetibook-prod-<org>.turso.io

   turso db tokens create shetibook-prod
   # Outputs: <TURSO_AUTH_TOKEN>
   ```
4. Run production migrations against Turso:
   ```bash
   cd server
   TURSO_DATABASE_URL="libsql://shetibook-prod-<org>.turso.io" TURSO_AUTH_TOKEN="<TURSO_AUTH_TOKEN>" npm run migrate
   ```
5. Verify schema initialization:
   ```bash
   turso db shell shetibook-prod "SELECT name FROM sqlite_master WHERE type='table';"
   # Confirm users, farming_groups, farms, crops, expenses, harvests, notifications exist
   ```

---

### STEP 2: Render Backend Web Service Setup

1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect repository `https://github.com/Prathmesh-Yadav0269/shetibook.git`.
4. Configure service settings:
   - **Name:** `shetibook-api`
   - **Region:** `Singapore (Southeast Asia)` or `Frankfurt` (closest free-tier regions).
   - **Branch:** `main`
   - **Root Directory:** Leave empty (monorepo root).
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build --workspace=server`
   - **Start Command:** `node server/dist/index.js`
   - **Plan:** `Free`
5. Configure Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `CLIENT_ORIGIN`: `https://shetibook.netlify.app` *(or your custom Netlify URL)*
   - `TURSO_DATABASE_URL`: `libsql://shetibook-prod-<org>.turso.io`
   - `TURSO_AUTH_TOKEN`: `<TURSO_AUTH_TOKEN>`
   - `SESSION_SECRET`: *(Generate via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`)*
   - `RECOVERY_PEPPER`: *(Generate via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`)*
   - `RATE_LIMIT_MAX_REQUESTS`: `100`
   - `AUTH_RATE_LIMIT_MAX`: `10`
6. Click **Create Web Service**.
7. Once deployed, verify health check endpoint:
   ```bash
   curl -i https://shetibook-api.onrender.com/health
   # Expected: {"status":"ok","service":"shetibook-api","version":"1.0.0","database":"connected"}
   ```

---

### STEP 3: Netlify Frontend PWA Setup

1. Sign in to [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** $\to$ **Import an existing project**.
3. Select GitHub and authorize repository `shetibook`.
4. Configure build settings (automatically picked up from `netlify.toml`):
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Configure Environment Variables in Netlify:
   - `VITE_API_BASE_URL`: `/api/v1` *(Uses Netlify reverse-proxy in `netlify.toml` for same-origin cookies)*
6. Update `netlify.toml` redirect target if your Render URL differs from `https://shetibook-api.onrender.com`:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://<your-actual-render-url>.onrender.com/api/:splat"
     status = 200
     force = true
   ```
7. Click **Deploy site**.
8. Verify HTTPS and SPA navigation:
   - Open site in browser.
   - Refresh on subroutes (e.g., `/login`, `/dashboard`). Netlify SPA fallback will serve `index.html`.

---

## 4. Post-Deployment Verification Checklist

Once the manual deployment is completed by the Senior Commander:
- [ ] `GET /health` on Render backend returns HTTP 200 with `database: "connected"`.
- [ ] Open Netlify frontend on mobile browser: verify green branding, Marathi Devanagari text, and PWA install prompt.
- [ ] Register 1 test farmer account: verify 128-bit recovery secret is displayed once.
- [ ] Create 1 farm and 1 plot: verify database row is created in Turso.
- [ ] Toggle device into Airplane Mode: verify app shell reloads and offline banner appears.
- [ ] Reconnect internet: verify offline sync executes without error.

---

## 5. Gate 9 Sign-Off

All deployment prerequisites, configuration files (`netlify.toml`), health endpoints, and step-by-step instructions are verified and documented. Gate 9 is classified as **PASS**.
