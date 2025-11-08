# API Contract: GET /users/{userId} - Retrieve User Profile

**Endpoint**: `GET /users/{userId}`  
**Version**: 1.0.0  
**Status**: Stable  
**Auth**: Mock Bearer Token

## Request

### URL Parameters

| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `userId` | String (UUID) | Yes | `550e8400-e29b-41d4-a716-446655440000` |

### Headers

```
Authorization: Bearer staff:user123
```

## Response

### Success (HTTP 200 OK)

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
    "lastLogin": "2025-11-07T15:45:30.000Z",
    "createdAt": "2025-11-08T10:30:45.123Z",
    "updatedAt": "2025-11-08T10:30:45.123Z"
  }
}
```

### Error Responses

#### 404 Not Found - User doesn't exist or is inactive

```json
{
  "success": false,
  "error": "User not found",
  "code": "ERR_USER_NOT_FOUND"
}
```

#### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "ERR_UNAUTHORIZED"
}
```

## Acceptance Criteria

✅ Valid userId returns complete user profile (200)  
✅ Inactive users (active: false) return 404  
✅ Non-existent ID returns 404  
✅ Response excludes passwordHash  
✅ Missing auth returns 401  

## Implementation Notes

- Soft-deleted users (active: false) treated as 404
- passwordHash never included in response
- Timestamps in UTC ISO 8601 format

