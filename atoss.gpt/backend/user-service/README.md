# User Service (User Microservice)

Backend microservice for user profile management with Create, Read, Update, Delete (soft-delete) and mock authentication.

- Tech: Node.js 18+, Express 5, Mongoose 8, MongoDB 6
- Port: 4001 (http://localhost:4001)
- Database: MongoDB (database: `atoss_gpt_users`)
- Auth: Mock tokens in header `Authorization: Bearer <role>:<identifier>` (Admin/Staff)

## Prerequisites

- Node.js 18+ and npm 9+
- Docker Desktop (for MongoDB)
- Git (optional)

## Setup

1) Install dependencies

```powershell
cd backend/user-service
npm install
```

2) Environment

Copy and configure environment variables:

```powershell
Copy-Item .env.example .env
```

Default values (adjust as needed):

```
PORT=4001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=atoss_gpt_users
LOG_LEVEL=info
```

3) Start MongoDB (Docker)

```powershell
# From repository root
docker compose up -d mongodb
```

4) Run the service (local dev)

```powershell
cd backend/user-service
npm run dev
```

Health check:

- GET http://localhost:4001/health

## Mock Authentication

Use the Authorization header with this format:

```
Authorization: Bearer Admin:admin123
Authorization: Bearer Staff:user456
```

- Admin can update/delete any user
- Staff can only update their own user (mock assumption: identifier === userId for self-updates)

## Endpoints

- POST /users — Create user (Admin/Staff)
- GET /users/{userId} — Get by id (Admin/Staff)
- PUT /users/{userId} — Update user (Admin any, Staff self-only)
- DELETE /users/{userId} — Soft-delete user (Admin only)
- GET /users — List users (filters: role, department; pagination: limit, offset)

Response format (success):

```json
{ "success": true, "data": { /* ... */ } }
```

Response format (error):

```json
{ "success": false, "data": null, "error": "message", "code": "ERROR_CODE", "timestamp": "..." }
```

## Postman Collection

A ready-to-use collection is included:

- File: `tests/postman/User-Microservice.postman_collection.json`
- Variables:
  - base_url = http://localhost:4001
  - auth_admin = Bearer Admin:admin123
  - auth_staff = Bearer Staff:user456

Import the collection in Postman and run requests in order:
1. Health
2. Create User (Admin) — saves `userId` automatically for subsequent calls
3. Get User by ID (Admin)
4. Create User Duplicate Email (409)
5. Update User (Admin)
6. Update User (Staff forbidden)
7. List Users (role=Staff)
8. Delete User (Admin)
9. Get After Delete (404)

## Logs and Auditing

- Logs directory: `backend/user-service/logs`
- Logged operations: createUser, getUser, updateUser, softDeleteUser, listUsers
- Log format (JSON): { timestamp, level, message, operation, authRole, userId, targetUserId, status, error, durationMs }

## Docker Compose

Start service fully in Docker (optional):

```powershell
# From repository root
docker compose up -d
```

Containers:
- atoss_gpt_mongodb (MongoDB 6)
- atoss_user_service (User Service)

## Troubleshooting

- Port in use: find & kill process

```powershell
netstat -ano | findstr :4001
# Then kill the PID
```

- Mongo connection failed:
  - Verify container is running: `docker ps`
  - Restart: `docker compose restart mongodb`
  - Check logs: `docker compose logs -f mongodb`

- Unauthorized / invalid token:
  - Ensure header format: `Authorization: Bearer Admin:admin123`

- View data (MongoDB documents):
  - `docker exec -it atoss_gpt_mongodb mongosh`
  - `use atoss_gpt_users`
  - `db.users.find({ active: true }, { passwordHash: 0 }).limit(10).pretty()`

## Project Structure (backend/user-service)

```
src/
  config/
  controllers/
  services/
  models/
  middleware/
  utils/
  routes/
logs/
.env.example
package.json
Dockerfile
```
