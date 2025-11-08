# API Contract: GET /users - List/Search Users

**Endpoint**: `GET /users`  
**Version**: 1.0.0  
**Status**: Stable  
**Auth**: Mock Bearer Token

## Request

### Query Parameters

| Parameter | Type | Required | Default | Example |
|-----------|------|----------|---------|---------|
| `role` | String | No | (none) | `Staff` |
| `department` | String | No | (none) | `Department 1` |
| `limit` | Integer | No | 20 | 50 |
| `offset` | Integer | No | 0 | 100 |

### Headers

```
Authorization: Bearer staff:user123
```

### Example URLs

```
GET /users                                          # All active users, paginated
GET /users?role=Admin                               # All active admins
GET /users?department=Department%201                # All users in Dept 1
GET /users?role=Staff&department=Department%202     # Staff in Dept 2
GET /users?limit=10&offset=20                       # Pagination
```

## Response

### Success (HTTP 200 OK)

```json
{
  "success": true,
  "data": [
    {
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
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "jane.smith@example.com",
      "role": "Admin",
      "department": "Department 2",
      "firstName": "Jane",
      "lastName": "Smith",
      "active": true,
      "lastLogin": "2025-11-08T09:20:15.000Z",
      "createdAt": "2025-10-15T14:22:10.000Z",
      "updatedAt": "2025-11-08T09:20:15.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 245
  }
}
```

### Empty Result (HTTP 200 OK)

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 0
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

✅ Returns all active users when no filters provided  
✅ role filter returns only matching users  
✅ department filter returns only matching users  
✅ Multiple filters combined with AND logic  
✅ Inactive users (active: false) always excluded  
✅ Pagination works with limit and offset  
✅ Total count accurate and included in response  
✅ Response excludes passwordHash  
✅ Empty result returns 200 with empty array  
✅ Missing auth returns 401  

## Implementation Notes

- **Soft Delete**: Inactive users (active: false) automatically excluded
- **Default Pagination**: limit=20, max limit=100 to prevent data overload
- **Filter Behavior**: Multiple filters use AND logic
- **Total Count**: Returned for pagination UI (prev/next buttons)
- **Response Order**: Sort by createdAt descending (newest first)
- **Performance**: Uses indexes on (role, active) and (department, active)

## Query Examples

```javascript
// JavaScript / Mongoose pseudocode

// Get all active users
db.users.find({ active: true })
  .skip(0)
  .limit(20)
  .sort({ createdAt: -1 })

// Filter by role
db.users.find({ active: true, role: "Admin" })
  .skip(0)
  .limit(20)
  .sort({ createdAt: -1 })

// Filter by role + department
db.users.find({ active: true, role: "Staff", department: "Department 1" })
  .skip(20)  // offset
  .limit(20)
  .sort({ createdAt: -1 })
```

