# ShetiBook — Security Documentation

## 1. Password Security (Argon2id)

- **Algorithm**: Argon2id (`argon2.argon2id`), the state-of-the-art password hashing standard recommended by OWASP.
- **Parameters**:
  - Memory Cost: `19456 KiB` (~19 MiB)
  - Time Cost: `2` iterations
  - Parallelism: `1` thread
- Plaintext passwords are never logged, cached, or returned in API responses.

---

## 2. 128-Bit Recovery Secret Architecture

- **True Entropy**: Generated using Node.js cryptographic PRNG (`crypto.randomBytes(16)`), providing a full 128 bits of cryptographic entropy.
- **Format**: 32 hexadecimal characters formatted in 8 groups of 4 characters (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`) for readability and manual entry by farmers.
- **Keyed Hashing with Server Pepper**: Plaintext recovery secrets are **never** stored in the database. Instead, the normalized secret is keyed with a protected server-side pepper (`RECOVERY_PEPPER`) via HMAC-SHA256, and then hashed using Argon2id.
- **Single-Use Visibility**: The plaintext secret is displayed strictly once to the user upon account creation or successful recovery. It cannot be retrieved afterwards.
- **Comprehensive Revocation**: Successful password recovery using the secret executes an immediate revocation of all previous active sessions, invalidates the used secret, and generates a fresh 128-bit secret.
- **Timing & Enumeration Resistance**: When an invalid phone number or invalid secret is submitted, the recovery service runs a constant-time dummy Argon2id verification with cached parameters, ensuring uniform execution time and preventing user enumeration.
- **Rate Limiting**: Brute-force attacks are constrained both by high computational work (Argon2id) and strict route rate limiting (10 attempts per 15 minutes per IP).

---

## 3. Database-Backed Session Security

- **Token Generation**: Generated via Node.js cryptographic PRNG (`crypto.randomBytes(32).toString('hex')`).
- **Hashed Persistence**: The database stores only the SHA-256 hash of the session token. Compromise of the database does not expose valid bearer tokens.
- **Revocation**: Explicitly revokable on logout, password reset, or account deactivation.
- **Expiration**: Strict 30-day lifetime enforced via `expires_at` column.

---

## 4. Cross-Origin Cookie Architecture & CSRF Protections

### 4.1 Deployment Environment Analysis (Netlify + Render)
ShetiBook's free-tier hosting roadmap deploys the SPA frontend to Netlify (`*.netlify.app`) and the REST API backend to Render (`*.onrender.com`).
- Both `.netlify.app` and `.onrender.com` are registered on the Mozilla Public Suffix List (PSL).
- Consequently, browsers treat them as distinct effective top-level domains (eTLD+1), classifying requests between them as **cross-site**.
- Under standard `SameSite=Lax`, modern browsers strip cookies on cross-site asynchronous fetch requests.

### 4.2 Approved Architectural Strategies

1. **Strategy A (Recommended — Netlify Reverse-Proxy / Rewrites)**:
   In `client/netlify.toml`, configure a path rewrite:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://shetibook-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```
   - **Advantage**: The browser perceives all requests as same-origin (`https://shetibook.netlify.app/api/*`).
   - Cookies remain `SameSite=Lax; Secure; HttpOnly`, completely avoiding third-party cookie restrictions, Safari ITP blocking, and partitioning complexities.
   - Cost: ₹0 (supported within Netlify Free tier).

2. **Strategy B (Direct Cross-Origin)**:
   If direct cross-origin calls are used without proxying:
   - Server configures `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`.
   - Browser sends credentials across sites under HTTPS.

### 4.3 Multi-Layered CSRF Defense
To ensure ironclad CSRF protection regardless of cookie configuration:
1. **Origin & Referer Verification**: Every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) is checked against the configured `CLIENT_ORIGIN`. Unmatched origins are aborted with `403 CSRF_ORIGIN_INVALID`.
2. **Mandatory Custom Headers**: All state-changing requests must include either `X-Requested-With: XMLHttpRequest` or `X-CSRF-Protection: 1`.
   - Simple HTML cross-origin form submissions (`<form method="POST">`) cannot set custom HTTP headers.
   - Cross-origin script requests attempting to set custom headers trigger CORS preflight (`OPTIONS`) checks, which are strictly restricted to the allowed origin.

---

## 5. Group Isolation & Authorization (RBAC)

- Every endpoint accessing a farming group (`/api/v1/groups/:groupId/*`) executes `requireGroupMembership`:
  1. Authenticates the session.
  2. Asserts active membership (`status = 'active'`) in the target group.
  3. Enforces the strict role requirement (`owner` vs `member`).
- **Zero Cross-Group Leakage**: Group A members cannot view or manipulate Group B records.
- **History Preservation**: When a member is removed or a group is deactivated, records are soft-flagged (`removed` or `deactivated`) with timestamp and actor tracking. Destructive cascading deletes are strictly prohibited.

---

## 6. Single Active Owner Constraint

- A group must have exactly one active owner at any point in time.
- **Database-Level Enforcement**: A partial unique index guarantees this at the database engine level:
  ```sql
  CREATE UNIQUE INDEX idx_group_members_single_active_owner
  ON group_members(group_id)
  WHERE role = 'owner' AND status = 'active';
  ```
- Any operation attempting to insert or promote an additional active owner is immediately rejected by the database engine.
- Consistency between `farming_groups.owner_id` and the active owner member is enforced in transactional service operations.

---

## 7. Atomic Invitation Concurrency

- Invitation tokens are stored strictly as SHA-256 hashes (`token_hash`) with a 7-day expiration.
- **Single-Consumer Atomicity**: When an invitation is accepted, the transition is executed within an exclusive write transaction using a conditional update:
  ```sql
  UPDATE group_invitations
  SET status = 'accepted', accepted_at = ?, accepted_by = ?
  WHERE id = ? AND status = 'pending' AND expires_at > ?;
  ```
- The service inspects `rowsAffected`. If two users concurrently attempt to claim the same invitation token, SQLite's write lock and the conditional predicate ensure that exactly one query updates the row (`rowsAffected === 1`). The competing request receives `rowsAffected === 0`, triggers a transaction rollback, and returns `400 INVITATION_ALREADY_USED`.

---

## 8. Database-Level Audit Log Immutability

ShetiBook distinguishes between application-level convention and genuine database-level tamper resistance:
- Audit log records are protected against modification and deletion using SQLite triggers:
  ```sql
  CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs are immutable and cannot be updated');
  END;

  CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs are immutable and cannot be deleted');
  END;
  ```
- Any application update or delete query targeting `audit_logs` is terminated with `SQLITE_CONSTRAINT_TRIGGER`. Records can only be appended (`INSERT`).

---

## 9. Rate Limiting & Protection

- **Global Rate Limiter**: 200 requests per 15-minute window per IP.
- **Authentication Limiter**: 10 attempts per 15-minute window per IP on `/login`, `/register`, and `/recover-password`.
- **Security Headers**: Express `helmet` enabled to provide strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Strict-Transport-Security`.

---

## 10. Agricultural Domain Authorization & Integrity Protections

### 10.1 Group Membership Verification
- Every agricultural endpoint (`/api/v1/groups/:groupId/farms`, `plots`, `crops`, `activities`) is protected by `requireAuth` and `requireGroupMembership()`.
- Access requires an active membership in the group (`status = 'active'`).
- Outsiders are strictly forbidden (`403 FORBIDDEN_GROUP_ACCESS`).
- Cross-group parameter poisoning (e.g. attempting to link a plot from Group A to a farm from Group B) is verified and rejected at the service layer inside database transactions.

### 10.2 Physical Area Conservation
- The sum of active plot areas within a farm cannot exceed the total farm area:
  $$\sum \text{area\_sqm}(\text{plots}) \le \text{farm.area\_sqm}$$
- Prevents accidental or malicious land inflation.
- Negative, zero, or unparseable areas are rejected at the validator schema level.

### 10.3 Intercropping Safeguards
- In `separate` cultivation mode, plots reject registration of a second active or planned crop.
- In `intercropping` cultivation mode, coexisting crops share the plot boundary without double-counting the physical farm area.
- Attempting to downgrade a plot from `intercropping` to `separate` mode while multiple active crops remain is blocked with `400 MULTIPLE_CROPS_EXIST`.

### 10.4 Append-Only Activity Event Timeline
- Real-world farming activities record state transitions (`created`, `started`, `paused`, `resumed`, `completed`, `cancelled`) in `activity_events`.
- Events are strictly append-only; existing timeline records cannot be modified or reordered.
- Every event records the actor's user ID, preventing disputed claims regarding who performed agricultural operations.

---

## 11. Financial Integrity & Business Logic Controls (Phase 3)

### 11.1 Monetary Integer Paise Precision Guard
- Floating-point representations in financial software are susceptible to binary rounding anomalies (e.g. $0.1 + 0.2 = 0.30000000000000004$).
- ShetiBook mandates integer paise (`INTEGER NOT NULL CHECK(amount_paise > 0)`) for every monetary column in the schema.
- All backend calculations (totals, outstanding balances, profit/loss, cash flows) operate strictly with integer arithmetic.
- Floating-point rounding occurs exclusively at the user display boundary.

### 11.2 Multi-Tenant Family Financial Isolation
- All financial routes (`/api/v1/groups/:groupId/expenses`, `harvests`, `sales`, `payments`, `finance`) mandate active group membership (`requireGroupMembership`).
- Queries explicitly enforce `WHERE group_id = :groupId` on every financial read, write, and aggregation.
- Attempts by authenticated members of Group B to read or record transactions against Group A are blocked with `403 FORBIDDEN_GROUP_ACCESS`.

### 11.3 Overpayment Attack Prevention
- Multi-installment payment systems must defend against overpayments that result in negative debt balances or fraudulent cash ledger distortion.
- ShetiBook validates cumulative installments within database transactions:
  $$\text{New Payment Amount} \le \text{Total Invoice Amount} - \sum \text{Existing Payments}$$
- Excess payments are strictly rejected with `400 PAYMENT_EXCEEDS_OUTSTANDING_BALANCE`.
- Negative payment values are rejected at Zod schema validation (`min(1)` paise).

### 11.4 Inventory Overselling Guard
- When recording a produce sale linked to a harvest (`harvest_id`), the service verifies available stock:
  $$\text{Sale Quantity (kg)} \le \text{Harvest Quantity (kg)} - \sum \text{Existing Sales (kg)}$$
- Sales exceeding available harvested stock are blocked with `400 SALE_QUANTITY_EXCEEDS_AVAILABLE_HARVEST`.

### 11.5 Cross-Entity Parameter Tampering Defense
- Financial records establish relationships with farms, crops, and harvests.
- The service layer executes referential checks within the transaction ensuring that referenced `farm_id`, `crop_id`, and `harvest_id` belong strictly to the authenticated `group_id`.
- Attempts to cross-reference entities belonging to other farming families fail with `404` or `400`.

---

## 12. Intelligence, Notifications & Data Export Security (Phase 4)

### 12.1 Formula Injection (CSV Injection) Defense
- Exporting financial and agricultural records to CSV poses a security risk if malicious strings are interpreted as executable formulas by spreadsheet software (e.g. Microsoft Excel, LibreOffice Calc).
- ShetiBook sanitizes every exported CSV cell:
  - If a cell value begins with dangerous formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), it is prefixed with a single quotation mark (`'`).
  - RFC 4180 compliant quotation escaping is applied to wrap commas, quotes, and newlines safely.
  - The export includes a UTF-8 Byte Order Mark (`\uFEFF`) to enforce accurate UTF-8 encoding across Marathi and regional Marathi characters without spreadsheet misinterpretation.

### 12.2 Intelligence & Aggregation Boundary Isolation
- Dashboard and Report engines execute cross-table aggregation queries (`farms`, `plots`, `crops`, `activities`, `expenses`, `sales`).
- All queries unconditionally enforce `WHERE group_id = :groupId` across every underlying subquery and join.
- Members cannot inspect analytics, financial trends, or reminders belonging to unassociated groups.

### 12.3 Notification Subscription Privacy & Scoping
- Web push subscriptions (`push_subscriptions`) and device registrations (`device_registrations`) store endpoint URIs, auth secrets, and p256dh public keys.
- Records are strictly bound to `(user_id, group_id)`.
- Push notifications and reminder alerts are dispatched only to active group members who hold notification preferences enabled for the target category.

---

## 13. Offline-First & PWA Security Architecture (Phase 4)

### 13.1 Zero Sensitive Auth Caching in Service Worker
- The Progressive Web App Service Worker (`sw.js`) employs a strict cache-whitelist architecture.
- **Allowed Cache Items**: Static application shell resources only (HTML, CSS, JS, SVG icons, manifests).
- **Prohibited Cache Items**: Under zero circumstances does the Service Worker cache `/api/*` endpoints, session tokens, or API credentials.
- All dynamic API communications bypass the Service Worker cache directly to the network or the local IndexedDB queue.

### 13.2 Idempotent Batch Sync Protection
- Offline-created entities generate a client-side UUID (`client_operation_id`).
- When network reconnects, the batch sync endpoint (`POST /api/v1/groups/:groupId/sync`) verifies operations in `sync_operations` table before executing state changes.
- Duplicate or replayed operations are acknowledged idempotently without double-inserting records or skewing financial ledgers.

### 13.3 Offline Storage & Removed-Member Access Revocation
- When a user is removed from a farming group or their session expires, the server returns `401 UNAUTHORIZED` or `403 FORBIDDEN_GROUP_ACCESS`.
- The client-side synchronization service traps these status codes and automatically purges locally cached IndexedDB group data and pending sync queues, preventing unauthorized persistence on shared mobile devices.


