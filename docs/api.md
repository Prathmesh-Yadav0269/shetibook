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
