# ShetiBook Phase 5 — Activity Reminders & Notifications Report (Gate 5)

**Project:** ShetiBook (शेतीबुक)  
**Official Tagline:** तुमची शेती, तुमचा हिशोब, तुमच्या हातात!  
**Assessment Date:** 2026-11-26  
**Auditor:** Antigravity (Implementation & QA Agent)  
**Authority:** Senior Commander (Prathmesh) & Junior Commander (ChatGPT)  
**Gate Status:** **PASS**

---

## 1. Executive Summary

The activity reminder and notification infrastructure was verified against the approved ShetiBook SRS timeline.
The system features a dual architecture: an in-memory scheduling daemon for active uptimes and a durable SQLite persistence layer (`activity_reminders` and `notifications` tables) that guarantees crash-safe recovery, idempotent processing, and zero duplicate alerts upon server wake-up or reboot.

- **Automated Test Suite:** `tests/notifications.test.ts` (10 of 10 tests passed).
- **Escalation Schedule:** Strict adherence to 2h $\to$ 30m $\to$ 1m timeline.
- **Deduplication:** Atomic transaction state transition guarantees zero duplicate alerts.
- **Operating Constraints:** Documented transparently regarding Render Free tier sleeping and mobile OS battery saving policies.

---

## 2. Activity Reminder Schedule Timeline

For an activity initiated at **8:30 AM ($T_0 = \text{08:30}$)**:

| Stage | Schedule Offset | Exact Target Time | Notification Type | Intended Recipient | Action / Message |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **Stage 1** | $+120\text{ min}$ (2h) | **10:30 AM** | `activity_reminder` | Active Farmer (Actor) | *पहिली आठवण: काम चालू असल्याची खात्री करा.* |
| **Stage 2** | $+150\text{ min}$ (+30m) | **11:00 AM** | `activity_reminder` | Active Farmer (Actor) | *दुसरी आठवण: काम पूर्ण झाले किंवा थांबले असल्यास नोंद करा.* |
| **Stage 3** | $+151\text{ min}$ (+1m) | **11:01 AM** | `activity_escalation` | Other Family Members | *कुटुंब अलर्ट: अडीच तास उलटूनही सहकाऱ्याचा प्रतिसाद नाही.* |

### 2.1 State Management Rules Verified
1. **Activity Start**: When activity transitions to `in_progress`, Stage 1, Stage 2, and Stage 3 reminders are inserted into `activity_reminders` with `status: 'pending'`.
2. **Activity Pause**: When activity transitions to `paused`, all pending reminders transition to `status: 'paused'`. `processDueReminders()` ignores them.
3. **Activity Resume**: `resumeActivityReminders` inspects which stages were already delivered before the pause:
   - If Stage 1 was sent: Stage 2 is set to $\text{resumeTime} + 30\text{ min}$, Stage 3 to $\text{resumeTime} + 31\text{ min}$.
   - If Stage 1 was not sent: Full countdown restarts from resume time ($+120\text{m}$, $+150\text{m}$, $+151\text{m}$).
4. **Activity Completion**: When activity transitions to `completed`, all pending and paused reminders transition to `status: 'cancelled'`.
5. **Farmer Acknowledgement**:
   - Calling `POST /api/v1/groups/:groupId/notifications/reminders/:activityId/acknowledge`:
     - Appends `reminder_acknowledged` event into `activity_events` audit table.
     - Immediately marks Stage 3 family escalation reminder as `cancelled`.
     - `processDueReminders()` checks whether the farmer responded or logged progress after Stage 1; if detected, Stage 3 family escalation is permanently suppressed.

---

## 3. Four-Tier Notification Delivery Taxonomy

To prevent misleading claims of "guaranteed real-time delivery" on zero-budget infrastructure, ShetiBook explicitly distinguishes between four distinct layers:

```
[Layer 1: Persistence]  --> [Layer 2: Scheduler]  --> [Layer 3: Push Dispatch]  --> [Layer 4: OS Display]
Durable SQLite record        Background Timer           Web Push Endpoint            Device Notification
(100% Guaranteed)            (Catches up on wake)       (Network dependent)          (OS Battery dependent)
```

1. **Layer 1: Persistence (100% Guaranteed)**
   - Every notification is durably stored in the `notifications` table with `is_read = 0`.
   - Even if the farmer is offline or push fails, notifications are fetched immediately upon opening the app.
2. **Layer 2: Server Scheduling (Durable Catch-Up)**
   - Managed via periodic cron/timer and on-demand trigger `processDueReminders()`.
   - Safe after server restart: Queries all pending rows where `due_at <= now()`. Atomically marks processed rows as `sent`.
3. **Layer 3: Web Push Delivery (Best-Effort)**
   - Sent via standard Web Push API protocol (`push_subscriptions` table).
   - Inactive or expired endpoints (HTTP 404/410) are handled gracefully without crashing the server.
4. **Layer 4: Device/OS Display (Hardware Controlled)**
   - Display depends on user notification permissions, mobile browser background capabilities, and OS battery optimization.

---

## 4. Real-World Free-Tier Infrastructure Constraints

### 4.1 Render Free Tier Cold Sleep
- Render spins down inactive free web services after 15 minutes of zero HTTP traffic.
- While the container is asleep, NodeJS timers (`setInterval`) stop running.
- **Mitigation:** When any group member opens ShetiBook, incoming traffic wakes the container. The server immediately invokes `processDueReminders()`, which queries overdue rows in SQLite and delivers all pending alerts. Sub-second background precision is NOT guaranteed under free hosting.

### 4.2 Mobile OS Battery Throttling (Android Doze & iOS WebKit)
- Android Doze Mode and iOS aggressive background management restrict background network wakeups for Web Push when the phone is locked or on low battery.
- ShetiBook guarantees data durability at Layer 1: the farmer will see all notifications in the Notification Center as soon as the app is opened.

---

## 5. Gate 5 Sign-Off

The reminder schedule, state transitions, acknowledgement suppression, and honest operating disclosures satisfy all requirements. Gate 5 is classified as **PASS**.
