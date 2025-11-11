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

### Test 1: Create User

```bash
curl -X POST http://localhost:4001/users \
  -H "Authorization: Bearer admin:admin123" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePass123!",
    "role": "Staff",
    "department": "Department 1",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Expected: HTTP 201, user object with id

### Test 2: Get User

```bash
# Replace {userId} with ID from previous response
curl -X GET http://localhost:4001/users/{userId} \
  -H "Authorization: Bearer admin:admin123"
```

Expected: HTTP 200, same user data

### Test 3: List Users

```bash
curl -X GET "http://localhost:4001/users?role=Staff" \
  -H "Authorization: Bearer admin:admin123"
```

Expected: HTTP 200, array with user(s)

### Test 4: Update User

```bash
curl -X PUT http://localhost:4001/users/{userId} \
  -H "Authorization: Bearer admin:admin123" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jonathan"
  }'
```

Expected: HTTP 200, updated user data

### Test 5: Delete User (Soft-Delete)

```bash
curl -X DELETE http://localhost:4001/users/{userId} \
  -H "Authorization: Bearer admin:admin123"
```

Expected: HTTP 204 No Content

### Test 6: Verify Deletion

```bash
curl -X GET http://localhost:4001/users/{userId} \
  -H "Authorization: Bearer admin:admin123"
```

Expected: HTTP 404 (user now inactive)

## Mock Auth Testing

### Test Without Auth

```bash
curl -X GET http://localhost:4001/users
# Returns: 401 ERR_UNAUTHORIZED
```

### Test with Different Roles

```bash
# Admin
curl -X GET http://localhost:4001/users \
  -H "Authorization: Bearer admin:admin123"

# Staff
curl -X GET http://localhost:4001/users \
  -H "Authorization: Bearer staff:user456"
```

Both return users (authorization details deferred to implementation phase).

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

## Performance Baselines

Monitor locally:

```bash
# Response time for create
time curl -X POST http://localhost:4001/users \
  -H "Authorization: Bearer admin:admin123" \
  -H "Content-Type: application/json" \
  -d '...'
# Target: < 2 seconds

# Response time for list (1000 users)
time curl -X GET "http://localhost:4001/users?limit=100" \
  -H "Authorization: Bearer admin:admin123"
# Target: < 500ms
```

## Resources

- **Specification**: `/specs/007-user-microservice/spec.md`
- **Data Model**: `/specs/007-user-microservice/data-model.md`
- **API Contracts**: `/specs/007-user-microservice/contracts/`
- **Plan**: `/specs/007-user-microservice/plan.md`
- **Tasks**: `/specs/007-user-microservice/tasks.md` (next: `/speckit.tasks`)

