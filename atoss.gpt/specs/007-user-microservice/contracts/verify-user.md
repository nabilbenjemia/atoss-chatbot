# API Contract: GET /users/{userId}/verify - Verify User Existence

**Endpoint**: `GET /users/{userId}/verify`  
**Version**: 1.0.0  
**Status**: Stable  
**Auth**: Mock Bearer Token

## Purpose

Verify if a user exists and is active. Used by Auth Service for integration (future phase).

## Request

### URL Parameters

| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `userId` | String (UUID) | Yes | `550e8400-e29b-41d4-a716-446655440000` |

### Headers

```
Authorization: Bearer admin:admin123
```

## Response

### Success - User Exists (HTTP 200 OK)

```json
{
  "success": true,
  "data": {
    "exists": true,
    "active": true,
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Success - User Not Found (HTTP 200 OK)

```json
{
  "success": true,
  "data": {
    "exists": false,
    "active": false,
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Response

#### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "ERR_UNAUTHORIZED"
}
```

## Acceptance Criteria

✅ Returns exists: true if user is active  
✅ Returns exists: false if user inactive or not found  
✅ Returns 200 (not 404) regardless of user state  
✅ Missing auth returns 401  
✅ Rapid response (< 100ms) for Auth Service latency requirements  

## Implementation Notes

- **Verification Logic**: Checks both existence AND active status
- **Status Code**: Always 200 (not 404) to distinguish from endpoint not found
- **Inactive Users**: Treated as "not exists" (exists: false)
- **Auth Service Integration**: Used by Auth Service to verify user before issuing tokens
- **Fast Query**: Indexed lookup on id + active fields

