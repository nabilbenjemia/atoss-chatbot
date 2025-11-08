# API Contract: PUT /users/{userId} - Update User Profile

**Endpoint**: `PUT /users/{userId}`  
**Version**: 1.0.0  
**Status**: Stable  
**Auth**: Mock Bearer Token

## Request

### Headers

```
Content-Type: application/json
Authorization: Bearer admin:admin123
```

### Body (JSON) - Partial Update

```json
{
  "email": "newemail@example.com",
  "role": "Admin",
  "firstName": "Jonathan"
}
```

### Field Specifications

All fields optional (partial update); provided fields override existing.

| Field | Type | Constraints |
|-------|------|-------------|
| `email` | String | Valid email, unique (excluding self) |
| `role` | Enum | `Staff` or `Admin` |
| `department` | Enum | `Department 1`, `2`, or `3` |
| `firstName` | String | Max 100 chars |
| `lastName` | String | Max 100 chars |

## Response

### Success (HTTP 200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "newemail@example.com",
    "role": "Admin",
    "department": "Department 1",
    "firstName": "Jonathan",
    "lastName": "Doe",
    "active": true,
    "lastLogin": "2025-11-07T15:45:30.000Z",
    "createdAt": "2025-11-08T10:30:45.123Z",
    "updatedAt": "2025-11-08T11:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Validation error

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "ERR_VALIDATION_FAILED",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

#### 403 Forbidden - Insufficient permissions

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "ERR_FORBIDDEN"
}
```

#### 404 Not Found

```json
{
  "success": false,
  "error": "User not found",
  "code": "ERR_USER_NOT_FOUND"
}
```

#### 409 Conflict - Email already in use

```json
{
  "success": false,
  "error": "Email already exists",
  "code": "ERR_EMAIL_EXISTS"
}
```

## Acceptance Criteria

✅ Partial updates (subset of fields) work correctly  
✅ Unchanged fields preserved after update  
✅ Email uniqueness enforced (excludes current user)  
✅ Invalid permissions return 403  
✅ Inactive users return 404  
✅ updatedAt timestamp updated  
✅ Validation errors return 400 with field details  

## Implementation Notes

- Email converted to lowercase if provided
- Authorization checks: defer specific rules to service layer
- Response excludes passwordHash
- Timestamps in UTC ISO 8601 format

