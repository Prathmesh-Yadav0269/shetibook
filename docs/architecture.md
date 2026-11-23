# ShetiBook — Architecture Documentation

## 1. System Overview

ShetiBook is designed as a **modular monolith** with a decoupled Single Page Application (SPA) frontend.

```mermaid
flowchart TD
    Client["React Frontend (SPA)\nReact Router + TanStack Query\nTailwind CSS + i18next"]
    API["Express Backend (API v1)\nModular Monolith\nMiddleware + Zod + Argon2id"]
    DB[("Turso / SQLite Database\n@libsql/client\nForeign Key Enforcement")]

    Client -->|HTTPS + HttpOnly Cookies\nJSON REST API| API
    API -->|Prepared SQL Statements\nTransactions| DB
```

### Approved Five-Phase Roadmap

- **Phase 1: Foundation & Core Infrastructure** *(Completed)*: Monorepo, database migrations, phone + Argon2id authentication, 128-bit keyed recovery secrets, HTTP-only sessions, family groups with single active owner and atomic invitation consumption, audit log triggers, and Marathi/English bilingual support.
- **Phase 2: Farm & Agricultural Management** *(Completed)*: Farms, plots, land area conversions, crops, intercropping architecture, activities, and append-only event timeline.
- **Phase 3: Financial & Business Management** *(Pending)*: Expenses, allocations, payments, harvests, and sales.
- **Phase 4: Intelligence & Application Experience** *(Pending)*: Dashboard, reports, notifications, offline synchronization, and PWA.
- **Phase 5: Quality Assurance & Production Release** *(Pending)*: Integration, security, performance, deployment, backup/recovery, and handover.

---

## 2. Frontend Architecture

- **Pattern**: Feature-based architecture (`features/auth`, `features/family`, `features/agriculture`).
- **State Management**:
  - Server state: TanStack Query (cached, auto-refreshing queries, optimistic UI, mutation invalidations).
  - Auth & global session: `AuthProvider` context with automatic group selection and persistence.
- **Routing & Layouts**:
  - `AuthLayout`: Centered clean surface for public screens (Welcome, Login, Register, Recovery).
  - `AppLayout`: Standard application shell with responsive navigation header, desktop links, mobile bottom navigation bar (`md:hidden`), group badge, language switcher, and footer.
- **Internationalization**: `i18next` with `mr` (Marathi Devanagari) as primary default, fallback, and `en` (English) alternate.
- **Form Handling**: `react-hook-form` with `zodResolver` for client-side validation, live calculations, and immediate user feedback.

---

## 3. Backend Architecture

- **Pattern**: Modular Monolith organized by domain capabilities:
  - `modules/auth`: User registration, Argon2id authentication, session issuance, password recovery.
  - `modules/users`: User identity and profile endpoints.
  - `modules/family`: Group creation, membership lists, invitation management, member removal, safe deactivation.
  - `modules/agriculture`: Farms, plots, crops, intercropping validation, activities, and event history.
- **Layers**:
  1. **Router**: Express Router defining REST endpoints and applying rate limiters.
  2. **Middleware**: Centralized authentication (`requireAuth`), group membership verification (`requireGroupMembership`), and structured error handling.
  3. **Controller / Handler**: Request extraction, Zod schema validation, response formatting.
  4. **Service**: Core business logic, cryptographic operations, transactions, audit logging.
  5. **Database**: `@libsql/client` parameterized queries and schema migrations.

---

## 4. Land Area Conversion Engine (`utils/area.ts`)

ShetiBook implements a high-precision, non-accumulative area conversion model:

- **Approved Units**:
  - `acre`: 1 acre = 40 guntha = 4,046.8564224 m².
  - `guntha`: 1 guntha = 0.025 acre = 101.17141056 m².
  - `hectare`: 1 hectare = 2.4710538147 acres = 10,000 m².
- **Storage Strategy**:
  - All land areas (`farms.area_sqm`, `cultivation_plots.area_sqm`) are normalized and stored as exact square meters (`REAL NOT NULL CHECK(area_sqm > 0)`).
  - The original input value and unit (`area_value`, `area_unit`) are also persisted for auditability and display fidelity.
  - Zero cumulative rounding errors: conversions to square meters and back use floating-point arithmetic with decimal rounding only at the presentation layer.
- **Localized Breakdown (`calculateAreaBreakdown`)**:
  - Calculates whole acres and remaining gunthas (e.g., 5.5 acres = 5 acres and 20 gunthas).
  - Formats numbers in Marathi Devanagari numerals (e.g. ५ एकर, २० गुंठे) and English (5 Acre, 20 Guntha).

---

## 5. Plot Management & Intercropping Architecture

### 5.1 Physical Plot Allocation
- Each farm has an official total area (`farm.area_sqm`).
- Cultivation plots represent physical divisions of the farm.
- When creating or updating a plot, the backend asserts:
  $$\sum \text{area\_sqm}(\text{active plots}) \le \text{farm.area\_sqm}$$
  Any attempt to allocate more physical land than the farm possesses is rejected with `400 PLOT_AREA_EXCEEDS_FARM`.
- Plot names must be unique among active plots on the same farm.

### 5.2 Cultivation Modes & Intercropping
Plots support two distinct modes:
1. **Separate (`separate`)**:
   - Exactly one primary crop can be active or planned on the plot at any time.
   - Registering a second active crop is rejected with `400 PLOT_ALREADY_HAS_ACTIVE_CROP`.
2. **Intercropping (`intercropping`)**:
   - Multiple crops (e.g. Sugarcane + Soybean, or Soybean + Tur) coexist on the same physical plot.
   - Each crop record maintains its own sowing date, expected harvest date, status, and activity tracking.
   - **Physical Land Conservation**: Crucially, multiple crops sharing an intercropping plot do **not** inflate or double-count the farm's physical area. The plot's physical area is counted strictly once.
   - **Mode Switching Safeguard**: Changing a plot from `intercropping` to `separate` mode is strictly blocked if the plot currently has more than 1 active/planned crop (`400 MULTIPLE_CROPS_EXIST`).

```mermaid
flowchart TD
    Farm["Farm: वडिलांचे मुख्य शेत (5.5 Acre)"]
    Plot1["Plot 1: विहिरीशेजारील तुकडा (2.0 Acre)\nMode: separate"]
    Plot2["Plot 2: माळरानातील तुकडा (2.5 Acre)\nMode: intercropping"]
    Unallocated["Unallocated Land: 1.0 Acre"]

    Crop1["Crop 1: ऊस (Sugarcane)\nStatus: active"]
    Crop2A["Crop 2A: सोयाबीन (Soybean)\nStatus: active"]
    Crop2B["Crop 2B: तूर (Tur / Red Gram)\nStatus: active"]

    Farm --> Plot1
    Farm --> Plot2
    Farm --> Unallocated

    Plot1 --> Crop1
    Plot2 --> Crop2A
    Plot2 --> Crop2B
```

---

## 6. Agricultural Activity Lifecycle & Append-Only Event Log

Activities track real-world farm work (Irrigation, Fertilizer application, Weeding, Spraying, Ploughing, Custom) with a strict state machine:

```mermaid
stateDiagram-v2
    [*] --> pending: Create Activity
    pending --> in_progress: start
    in_progress --> paused: pause
    paused --> in_progress: resume
    in_progress --> completed: complete
    pending --> completed: complete
    pending --> cancelled: cancel
    in_progress --> cancelled: cancel
    paused --> cancelled: cancel
    completed --> [*]
    cancelled --> [*]
```

- **Append-Only Timeline (`activity_events`)**:
  - Every state transition inserts a permanent record in `activity_events` containing:
    - `id`: Unique identifier (UUIDv4)
    - `activity_id`: References `activities(id)`
    - `group_id`: References `farming_groups(id)`
    - `actor_id`: References `users(id)`
    - `event_type`: `'created'`, `'started'`, `'paused'`, `'resumed'`, `'completed'`, `'cancelled'`
    - `event_at`: ISO timestamp
    - `notes`: Optional description or remarks from the actor
  - History is never overwritten or mutated; the complete timeline is served chronologically to the UI.

---

## 7. Group Authorization & Isolation

Every request to an agricultural resource (`/api/v1/groups/:groupId/...`) executes `requireGroupMembership`:
1. Verifies that the requester has a valid, unexpired, non-revoked session.
2. Queries `group_members` for `group_id = :groupId AND user_id = :userId AND status = 'active'`.
3. Rejects with `403 FORBIDDEN_GROUP_ACCESS` if the user is not an active member.
4. Allows all active family members (`owner` and `member`) to collaborate on managing farms, plots, crops, and shared activities.
