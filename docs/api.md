# ShetiBook — API Documentation (v1)

Base URL: `/api/v1`

All responses follow a consistent JSON format:
```json
{
  "success": true,
  "data": { ... }
}
```
Or for errors:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description",
    "details": [ ... ]
  }
}
```

---

## 1. System Health

### `GET /health`
- **Auth**: Public
- **Description**: Verifies service status and database connectivity without exposing sensitive credentials.
- **Response**:
```json
{
  "status": "ok",
  "service": "shetibook-api",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-11-22T18:05:40.955Z"
}
```

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **Auth**: Public (Rate limited: 10 attempts/15 min)
- **Request Body**:
```json
{
  "phoneNumber": "9876543210",
  "password": "FarmPassword123",
  "confirmPassword": "FarmPassword123"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-v4",
    "phoneNumber": "9876543210",
    "recoveryCode": "4A9K-7M2P",
    "message": "Account created successfully. Please store your recovery code securely."
  }
}
```
*(Notice: `recoveryCode` is shown strictly ONCE at registration).*

### `POST /api/v1/auth/login`
- **Auth**: Public (Rate limited: 10 attempts/15 min)
- **Request Body**:
```json
{
  "phoneNumber": "9876543210",
  "password": "FarmPassword123"
}
```
- **Response (200 OK)**:
  - Sets `Set-Cookie: sb_session=<token>; HttpOnly; SameSite=Lax; Path=/`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4",
      "phoneNumber": "9876543210",
      "status": "active"
    },
    "groups": [
      {
        "id": "uuid-v4",
        "name": "यादव कुटुंब शेती",
        "role": "owner",
        "joinedAt": "2026-11-22T18:00:00.000Z"
      }
    ]
  }
}
```

### `POST /api/v1/auth/logout`
- **Auth**: Authenticated (requires active session cookie)
- **Description**: Revokes session in database and clears session cookie.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully."
  }
}
```

### `GET /api/v1/auth/me`
- **Auth**: Authenticated (requires active session cookie)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4",
      "phoneNumber": "9876543210",
      "status": "active",
      "createdAt": "2026-11-22T18:00:00.000Z"
    },
    "groups": [ ... ]
  }
}
```

### `POST /api/v1/auth/recover-password`
- **Auth**: Public (Rate limited: 10 attempts/15 min)
- **Description**: Resets account password using phone number and one-time recovery code. Invalidates all active sessions for the user and generates a fresh recovery code.
- **Request Body**:
```json
{
  "phoneNumber": "9876543210",
  "recoveryCode": "4A9K-7M2P",
  "newPassword": "NewPassword999",
  "confirmPassword": "NewPassword999"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Password successfully reset. Please log in with your new password.",
    "newRecoveryCode": "9B2X-4L8Q"
  }
}
```

---

## 3. Users (`/api/v1/users`)

### `GET /api/v1/users/profile`
- **Auth**: Authenticated
- **Response (200 OK)**: Returns user identity and list of active farming group memberships.

---

## 4. Family Groups (`/api/v1/groups`)

### `POST /api/v1/groups`
- **Auth**: Authenticated
- **Request Body**:
```json
{
  "name": "यादव कुटुंब शेती"
}
```
- **Response (201 Created)**: Returns created group details where creator is assigned `role: "owner"`.

### `GET /api/v1/groups`
- **Auth**: Authenticated
- **Response (200 OK)**: Returns all active farming groups where user is an owner or member.

### `GET /api/v1/groups/:groupId`
- **Auth**: Authenticated + Active Group Member (`role: "owner" | "member"`)
- **Description**: Returns group overview, active member roster, and (if owner) pending invitations.
- **Cross-Group Enforcement**: Returns `403 FORBIDDEN_GROUP_ACCESS` if user does not belong to `:groupId`.

### `POST /api/v1/groups/:groupId/invitations`
- **Auth**: Authenticated + Group Owner (`role: "owner"`)
- **Request Body**:
```json
{
  "intendedPhone": "9876543211" // optional
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "invitationId": "uuid-v4",
    "groupId": "uuid-v4",
    "token": "raw-24-byte-hex-token",
    "expiresAt": "2026-11-29T18:00:00.000Z"
  }
}
```

### `GET /api/v1/groups/invitations/:token`
- **Auth**: Public / Authenticated
- **Description**: Validates invitation token and provides group preview (group name, masked owner phone, validity status).

### `POST /api/v1/groups/join`
- **Auth**: Authenticated
- **Request Body**:
```json
{
  "token": "raw-24-byte-hex-token"
}
```
- **Response (200 OK)**: Marks invitation accepted, adds user to `group_members` with `role: "member"`.

### `DELETE /api/v1/groups/:groupId/members/:memberUserId`
- **Auth**: Authenticated + Group Owner (`role: "owner"`)
- **Description**: Safely removes a member from the group. Sets member `status = 'removed'`, preserving membership history and existing agricultural/financial audit logs.

### `DELETE /api/v1/groups/:groupId`
- **Auth**: Authenticated + Group Owner (`role: "owner"`)
- **Description**: Deactivates the group safely (`status = 'deactivated'`). Prevents destructive cascade deletion of historical records.

---

## 4. Farm Management (`/api/v1/groups/:groupId/farms`)

### `POST /api/v1/groups/:groupId/farms`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "farmName": "वडिलांचे मुख्य शेत",
  "village": "बावडा",
  "taluka": "इंदापूर",
  "district": "पुणे",
  "areaValue": 5.5,
  "areaUnit": "acre",
  "surveyNumber": "१२४/२ अ",
  "notes": "विहीर व ठिबक सिंचन सोय उपलब्ध"
}
```
- **Response (201 Created)**: Returns created farm record with calculated square meters and localized breakdown.

### `GET /api/v1/groups/:groupId/farms`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns all active farms of the group with plot counts, active crop counts, allocated square meters, and unallocated area.

### `GET /api/v1/groups/:groupId/farms/:farmId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns full farm details including all nested cultivation plots and active crops.

### `PUT /api/v1/groups/:groupId/farms/:farmId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Updates farm name, location, survey number, notes, or area (with validation that updated area is not less than already-allocated plot areas).

### `DELETE /api/v1/groups/:groupId/farms/:farmId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Soft-archives the farm (`is_active = 0`), preserving all historical crop and activity records.

---

## 5. Plot Management (`/api/v1/groups/:groupId/...`)

### `POST /api/v1/groups/:groupId/farms/:farmId/plots`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "plotName": "प्लॉट २ - माळरानातील तुकडा",
  "areaValue": 2.5,
  "areaUnit": "acre",
  "cultivationMode": "intercropping",
  "notes": "सोयाबीन अधिक तूर जोडओळ पद्धत"
}
```
- **Response (201 Created)**: Asserts that plot area does not exceed available unallocated farm area and plot name is unique on this farm.

### `GET /api/v1/groups/:groupId/farms/:farmId/plots`
- **Auth**: Authenticated + Active Group Member
- **Description**: Lists all active cultivation plots of the farm with cultivation mode and active crops.

### `GET /api/v1/groups/:groupId/plots/:plotId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns detailed plot information including all past and active crops.

### `PUT /api/v1/groups/:groupId/plots/:plotId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Updates plot name, area, or notes with boundary validation against remaining farm area.

### `PATCH /api/v1/groups/:groupId/plots/:plotId/mode`
- **Auth**: Authenticated + Active Group Member
- **Request Body**: `{ "cultivationMode": "separate" }`
- **Description**: Switches cultivation mode. Blocked if switching to `separate` while plot currently has more than 1 active/planned crop.

### `DELETE /api/v1/groups/:groupId/plots/:plotId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Soft-archives the plot (`is_active = 0`). Historical crop data is retained.

---

## 6. Crop Management (`/api/v1/groups/:groupId/crops`)

### `GET /api/v1/groups/:groupId/crops/metadata`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns pre-seeded list of 11 regional crop types and 4 cropping seasons with Marathi and English names.

### `POST /api/v1/groups/:groupId/crops`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "farmId": "farm-uuid",
  "plotId": "plot-uuid",
  "cropTypeId": "crop-type-uuid",
  "cropSeasonId": "season-uuid",
  "cropNameCustom": "सोयाबीन (जे.एस. ३३५)",
  "sowingDate": "2026-06-20",
  "expectedHarvestDate": "2026-10-25",
  "notes": "तुरीसोबत आंतरपीक"
}
```
- **Validation**:
  - Enforces plot belongs to specified farm, which belongs to target group.
  - If plot mode is `separate`, rejects if another active/planned crop exists on the plot.
  - If plot mode is `intercropping`, allows coexisting crops without double-counting physical land area.
  - Expected harvest date must be on or after sowing date.

### `GET /api/v1/groups/:groupId/crops`
- **Auth**: Authenticated + Active Group Member
- **Query Filters**: `?farmId=...&plotId=...&status=planned|active|harvested|cancelled`
- **Description**: Returns filtered list of crops.

### `GET /api/v1/groups/:groupId/crops/:cropId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns complete crop details with plot, farm, and season information.

### `PUT /api/v1/groups/:groupId/crops/:cropId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Updates crop details (variety, custom name, harvest expectation, notes).

### `PATCH /api/v1/groups/:groupId/crops/:cropId/status`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "status": "harvested",
  "actualHarvestDate": "2026-10-24"
}
```
- **Description**: Transitions crop status (`planned` -> `active` -> `harvested` or `cancelled`).

---

## 7. Agricultural Activities (`/api/v1/groups/:groupId/activities`)

### `GET /api/v1/groups/:groupId/activities/types`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns 6 pre-seeded activity types (Irrigation, Fertilizer, Weeding, Spraying, Ploughing, Custom).

### `POST /api/v1/groups/:groupId/activities`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "farmId": "farm-uuid",
  "plotId": "plot-uuid",
  "cropId": "crop-uuid",
  "activityTypeId": "act-type-uuid",
  "customActivityName": "युरिया व डीएपी खताची पहिली मात्रा",
  "description": "ऊस पिकाला पहिली खत मात्रा दिली"
}
```
- **Response (201 Created)**: Creates activity in `pending` status and records initial `created` event in `activity_events`.

### `GET /api/v1/groups/:groupId/activities`
- **Auth**: Authenticated + Active Group Member
- **Query Filters**: `?farmId=...&cropId=...&status=pending|in_progress|paused|completed`
- **Description**: Returns activities matching criteria.

### `GET /api/v1/groups/:groupId/activities/:activityId`
- **Auth**: Authenticated + Active Group Member
- **Description**: Returns activity details and complete chronological append-only timeline from `activity_events`.

### `POST /api/v1/groups/:groupId/activities/:activityId/transition`
- **Auth**: Authenticated + Active Group Member
- **Request Body**:
```json
{
  "transition": "start", // "start" | "pause" | "resume" | "complete" | "cancel"
  "notes": "मजुरांसह प्रत्यक्ष खत टाकणे सुरू केले"
}
```
- **Description**: Transitions status (`pending` -> `in_progress`, etc.) and records immutable event with actor user ID, event type, timestamp, and notes. Invalid transitions are rejected with `400 INVALID_TRANSITION`.

---

## 8. Financial Management (`/api/v1/groups/:groupId/...`)

### 8.1 Expense Categories
#### `GET /api/v1/groups/:groupId/expenses/categories`
- **Auth**: Authenticated + Group Member
- **Description**: Returns 10 pre-seeded Maharashtra agricultural expense categories.

### 8.2 Farm Expenses
#### `POST /api/v1/groups/:groupId/expenses`
- **Auth**: Authenticated + Group Member
- **Request Body**:
```json
{
  "categoryId": "category-uuid",
  "farmId": "farm-uuid",
  "amountPaise": 550000,
  "expenseDate": "2026-11-20",
  "vendorName": "कृषी सेवा केंद्र, बारामती",
  "paymentMethod": "cash",
  "notes": "युरिया व पोटॅश खरेदी",
  "allocations": [
    {
      "cropId": "crop-uuid-1",
      "allocatedAmountPaise": 350000
    }
  ]
}
```
- **Description**: Incurs an expense. Any unallocated remainder (₹2,000 / 200000 paise) automatically remains as general farm expense. Over-allocation is rejected with `400 ALLOCATION_EXCEEDS_EXPENSE`.

#### `GET /api/v1/groups/:groupId/expenses`
- **Auth**: Authenticated + Group Member
- **Query Filters**: `?categoryId=...&farmId=...&cropId=...&paymentStatus=unpaid|partial|paid&startDate=...&endDate=...`
- **Response**: List of expenses with computed total paid and outstanding balance.

#### `GET /api/v1/groups/:groupId/expenses/:expenseId`
- **Auth**: Authenticated + Group Member
- **Description**: Returns full expense details, category name, crop allocations breakdown, and payment history.

#### `PUT /api/v1/groups/:groupId/expenses/:expenseId`
- **Auth**: Authenticated + Group Member
- **Description**: Updates expense details and rebalances crop allocations.

#### `DELETE /api/v1/groups/:groupId/expenses/:expenseId`
- **Auth**: Authenticated + Group Member
- **Description**: Deletes expense. Blocked if payments exist.

### 8.3 Harvest Records
#### `POST /api/v1/groups/:groupId/harvests`
- **Auth**: Authenticated + Group Member
- **Request Body**:
```json
{
  "cropId": "crop-uuid",
  "harvestDate": "2026-11-22",
  "quantity": 45,
  "unit": "quintal",
  "qualityGrade": "Grade A",
  "storageLocation": "शेत गोडाऊन",
  "notes": "पहिल्या तोडणीचा उच्च प्रतीचा माल"
}
```

#### `GET /api/v1/groups/:groupId/harvests`
- **Auth**: Authenticated + Group Member
- **Response**: List of harvests with total yield, sold quantity, remaining available inventory, and unit conversions.

#### `GET /api/v1/groups/:groupId/harvests/:harvestId`
- **Auth**: Authenticated + Group Member
- **Description**: Returns harvest details and all linked sales consuming this harvest inventory.

### 8.4 Agricultural Sales
#### `POST /api/v1/groups/:groupId/sales`
- **Auth**: Authenticated + Group Member
- **Request Body**:
```json
{
  "cropId": "crop-uuid",
  "harvestId": "harvest-uuid",
  "saleDate": "2026-11-23",
  "buyerName": "गणेश अडत दुकान",
  "marketName": "पुणे कृषी उत्पन्न बाजार समिती",
  "quantity": 30,
  "unit": "quintal",
  "ratePerUnitPaise": 285000,
  "totalAmountPaise": 8550000,
  "notes": "पट्टी क्रमांक १८४"
}
```
- **Validation**: If `harvestId` is supplied, asserts that `quantity_kg <= available_quantity_kg`. Overselling is rejected with `400 SALE_QUANTITY_EXCEEDS_AVAILABLE_HARVEST`.

#### `GET /api/v1/groups/:groupId/sales`
- **Auth**: Authenticated + Group Member
- **Query Filters**: `?cropId=...&buyerName=...&paymentStatus=unpaid|partial|paid`
- **Response**: List of sales with paid amounts and outstanding receivables.

#### `GET /api/v1/groups/:groupId/sales/:saleId`
- **Auth**: Authenticated + Group Member
- **Description**: Sale invoice details, linked harvest info, and installment payment history.

### 8.5 Reusable Payments
#### `POST /api/v1/groups/:groupId/payments`
- **Auth**: Authenticated + Group Member
- **Request Body**:
```json
{
  "paymentType": "expense", // or "sale"
  "expenseId": "expense-uuid", // required if paymentType is "expense"
  "amountPaise": 200000,
  "paymentDate": "2026-11-24",
  "paymentMode": "upi",
  "referenceNumber": "UPI/332155890123",
  "notes": "दुसरा हप्ता जमा केला"
}
```
- **Validation**: Asserts `amountPaise <= outstandingBalancePaise`. Overpayment is rejected with `400 PAYMENT_EXCEEDS_OUTSTANDING_BALANCE`.

### 8.6 Financial Summary
#### `GET /api/v1/groups/:groupId/finance/summary`
- **Auth**: Authenticated + Group Member
- **Query Filters**: `?farmId=...&cropId=...&startDate=...&endDate=...`
- **Response**:
```json
{
  "success": true,
  "data": {
    "accrual": {
      "totalSalesPaise": 8550000,
      "totalExpensesPaise": 550000,
      "netProfitPaise": 8000000
    },
    "cashFlow": {
      "totalInflowPaise": 4000000,
      "totalOutflowPaise": 350000,
      "netCashFlowPaise": 3650000
    },
    "receivablesPaise": 4550000,
    "payablesPaise": 200000,
    "categoryBreakdown": [
      {
        "categoryId": "cat-1",
        "categoryNameMr": "खते व सेंद्रिय खते",
        "categoryNameEn": "Fertilizers & Manure",
        "totalPaise": 350000,
        "percentage": 63.6
      }
    ]
  }
}
```

