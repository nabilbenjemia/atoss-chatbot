# API Contract: POST /users - Create User Profile

**Endpoint**: `POST /users`  
**Version**: 1.0.0  
**Status**: Stable  
**Auth**: Mock Bearer Token (format: `Bearer <role>:<identifier>`)

## Purpose

Create a new user profile in the system. Required for User Story 1 (P1 - MVP).

## Request

### Headers

```
Content-Type: application/json
Authorization: Bearer admin:admin123
```

### Body (JSON)

```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123!",
  "role": "Staff",
  "department": "Department 1",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Field Specifications

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| `email` | String | Yes | Valid email, unique, lowercase | `user@example.com` |
| `password` | String | Yes | Min 8 chars, will be hashed | `securePassword123!` |
| `role` | Enum | Yes | `Staff` or `Admin` | `Staff` |
| `department` | Enum | Yes | `Department 1`, `2`, or `3` | `Department 1` |
| `firstName` | String | No | Max 100 chars | `John` |
| `lastName` | String | No | Max 100 chars | `Doe` |

## Response

### Success Response (HTTP 201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "role": "Staff",
    "department": "Department 1",
    "firstName": "John",
    "lastName": "Doe",
    "active": true,
    "lastLogin": null,
    "createdAt": "2025-11-08T10:30:45.123Z",
    "updatedAt": "2025-11-08T10:30:45.123Z"
  }
}
```

**Status Code**: `201 Created`

**Headers**:
```
Content-Type: application/json
Location: /users/550e8400-e29b-41d4-a716-446655440000
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "ERR_VALIDATION_FAILED",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

#### 409 Conflict - Email Already Exists

```json
{
  "success": false,
  "error": "Email already exists",
  "code": "ERR_EMAIL_EXISTS"
}
```

#### 401 Unauthorized - Missing/Invalid Auth

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "ERR_UNAUTHORIZED"
}
```

## Acceptance Criteria

✅ Valid request creates user and returns 201  
✅ User stored in MongoDB with hashed password  
✅ Response excludes passwordHash field  
✅ Email stored lowercase, enforced unique  
✅ Duplicate email returns 409 Conflict  
✅ Invalid data returns 400 with field details  
✅ Missing auth returns 401  

## Implementation Notes

- Password hashed with bcryptjs (10 salt rounds) before storage
- ID generated as UUID v4
- firstName/lastName optional; omit if not provided
- Timestamps in UTC ISO 8601 format
- All emails normalized to lowercase

