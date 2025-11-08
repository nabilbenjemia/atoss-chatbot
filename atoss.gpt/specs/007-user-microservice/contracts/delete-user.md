# API Contract: DELETE /users/{userId} - Delete User Profile (Soft Delete)

**Endpoint**: `DELETE /users/{userId}`  
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
Authorization: Bearer admin:admin123
```

## Response

### Success (HTTP 204 No Content)

```
(empty body)
```

**Status Code**: `204 No Content`

### Error Responses

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

## Acceptance Criteria

✅ DELETE marks user as inactive (active: false)  
✅ Deleted users return 404 on subsequent GETs  
✅ Deleted users excluded from list operations  
✅ Record remains in database (soft-delete, not purged)  
✅ Invalid permissions return 403  
✅ Non-existent user returns 404  
✅ updatedAt timestamp updated  
✅ Returns 204 with no response body  

## Implementation Notes

- **Soft Delete Only**: Sets `active: false`, does not remove record
- **Audit Trail**: Record retained for audit/compliance purposes
- **Future Enhancement**: Hard-delete or recovery endpoints can be added later
- **Authorization**: Specific rules (admin-only, self-delete) deferred to implementation
- **Timestamp**: updatedAt updated to deletion time

## State After Deletion

```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "john.doe@example.com",
  passwordHash: "...",
  role: "Staff",
  department: "Department 1",
  firstName: "John",
  lastName: "Doe",
  active: false,              // ← Set to false
  lastLogin: "2025-11-07T15:45:30.000Z",
  createdAt: "2025-11-08T10:30:45.123Z",
  updatedAt: "2025-11-08T11:15:00.000Z"  // ← Updated
}
```

