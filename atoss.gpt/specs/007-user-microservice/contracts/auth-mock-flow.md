# Mock Authentication Flow

**Document**: Mock Authentication & Authorization Strategy  
**Feature**: 007-user-microservice  
**Date**: 2025-11-08  
**Phase**: Development (MVP)

## Overview

During development, the User Service uses **mock authentication** with role-simulated bearer tokens. This allows independent development and testing without depending on the Auth Service. The mock auth implementation is designed to be replaced with real JWT validation later without code changes (middleware-only modification).

## Mock Token Format

### Bearer Token Structure

```
Authorization: Bearer <role>:<identifier>
```

### Examples

```
Bearer admin:admin123              # Admin user with ID "admin123"
Bearer staff:user456               # Staff user with ID "user456"
Bearer admin:super-admin           # Admin with longer identifier
Bearer staff:john.doe@example.com  # Staff using email as ID
```

### Token Components

| Component | Values | Purpose |
|-----------|--------|---------|
| `role` | `admin`, `staff` | User role extracted for authorization checks |
| `identifier` | Any string | User identifier (not validated in mock, for context) |

## Authentication Middleware

### Token Parsing

```javascript
// Mock auth middleware pseudocode

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      code: "ERR_UNAUTHORIZED"
    });
  }
  
  const token = authHeader.substring(7);  // Remove "Bearer "
  const [role, identifier] = token.split(':');
  
  if (!role || !identifier) {
    return res.status(401).json({
      success: false,
      error: "Invalid token format",
      code: "ERR_INVALID_TOKEN"
    });
  }
  
  if (!['admin', 'staff'].includes(role)) {
    return res.status(401).json({
      success: false,
      error: "Invalid role",
      code: "ERR_INVALID_ROLE"
    });
  }
  
  // Attach to request for downstream use
  req.auth = { role, identifier };
  next();
}
```

### Usage in Routes

```javascript
// Routes with mock auth

router.post('/users', authMiddleware, UserController.create);
router.get('/users/:userId', authMiddleware, UserController.get);
router.put('/users/:userId', authMiddleware, UserController.update);
router.delete('/users/:userId', authMiddleware, UserController.delete);
router.get('/users', authMiddleware, UserController.list);
router.get('/users/:userId/verify', authMiddleware, UserController.verify);
```

## Authorization Logic (MVP)

### Strategy: Deferred Permission Enforcement

For MVP, authorization checks are minimal and deferred:

```javascript
// Service layer authorization pseudocode

async function updateUser(userId, updateData, authContext) {
  const { role, identifier } = authContext;
  
  // Authorization check point (deferred, simplified)
  // Full permission matrix will be defined in future enhancement
  
  // For now: Accept both admin and staff, log the operation
  if (!role) {
    throw new Error("ERR_UNAUTHORIZED");
  }
  
  // Proceed with update
  const user = await User.findById(userId);
  if (!user) throw new Error("ERR_USER_NOT_FOUND");
  
  // Apply updates
  Object.assign(user, updateData);
  await user.save();
  
  return user;
}
```

### Future Authorization Patterns

**Phase 2 - Specific Rules**:
```javascript
// When detailed permissions are defined
const PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'list'],
  staff: ['read_own', 'update_own', 'list']
};

if (!PERMISSIONS[role].includes(operation)) {
  throw new Error("ERR_FORBIDDEN");
}
```

**Phase 3 - Policy Service**:
```javascript
// With centralized policy evaluation
const allowed = await policyService.evaluate({
  role: role,
  action: 'update_user',
  resource: userId
});

if (!allowed) throw new Error("ERR_FORBIDDEN");
```

## Testing with Mock Auth

### Postman Collection Examples

**Create User (Admin)**:
```
POST /users
Authorization: Bearer admin:admin123
Body: { email: "test@example.com", password: "pass123", role: "Staff", department: "Department 1" }
```

**Update User (Staff)**:
```
PUT /users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer staff:user456
Body: { firstName: "John" }
```

**List Users (Both Roles)**:
```
GET /users?role=Admin
Authorization: Bearer staff:user456

GET /users?role=Admin
Authorization: Bearer admin:admin123
```

**Delete User (Admin)**:
```
DELETE /users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer admin:admin123
```

### Manual Testing Flow

1. **No Auth**: 
   ```bash
   curl -X GET http://localhost:4001/users
   # Returns: 401 ERR_UNAUTHORIZED
   ```

2. **Admin Access**:
   ```bash
   curl -X POST http://localhost:4001/users \
     -H "Authorization: Bearer admin:admin123" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"pass123","role":"Staff","department":"Department 1"}'
   # Returns: 201 with created user
   ```

3. **Staff Access**:
   ```bash
   curl -X GET http://localhost:4001/users/550e8400... \
     -H "Authorization: Bearer staff:user456"
   # Returns: 200 with user profile (or 403/404 based on future auth rules)
   ```

## Migration Strategy: Mock → Real JWT

### Phase 1: Current (Mock Auth)

```javascript
// Middleware: Parse mock bearer token
req.auth = parseToken('Bearer admin:admin123');  // {role: 'admin', identifier: 'admin123'}
```

### Phase 2: JWT Validation (Drop-in Replacement)

```javascript
// Middleware: Validate JWT signature, extract claims
const decoded = jwt.verify(token, JWT_SECRET);
req.auth = { role: decoded.role, identifier: decoded.sub };  // Same structure
```

**Key**: Service layer code unchanged; only middleware modified.

## Frontend Mock Login Flow

### React Components

**LoginPage.jsx**:
```jsx
function LoginPage() {
  const handleLogin = (role) => {
    // Mock: Generate bearer token with role
    const token = `${role}:user${Date.now()}`;
    localStorage.setItem('auth', `Bearer ${token}`);
    navigate('/profile');
  };
  
  return (
    <div>
      <button onClick={() => handleLogin('admin')}>Login as Admin</button>
      <button onClick={() => handleLogin('staff')}>Login as Staff</button>
    </div>
  );
}
```

**ProfilePage.jsx**:
```jsx
function ProfilePage() {
  const token = localStorage.getItem('auth');
  const apiClient = createApiClient(token);
  
  return (
    <div>
      <button onClick={() => apiClient.post('/users', {...})}>Create User</button>
      <button onClick={() => apiClient.get('/users')}>List Users</button>
      <CRUDForm apiClient={apiClient} role={extractRole(token)} />
    </div>
  );
}
```

## Environment Configuration

### .env for Mock Auth

```env
# User Service
PORT=4001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_users

# Mock Authentication
MOCK_AUTH=true
MOCK_AUTH_TOKENS=admin:admin123,staff:user456,staff:user789

# Log Level
LOG_LEVEL=debug
```

### Switch to Real Auth (Future)

```env
# User Service
PORT=4001
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://prod-db:27017/atoss_gpt_users

# Real Authentication
MOCK_AUTH=false
JWT_SECRET=production-secret-key
JWT_ISSUER=https://auth-service.example.com

# Log Level
LOG_LEVEL=info
```

**Middleware automatically adapts** based on `MOCK_AUTH` flag.

## Security Considerations

### Mock Auth (Development Only)

⚠️ **WARNING**: Mock auth is for development only.

- No signature verification
- Token content not encrypted
- Any token format accepted
- Suitable for local testing only

### Production Constraints

- Never deploy with `MOCK_AUTH=true` in production
- Require JWT signature verification in production
- Validate token issuer and audience
- Implement token expiration and refresh
- Use HTTPS for all token transmission

## Logging & Audit Trail

### Mock Auth Logging

```javascript
// All requests logged with role info
{
  timestamp: "2025-11-08T10:30:45.123Z",
  operation: "CREATE",
  role: "admin",
  identifier: "admin123",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  status: "success",
  durationMs: 145
}
```

### Includes for Testing

- Role extracted from token
- Operation type
- Affected resource
- Success/error status
- Request duration

