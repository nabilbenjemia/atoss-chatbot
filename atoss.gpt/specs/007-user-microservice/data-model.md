# Data Model: User Microservice

**Feature**: 007-user-microservice  
**Date**: 2025-11-08  
**Version**: 1.0.0

## Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│         User Profile                │
├─────────────────────────────────────┤
│ PK: id (UUID)                       │
│ ──────────────────────────────────  │
│ email (String, unique, required)    │
│ passwordHash (String, required)     │
│ role (Enum: Staff|Admin)            │
│ department (Enum: Department 1|Department 2|Department 3) │
│ firstName (String, optional)        │
│ lastName (String, optional)         │
│ active (Boolean, default: true)     │
│ lastLogin (Date, optional)          │
│ createdAt (Date, UTC)               │
│ updatedAt (Date, UTC)               │
└─────────────────────────────────────┘
```

## MongoDB Schema

### Collection: `users`

```javascript
// Mongoose Schema Definition
{
  _id: ObjectId,                    // MongoDB auto-generated primary key
  id: String,                       // UUID v4 (application-level ID)
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/  // Email format validation
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 60                   // bcryptjs hash length
  },
  role: {
    type: String,
    enum: ["Staff", "Admin"],
    required: true,
    default: "Staff",
    index: true
  },
  department: {
    type: String,
    enum: ["Department 1", "Department 2", "Department 3"],
    required: true,
    index: true
  },
  firstName: {
    type: String,
    optional: true,
    trim: true,
    maxlength: 100
  },
  lastName: {
    type: String,
    optional: true,
    trim: true,
    maxlength: 100
  },
  active: {
    type: Boolean,
    default: true,
    index: true                     // Support soft-delete queries
  },
  lastLogin: {
    type: Date,
    optional: true,
    default: null
  },
  createdAt: {
    type: Date,
    default: () => new Date(Date.now()),
    immutable: true                 // Cannot be modified after creation
  },
  updatedAt: {
    type: Date,
    default: () => new Date(Date.now())
  }
}
```

### Indexes

```javascript
// Index Strategy for Query Performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, active: 1 });
db.users.createIndex({ department: 1, active: 1 });
db.users.createIndex({ active: 1 });
db.users.createIndex({ createdAt: 1 });
```

**Index Rationale**:
- `email (unique)`: Enforce email uniqueness, speed up login/email checks
- `role + active`: Support role-based list queries on active users
- `department + active`: Support department filtering on active users
- `active`: Support soft-delete filtering (critical for all reads)
- `createdAt`: Support audit trail queries, sorting

### Relationships

**No direct relationships** (microservices pattern):
- User Service maintains only user data
- Auth Service (external) maintains credentials/tokens
- Relationships to other microservices (Chatbot, Learning) are managed via API calls, not foreign keys

---

## Validation Rules

### Field-Level Validation

| Field | Validation Rule | Error Message |
|-------|-----------------|---------------|
| `email` | Required, unique, lowercase, valid email format | `ERR_INVALID_EMAIL` or `ERR_EMAIL_EXISTS` |
| `passwordHash` | Required, ≥60 chars (bcryptjs), non-empty | `ERR_INVALID_PASSWORD_HASH` |
| `role` | Required, enum: Staff\|Admin | `ERR_INVALID_ROLE` |
| `department` | Required, enum: Department 1\|Department 2\|Department 3 | `ERR_INVALID_DEPARTMENT` |
| `firstName` | Optional, string, max 100 chars | `ERR_INVALID_FIRSTNAME` |
| `lastName` | Optional, string, max 100 chars | `ERR_INVALID_LASTNAME` |
| `active` | Boolean, default true | `ERR_INVALID_ACTIVE_FLAG` |
| `lastLogin` | Optional, ISO 8601 date format | `ERR_INVALID_DATE` |

### State Transitions

```
┌─────────────────────────────────────────────────────┐
│              User State Lifecycle                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  CREATE → [Active User]                             │
│           ↓              ↑                           │
│         [UPDATE]     [REACTIVATE] (future)           │
│           ↓                                          │
│  DELETE → [Inactive User] (soft-delete, active=false)
│                                                       │
│  Rules:                                              │
│  • Active = true: User can login, appears in lists   │
│  • Active = false: User invisible, 404 on GET        │
│  • Transition: Active → Inactive only (DELETE)       │
│  • No direct Inactive → Active (hard delete only)    │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Query Filters for Soft-Delete

**Default Query Filter** (applied to all reads):
```javascript
// All GET operations automatically filter inactive users
query: { active: true }
```

**Affected Operations**:
- GET `/users/{userId}` - Returns 404 if `active: false`
- GET `/users` - Excludes `active: false` from results
- GET `/users/{userId}/verify` - Returns `exists: false` if `active: false`

**Bypass** (admin-only audit operations, future):
- Explicit `?includeInactive=true` for admin API (future enhancement)

---

## Data Lifecycle

### Creation Flow

```
1. POST /users
   ↓
2. Validate input (email format, required fields, enums)
   ↓
3. Check email uniqueness (query for existing, return 409 if found)
   ↓
4. Hash password with bcryptjs (10 salt rounds)
   ↓
5. Create User document:
   - id: UUID v4
   - email: lowercase(input)
   - passwordHash: hashed
   - role, department: from input
   - firstName, lastName: from input (optional)
   - active: true (default)
   - createdAt: now()
   - updatedAt: now()
   ↓
6. Save to MongoDB
   ↓
7. Return 201 with user data (excluding passwordHash)
```

### Read Flow

```
1. GET /users/{userId}
   ↓
2. Query: { id: userId, active: true }
   ↓
3. Document found?
   YES → Return 200 with user data
   NO  → Return 404 (user not found or inactive)
   ↓
4. Exclude passwordHash from response
```

### Update Flow

```
1. PUT /users/{userId}
   ↓
2. Parse authorization token (role extraction)
   ↓
3. Check authorization (defer detailed rules to service layer)
   ↓
4. Validate input (email, role, department if provided)
   ↓
5. Check email uniqueness if email field modified (exclude current user)
   ↓
6. Update fields (if email: set to lowercase, update updatedAt: now())
   ↓
7. Reject if target user inactive (active: false) → Return 404
   ↓
8. Save to MongoDB, return 200 with updated data
```

### Delete Flow (Soft-Delete)

```
1. DELETE /users/{userId}
   ↓
2. Parse authorization token
   ↓
3. Check authorization (admin or self, defer to service)
   ↓
4. Query user by ID
   ↓
5. User found and active?
   YES → Set active: false, updatedAt: now()
   NO  → Return 404
   ↓
6. Save to MongoDB, return 204 (no content)
```

### List Flow

```
1. GET /users?role=Staff&department=Department%201&limit=10&offset=0
   ↓
2. Build query: { active: true, ...filters }
   ↓
3. Execute: db.users.find(query).skip(offset).limit(limit)
   ↓
4. Return 200 with paginated results (exclude passwordHash)
```

---

## MongoDB Connection & Initialization

### Connection String

```
mongodb://localhost:27017/atoss_gpt_users
```

**Environment Variable**:
```env
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_users
```

### Database Initialization

```javascript
// src/config/database.js - Initialize indexes on startup

async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Create indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1, active: 1 });
    await User.collection.createIndex({ department: 1, active: 1 });
    await User.collection.createIndex({ active: 1 });
    await User.collection.createIndex({ createdAt: 1 });
    
    console.log("Database indexes created/verified");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
```

### Mongoose Model Initialization

```javascript
// src/models/User.js - Mongoose Schema Definition

const userSchema = new Schema({
  id: { type: String, unique: true, required: true },
  email: { type: String, unique: true, lowercase: true, required: true },
  passwordHash: { type: String, required: true, minlength: 60 },
  role: { type: String, enum: ["Staff", "Admin"], required: true, default: "Staff" },
  department: { type: String, enum: ["Department 1", "Department 2", "Department 3"], required: true },
  firstName: { type: String, maxlength: 100 },
  lastName: { type: String, maxlength: 100 },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware: Auto-update updatedAt on save
userSchema.pre('findByIdAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

const User = mongoose.model('User', userSchema);
```

---

## Audit Trail & Logging

### Audit Log Entry Format

```javascript
{
  timestamp: "2025-11-08T10:30:45.123Z",     // ISO 8601, UTC
  operation: "CREATE|READ|UPDATE|DELETE",
  role: "admin|staff",
  userId: "operation-performer-id",
  targetUserId: "affected-user-id",
  changes: {                                  // For UPDATE only
    email: { old: "old@example.com", new: "new@example.com" },
    role: { old: "Staff", new: "Admin" }
  },
  status: "success|error",
  errorCode: "ERROR_CODE_IF_FAILED",
  durationMs: 145
}
```

**Logged to**: Console (development) + File (production, future: ELK/DataDog)

---

## Data Consistency & Integrity

### Uniqueness Constraints

1. **Email Uniqueness**: 
   - MongoDB unique index on `email`
   - Return HTTP 409 Conflict if duplicate on create/update

2. **ID Uniqueness**:
   - UUID v4 generated per record (probability of collision: ~0)

### Referential Integrity

- **No foreign keys** within User Service (microservices pattern)
- External references (Auth Service, other services) managed via API contracts
- Cascade deletes not applicable (no child entities in User Service)

### Transactionality

- **Single-document transactions**: ACID guaranteed by MongoDB
- **Multi-document operations**: Not required for User Service MVP
- **Soft-delete consistency**: Atomic update (set `active: false`)

---

## Performance Considerations

### Indexed Queries (< 100ms on 10k+ records)

```javascript
// Fast queries with indexes
db.users.find({ active: true, role: "Admin" }).limit(50);  // Uses: role + active index
db.users.find({ department: "Department 1", active: true }); // Uses: department + active index
db.users.findOne({ email: "user@example.com", active: true }); // Uses: email unique index
```

### Query Plans (MongoDB explain())

- **Create**: Single insert, no index overhead
- **Get by ID**: Fast lookup via unique index
- **List/Search**: Uses compound indexes for filtering + sorting
- **Update**: Find by ID, atomic update operation
- **Delete**: Find by ID, atomic flag update

### Pagination

```javascript
// Efficient pagination with skip + limit
db.users.find({ active: true })
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .sort({ createdAt: -1 });
```

**Recommendation**: Default limit=20, max limit=100 to prevent large dataset downloads

---

## Security & Privacy

### Password Security

- **Storage**: bcryptjs hash (min 10 salt rounds)
- **Transmission**: HTTPS only (enforced in production)
- **Not returned**: API responses never include `passwordHash`

### Data Sensitivity

- **Personally Identifiable**: email, firstName, lastName
- **Authorization-Critical**: role, department, active flag
- **Audit Trail**: All operations logged with role/user info

### Access Control

- **Soft-delete protection**: Inactive users automatically excluded from queries
- **Role-based queries**: Service layer enforces role-based permission checks (future detail)
- **JWT (future)**: Will use Auth Service tokens for validation

---

## Migration Strategy (Future Enhancements)

### From Soft-Delete to Hard-Delete + Archive

```javascript
// Phase 1: Current state (soft-delete only)
// Phase 2: Hard-delete with archive table
//   - DELETE: Create archive record, then hard delete
//   - Admin endpoint: /users/{userId}/archive (retrieve soft-deleted)
// Phase 3: Backup to S3/Archive service
```

### From Mock Auth to Real JWT

```javascript
// Phase 1: Current (mock auth parsing)
//   Middleware: Extract role from Bearer token string
// Phase 2: JWT validation
//   Middleware: Verify JWT signature, extract claims (role, userId)
// Change: Only middleware layer affected; service logic unchanged
```

### From Single-Service to Distributed Authorization

```javascript
// Phase 1: Service-level checks
// Phase 2: Centralized policy service
//   New microservice for permission matrix
//   Service calls policy service before operation
// Change: Service layer affected, controller layer unchanged
```

---

## Database Backup & Recovery

### Backup Strategy (Development)

```bash
# Backup MongoDB locally
mongodump --uri="mongodb://localhost:27017/atoss_gpt_users" \
          --out=./backups/$(date +%Y%m%d_%H%M%S)

# Restore
mongorestore --uri="mongodb://localhost:27017" ./backups/<timestamp>
```

### Production (Future)

- Cloud backup (AWS S3, GCS)
- Automated daily snapshots
- Point-in-time recovery with transaction logs

