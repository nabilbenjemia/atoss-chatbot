# Quickstart: User Microservice Development

**Feature**: 007-user-microservice  
**Date**: 2025-11-08  
**Duration**: ~30 minutes setup

## Prerequisites

- Node.js 20.x LTS or later (local dev; container runs Node 20 even if host uses 25)
- npm 9.x or later  
- Docker Desktop & Docker Compose (for MongoDB + service)
- Git (for version control)
- Postman (for API testing, optional)

## Quick Setup (5 minutes)

### 1. Clone & Navigate

```bash
cd /path/to/atoss.gpt
git checkout feature/007-user-microservice
```

### 2. Install Dependencies (Local Dev)

```powershell
cd backend/user-service
npm install
```

For reproducible CI builds use:
```powershell
npm ci
```

### 3. Environment Configuration

```bash
# Copy template
cp .env.example .env

# Verify contents
cat .env
```

Expected `.env`:
```env
PORT=4001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_users
MOCK_AUTH=true
LOG_LEVEL=debug
```

### 4. Start Services (Docker)

Ensure Docker Desktop is running first.

```powershell
# From repository root
cd /path/to/atoss.gpt
docker compose up -d mongodb

# (Optional) build user-service image explicitly
docker build -t atoss-user-service ./backend/user-service

# Start user-service (will rebuild with dev deps via build args)
docker compose up -d user-service

# Verify MongoDB is running
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr atoss_gpt_mongodb
```

Image tag change note: switched from `mongo:6.0-alpine` (no longer published) to `mongo:6.0`.

### 5. Start User Service (Alternative Local Mode)

If you prefer not to use Docker for the service (only Mongo in container):
```powershell
cd backend/user-service
npm run dev
```

Expected output (once Mongo is reachable):
```
[SUCCESS] MongoDB connected: atoss_gpt_users
[SUCCESS] User Service running on http://localhost:4001
```

## Testing (10 minutes)

### Test 1: Create User (PowerShell)

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:4001/health" -Method GET

$base = 'http://localhost:4001'
$adminHeaders = @{ Authorization = 'Bearer Admin:admin123'; 'Content-Type' = 'application/json' }

# Create user (201)
$body = @{
  email = "john@example.com"
  password = "securePass123!"
  role = "Staff"
  department = "Department 1"
  firstName = "John"
  lastName = "Doe"
} | ConvertTo-Json
$create = Invoke-RestMethod -Method POST -Uri "$base/users" -Headers $adminHeaders -Body $body
$create | Format-List

# Get user (200)
$uid = $create.data.id
Invoke-RestMethod -Method GET -Uri "$base/users/$uid" -Headers @{ Authorization = 'Bearer Admin:admin123' }
```

### Test 1b: Duplicate Email → Expect 409 (PowerShell)

```powershell
$base = 'http://localhost:4001'
$headers = @{ Authorization = 'Bearer Admin:admin123'; 'Content-Type' = 'application/json' }
$email = "dup_test_$([int](Get-Date -UFormat %s))@example.com"
$payload = @{
  email = $email
  password = "Passw0rd!"
  role = "Staff"
  department = "Department 1"
  firstName = "Dup"
  lastName = "Test"
} | ConvertTo-Json -Depth 10

Write-Host "Creating first user: $email"
try {
  $created = Invoke-RestMethod -Method POST -Uri "$base/users" -Headers $headers -Body $payload -ErrorAction Stop
  Write-Host "Create 1: OK (201). id=$($created.data.id)"
} catch {
  $resp = $_.Exception.Response
  if ($resp) { Write-Host "Create 1 failed with status:" $resp.StatusCode.value__ } else { Write-Host "Create 1 error:" $_; exit 1 }
  exit 1
}

Write-Host "Attempting duplicate create (expect 409)"
try {
  Invoke-RestMethod -Method POST -Uri "$base/users" -Headers $headers -Body $payload -ErrorAction Stop
  Write-Host "FAIL: Duplicate was created unexpectedly."
  exit 1
} catch {
  $resp = $_.Exception.Response
  if (-not $resp) { Write-Host "FAIL: No HTTP response (network error)"; exit 1 }
  $status = $resp.StatusCode.value__
  if ($status -eq 409) { Write-Host "PASS: Duplicate create returned 409 Conflict"; exit 0 }
  else { Write-Host "FAIL: Expected 409 but got $status"; exit 1 }
}
```



### Test 2: Get User (PowerShell)

```powershell
$base = 'http://localhost:4001'
$uid = '<replace-with-userId>'
Invoke-RestMethod -Method GET -Uri "$base/users/$uid" -Headers @{ Authorization = 'Bearer Admin:admin123' }
```

Expected: HTTP 200, same user data

### Test 3: List Users (PowerShell)

```powershell
$base = 'http://localhost:4001'
Invoke-RestMethod -Method GET -Uri "$base/users?role=Staff" -Headers @{ Authorization = 'Bearer Admin:admin123' }
```

Expected: HTTP 200, array with user(s)

### Test 4: Update User (PowerShell)

```powershell
$base = 'http://localhost:4001'
$uid = 'fea307de-f6b0-46e4-a06a-8c5ab77ece77'
$headers = @{ Authorization = 'Bearer Admin:admin123'; 'Content-Type' = 'application/json' }
$update = @{ firstName = 'Jonathan' } | ConvertTo-Json
Invoke-RestMethod -Method PUT -Uri "$base/users/$uid" -Headers $headers -Body $update

# Staff attempting to update another user → 403
$staffHeaders = @{ Authorization = 'Bearer Staff:someoneelse'; 'Content-Type' = 'application/json' }
try {
  Invoke-RestMethod -Method PUT -Uri "$base/users/$uid" -Headers $staffHeaders -Body $update -ErrorAction Stop
  Write-Host 'FAIL: Staff updated another user unexpectedly.'; exit 1
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 403) { Write-Host 'PASS: Forbidden (403) for staff updating another user.' } else { Write-Host "FAIL: Expected 403 got $status"; exit 1 }
}
```

Expected: HTTP 200 for admin update; 403 for staff unauthorized update

### Test 5: Delete User (Soft-Delete, PowerShell)

```powershell
$base = 'http://localhost:4001'
$uid = 'fea307de-f6b0-46e4-a06a-8c5ab77ece77'

# Use Invoke-WebRequest to inspect status code 204
$resp = Invoke-WebRequest -Method DELETE -Uri "$base/users/$uid" -Headers @{ Authorization = 'Bearer Admin:admin123' } -ErrorAction Stop
if ($resp.StatusCode -eq 204) { Write-Host 'PASS: Delete returned 204 No Content' } else { Write-Host "FAIL: Expected 204 got $($resp.StatusCode)"; exit 1 }

# Staff attempting delete → 403
try {
  Invoke-WebRequest -Method DELETE -Uri "$base/users/$uid" -Headers @{ Authorization = 'Bearer Staff:$uid' } -ErrorAction Stop | Out-Null
  Write-Host 'FAIL: Staff deleted user unexpectedly.'; exit 1
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 403) { Write-Host 'PASS: Forbidden (403) for staff delete.' } else { Write-Host "FAIL: Expected 403 got $status"; exit 1 }
}
```

### Test 6: Verify Deletion (PowerShell)

```powershell
$base = 'http://localhost:4001'
$uid = '<replace-with-userId>'
try {
  Invoke-RestMethod -Method GET -Uri "$base/users/$uid" -Headers @{ Authorization = 'Bearer Admin:admin123' } -ErrorAction Stop | Out-Null
  Write-Host 'FAIL: Expected 404 after soft-delete but got 200'; exit 1
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 404) { Write-Host 'PASS: GET after delete returned 404 Not Found' } else { Write-Host "FAIL: Expected 404 got $status"; exit 1 }
}
```

## Mock Auth Testing

### Test Without Auth (PowerShell)

```powershell
try {
  Invoke-RestMethod -Method GET -Uri 'http://localhost:4001/users' -ErrorAction Stop | Out-Null
  Write-Host 'FAIL: Expected 401 without auth'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 401) { Write-Host 'PASS: 401 without auth' } else { Write-Host "FAIL: Expected 401 got $status" }
}
```

### Test with Different Roles (PowerShell)

```powershell
# Admin
Invoke-RestMethod -Method GET -Uri 'http://localhost:4001/users' -Headers @{ Authorization = 'Bearer Admin:admin123' }

# Staff
Invoke-RestMethod -Method GET -Uri 'http://localhost:4001/users' -Headers @{ Authorization = 'Bearer Staff:user456' }
```

Both should return data (list endpoint may require implementation in US4 phase).

## Mock Frontend Testing

### Start Frontend (Optional)

```bash
cd frontend/mock-auth
npm install
npm start
```

Expected: React app opens at `http://localhost:3000`

### Login Flow

1. Click "Login as Admin" or "Login as Staff"
2. Redirected to `/profile` page
3. Can see CRUD buttons for testing
4. All API calls use mock auth token

## Docker Compose Details

### Service Architecture

```yaml
services:
  user-service:     # Port 4001 - Node.js User Service
  mongodb:          # Port 27017 - MongoDB database
  frontend-mock:    # Port 3000 - React mock login/profile
```

### Volume Mapping

```bash
# MongoDB data persists across restarts
docker volume ls | grep mongo-data

# View logs
docker-compose logs -f user-service
docker-compose logs -f mongodb
```

### Cleanup

```bash
# Stop services
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```

## Development Workflow

### Auto-Reload

```bash
# From backend/user-service
npm run dev
```

Changes to source files auto-reload the server.

### Debugging

Enable debug logs:
```bash
LOG_LEVEL=debug npm run dev
```

View request/response details and authorization checks.

### Database Inspection

```bash
# Connect to MongoDB shell
docker exec -it mongodb mongosh

# Show databases
show dbs

# Switch to app database
use atoss_gpt_users

# View collections
show collections

# Query users
db.users.find({})

# Count active users
db.users.countDocuments({active: true})
```

## File Structure

```
backend/user-service/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── environment.js       # Env loading
│   ├── controllers/
│   │   └── UserController.js    # Request handlers
│   ├── services/
│   │   ├── UserService.js       # Business logic
│   │   └── AuthService.js       # Mock auth
│   ├── models/
│   │   └── User.js              # Mongoose schema
│   ├── middleware/
│   │   ├── authMiddleware.js    # Auth validation
│   │   ├── errorHandler.js      # Error handling
│   │   └── validationMiddleware.js
│   ├── utils/
│   │   ├── validators.js
│   │   ├── logger.js
│   │   └── constants.js
│   ├── routes/
│   │   └── userRoutes.js        # API routes
│   └── index.js                 # Entry point
├── .env.example
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Postman Collection

### Import Collection

1. Open Postman
2. File → Import → Select `User-Microservice.postman_collection.json`
3. Environment variables:
   - `base_url`: `http://localhost:4001`
   - `auth_admin`: `Bearer admin:admin123`
   - `auth_staff`: `Bearer staff:user456`

### Pre-Built Requests

- ✅ Create User (Admin)
- ✅ Get User by ID
- ✅ Update User
- ✅ Delete User (Soft-Delete)
- ✅ List All Users
- ✅ List by Role
- ✅ List by Department
- ✅ Verify User Exists

## Troubleshooting

### Port Already in Use

```powershell
netstat -ano | findstr :4001
taskkill /PID <PID> /F
```

### MongoDB Connection Failed

```powershell
# Check if MongoDB container is running
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr atoss_gpt_mongodb

# Restart MongoDB
docker compose restart mongodb

# Check logs
docker compose logs -f mongodb
```

### Invalid Token Error

Ensure Authorization header format:
```
Authorization: Bearer admin:admin123
                      ↑         ↑
                    role    identifier
```

### Database Empty

Reset database:
```powershell
docker compose down -v
docker compose up -d mongodb
```

## Next Steps

1. ✅ Development setup complete
2. → Review `spec.md` for full feature requirements
3. → Review `data-model.md` for schema details
4. → Review `contracts/` for API specifications
5. → Follow `tasks.md` for implementation phases

### Performance Baselines

Monitor locally (PowerShell approximate):

```powershell
$base = 'http://localhost:4001'
$headers = @{ Authorization = 'Bearer Admin:admin123'; 'Content-Type' = 'application/json' }

$payload = @{ email='perf@example.com'; password='PerfPass123!'; role='Staff'; department='Department 1'; firstName='Perf'; lastName='Test' } | ConvertTo-Json
$sw = [System.Diagnostics.Stopwatch]::StartNew()
Invoke-RestMethod -Method POST -Uri "$base/users" -Headers $headers -Body $payload | Out-Null
$sw.Stop(); Write-Host "Create time: $($sw.ElapsedMilliseconds) ms (target < 2000 ms)"

$sw.Reset(); $sw.Start()
Invoke-RestMethod -Method GET -Uri "$base/users?limit=100" -Headers @{ Authorization = 'Bearer Admin:admin123' } | Out-Null
$sw.Stop(); Write-Host "List time: $($sw.ElapsedMilliseconds) ms (target < 500 ms)"
```

## Resources

- **Specification**: `/specs/007-user-microservice/spec.md`
- **Data Model**: `/specs/007-user-microservice/data-model.md`
- **API Contracts**: `/specs/007-user-microservice/contracts/`
- **Plan**: `/specs/007-user-microservice/plan.md`
- **Tasks**: `/specs/007-user-microservice/tasks.md` (next: `/speckit.tasks`)

