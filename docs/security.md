# ShetiBook — Security Documentation

## 1. Password Security (Argon2id)

- **Algorithm**: Argon2id (`argon2.argon2id`), the state-of-the-art password hashing standard recommended by OWASP.
- **Parameters**:
  - Memory Cost: `19456 KiB` (~19 MiB)
  - Time Cost: `2` iterations
  - Parallelism: `1` thread
- Plaintext passwords are never logged, cached, or returned in API responses.

## 2. One-Time Recovery Code Architecture

- **Format**: 8-character high-entropy alphanumeric string formatted as `XXXX-XXXX` using an unambiguous character set (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
- **One-Time Visibility**: Displayed strictly once to the user upon account creation or recovery.
- **Storage**: Plaintext recovery codes are **never** stored in the database. Only their SHA-256 hash (`recovery_code_hash`) is stored.
- **Invalidation**: Upon successful password recovery, all previous active sessions are immediately revoked, the old recovery code is permanently invalidated, and a fresh code is generated and shown once.

## 3. Database-Backed Session Security

- **Token Generation**: Generated via Node.js cryptographic PRNG (`crypto.randomBytes(32).toString('hex')`).
- **Hashed Persistence**: The database stores only the SHA-256 hash of the session token. Compromise of the database does not expose valid bearer tokens.
- **Revocation**: Explicitly revokable on logout, password reset, or account deactivation.
- **Expiration**: Strict 30-day lifetime enforced via `expires_at` column.

## 4. Cookie Configuration & CORS

- **Cookie Flags**:
  - `HttpOnly: true` (prevents JavaScript access and XSS theft)
  - `Secure: true` in production (enforces HTTPS)
  - `SameSite: 'lax'` (prevents cross-site request forgery)
  - `Path: '/'`
- **CORS Policy**:
  - Strict allowlist configured via `CLIENT_ORIGIN` (e.g. `http://localhost:3000`).
  - No wildcard `*` origins allowed when credentials (`Access-Control-Allow-Credentials: true`) are enabled.

## 5. Group Isolation & Authorization (RBAC)

- Every endpoint accessing a farming group (`/api/v1/groups/:groupId/*`) executes `requireGroupMembership`:
  1. Authenticates the session.
  2. Asserts active membership (`status = 'active'`) in the target group.
  3. Enforces the strict role requirement (`owner` vs `member`).
- **Zero Cross-Group Leakage**: Group A members cannot view or manipulate Group B records.
- **History Preservation**: When a member is removed or a group is deactivated, records are soft-flagged (`removed` or `deactivated`) with timestamp and actor tracking. Destructive cascading deletes are strictly prohibited.

## 6. Rate Limiting & Protection

- **Global Rate Limiter**: 200 requests per 15-minute window per IP.
- **Authentication Limiter**: 10 attempts per 15-minute window per IP on `/login`, `/register`, and `/recover-password`.
- **Security Headers**: Express `helmet` enabled to provide strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Strict-Transport-Security`.
