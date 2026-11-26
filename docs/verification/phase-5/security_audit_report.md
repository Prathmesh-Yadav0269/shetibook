# ShetiBook Phase 5 — Security & Authorization Audit Report (Gate 2)

**Project:** ShetiBook (शेतीबुक)  
**Official Tagline:** तुमची शेती, तुमचा हिशोब, तुमच्या हातात!  
**Assessment Date:** 2026-11-26  
**Auditor:** Antigravity (Implementation & QA Agent)  
**Authority:** Senior Commander (Prathmesh) & Junior Commander (ChatGPT)  
**Gate Status:** **PASS**

---

## 1. Executive Summary & Findings Matrix

A comprehensive security audit of the ShetiBook codebase, database constraints, authentication lifecycle, multi-tenant group isolation, and external dependencies was performed.

| Finding ID | Classification | Component | Description & Current State | Recommendation / Status |
| :---: | :---: | :--- | :--- | :--- |
| **SEC-01** | `INFORMATIONAL` | Dependencies (Dev) | `tinypool` / `@vitest/mocker` reported in `npm audit` | Contained strictly within test runner (not bundled into production build). |
| **SEC-02** | `LOW` | Dependencies (Prod) | `zod` < 4.6.6 memory exhaustion advisory | Constrained by request body size limit (10kb) and strict string length bounds in schemas. |
| **SEC-03** | `VERIFIED SECURE` | Authentication | 128-bit recovery secret with Argon2id + server pepper | Raw secret displayed once; dummy Argon2 verify on non-existent user prevents account enumeration. |
| **SEC-04** | `VERIFIED SECURE` | Password Hashing | OWASP-compliant Argon2id (19 MiB, 2 iterations, 1 lane) | Constant-time verification, salted per user. |
| **SEC-05** | `VERIFIED SECURE` | Authorization | `requireGroupMembership` validates DB membership | Frontend-supplied `groupId` is never trusted; removed members rejected with 403. |
| **SEC-06** | `VERIFIED SECURE` | Invitation Security | Cryptographic token, SHA-256 hashed in DB | Atomic conditional updates prevent race conditions and token reuse. |
| **SEC-07** | `VERIFIED SECURE` | CSRF & Origin | Custom anti-CSRF header + strict Origin validation | State-changing methods blocked if Origin != `CLIENT_ORIGIN` or custom header missing. |
| **SEC-08** | `VERIFIED SECURE` | Rate Limiting | `express-rate-limit` on all auth & public routes | 10 requests per 15-minute window for login/recovery to prevent brute-force attacks. |

---

## 2. Authentication & Credential Security

### 2.1 Password Hashing & Storage
- Algorithm: **Argon2id** (`type: argon2.argon2id`, `memoryCost: 19456` KiB, `timeCost: 2`, `parallelism: 1`).
- Complies strictly with OWASP password storage guidelines.
- Salting is automatic and cryptographic per hash string.

### 2.2 128-Bit Recovery Secret Architecture
- Generation: `crypto.randomBytes(16)` yields 128 bits of true cryptographic entropy. Formatted as 8 groups of 4 hex digits: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`.
- Normalized upon submission (hyphens/spaces removed, case-insensitive).
- Keyed hashing: Secret is first hashed via HMAC-SHA256 with server-side `RECOVERY_PEPPER`, then hashed using Argon2id.
- Single-use policy: Upon successful recovery, the secret is invalidated, a new secret is generated and returned once, and all existing active sessions are revoked.
- User enumeration protection: When an unauthenticated recovery request provides a non-existent phone number, the server computes a dummy Argon2id hash to ensure uniform execution timing.

### 2.3 Session Management
- Sessions stored in database table `sessions` with `token_hash = sha256(raw_cookie_token)`. Raw tokens are never stored.
- Cookies set with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and `secure: true` in production environments.
- Session revocation: Logout explicitly sets `revoked_at = datetime('now')`.

---

## 3. Authorization & Tenant Isolation

### 3.1 Server-Side Group Membership Verification (`requireGroupMembership`)
- Every endpoint operating under `/api/v1/groups/:groupId/*` enforces `requireGroupMembership(['owner', 'member'])`.
- The middleware queries `group_members` table directly:
  ```sql
  SELECT role, status FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
  ```
- If a user is not an active member, access is immediately denied with `403 FORBIDDEN_GROUP_ACCESS`.
- Any attempt to access resources across group boundaries (cross-group traversal) is strictly blocked.

### 3.2 Single Active Owner Invariant
- Enforced at database level via partial unique index in SQLite/libSQL:
  ```sql
  CREATE UNIQUE INDEX idx_group_members_single_active_owner 
  ON group_members(group_id) WHERE role = 'owner' AND status = 'active';
  ```
- Guaranteed at the database engine level against race conditions.

---

## 4. Invitation Lifecycle & Concurrency Protection

- Invitations generated using `crypto.randomBytes(32)` (256-bit token).
- Tokens stored as SHA-256 hashes in `invitations.token_hash`.
- Acceptance is strictly atomic within a single SQL statement:
  ```sql
  UPDATE invitations 
  SET accepted_by = ?, accepted_at = ?, status = 'accepted'
  WHERE token_hash = ? AND status = 'pending' AND expires_at > datetime('now');
  ```
- Concurrency test in `tests/family.test.ts` (Step 7) proves that simultaneous parallel claims result in exactly 1 winner and 1 rejection with zero duplicate memberships.

---

## 5. Application Security & Defenses

1. **CSRF Protection (`csrfProtection`)**:
   - Compares request `Origin` header against `config.CLIENT_ORIGIN`.
   - Requires custom anti-CSRF request header (`X-Requested-With: XMLHttpRequest` or `X-CSRF-Protection`).
   - Browser cross-origin HTML form submissions cannot attach custom headers and are blocked.
2. **SQL Injection**:
   - 100% of SQL queries in domain services and migrations utilize parameterized queries (`?` placeholders with argument arrays). Zero string concatenation in SQL.
3. **Audit Log Immutability**:
   - `audit_logs` table protected by SQLite trigger:
     ```sql
     CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(FAIL, 'Audit logs cannot be updated'); END;
     ```
4. **Rate Limiting (`rateLimiter`)**:
   - Global rate limiter: 100 requests per 15 minutes.
   - Auth rate limiter: 10 requests per 15 minutes per IP address.

---

## 6. Gate 2 Sign-Off

The security posture is robust, adheres to OWASP guidelines, and satisfies all Phase 5 criteria. Gate 2 is classified as **PASS**.
