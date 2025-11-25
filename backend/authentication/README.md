# ATOSS.GPT - Authentication Microservice & API Gateway

This document describes the Authentication Microservice and API Gateway implementation for the ATOSS.GPT project.

## Architecture Overview

The backend consists of:
- **Authentication Microservice**: Handles user authentication, JWT token generation, and user credential management
- **API Gateway**: Routes requests to appropriate microservices (`/auth/*`, `/users/*`, `/chat/*`, `/learning/*`)

## Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   └── AuthController.js    # HTTP request handlers for authentication
├── gateway/
│   └── apiGateway.js        # API Gateway routing logic
├── middleware/
│   ├── authMiddleware.js    # Authentication middleware for protected routes
│   └── gatewayMiddleware.js # Gateway authentication middleware
├── models/
│   ├── UserCredentials.js   # User credentials database schema
│   ├── Role.js              # Role enumeration (Staff, Admin)
│   └── Department.js        # Department enumeration
├── routes/
│   └── authRoutes.js        # Authentication route definitions
├── services/
│   └── AuthService.js       # Core authentication business logic
├── index.js                 # Main server entry point
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
PORT=4000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_auth

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-change-in-production

# Microservice URLs
USER_SERVICE_URL=http://localhost:4001
CHATBOT_SERVICE_URL=http://localhost:4002
LEARNING_SERVICE_URL=http://localhost:4003
```

### 3. Start MongoDB

Ensure MongoDB is running on your system:

```bash
# macOS (using Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on port 4000 (or the port specified in `.env`).

## API Endpoints

### Authentication Endpoints

All authentication endpoints are prefixed with `/auth`.

#### POST `/auth/register`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "Staff",
  "department": "Department 1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "Staff",
    "department": "Department 1"
  }
}
```

#### POST `/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "Staff",
      "department": "Department 1"
    }
  }
}
```

#### POST `/auth/logout`
Logout user and invalidate tokens.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### POST `/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-access-token"
  }
}
```

#### GET `/auth/verify`
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "Staff",
    "department": "Department 1"
  }
}
```

### API Gateway Routes

The API Gateway routes requests to appropriate microservices:

- `/auth/*` → Authentication Microservice (local)
- `/users/*` → User Service (proxied)
- `/chat/*` → Chatbot Service (proxied)
- `/learning/*` → Learning Service (proxied)

### Health Check

#### GET `/api/health`
Check API Gateway health status.

**Response:**
```json
{
  "status": "ok",
  "service": "API Gateway",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Authentication Flow

1. **Registration**: User registers with email, password, role, and department
2. **Login**: User provides credentials and receives JWT access token and refresh token
3. **Protected Routes**: Include `Authorization: Bearer <token>` header in requests
4. **Token Refresh**: Use refresh token to obtain new access token when expired
5. **Logout**: Invalidates tokens stored in database

## Data Models

### UserCredentials

Based on the UML diagram, the UserCredentials model includes:

- `id`: UUID (unique identifier)
- `email`: String (unique, lowercase)
- `passwordHash`: String (bcrypt hashed)
- `role`: Enum (Staff, Admin)
- `department`: Enum (Department 1, Department 2, Department 3)
- `token`: String (current JWT token)
- `refreshToken`: String (refresh token)
- `lastLogin`: Date
- `createdAt`: Date
- `updatedAt`: Date

### Role Enumeration

- `Staff`: Regular staff member
- `Admin`: Administrator with elevated privileges

### Department Enumeration

- `Department 1`
- `Department 2`
- `Department 3`

## Integration with User Service

The Authentication Service communicates with the User Service to verify user existence during login. The verification endpoint should be:

```
GET /users/{userId}/verify
```

Expected response:
```json
{
  "exists": true
}
```

If the User Service is unavailable, authentication will proceed with a warning (fallback mechanism).

## Security Features

- Password hashing using bcrypt (10 salt rounds)
- JWT token-based authentication
- Refresh token mechanism for token renewal
- Token invalidation on logout
- Protected route middleware
- CORS enabled for cross-origin requests

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `404`: Not Found
- `500`: Internal Server Error
- `502`: Bad Gateway (service unavailable)

## Development Notes

- The API Gateway uses `express-http-proxy` for routing to other microservices
- Authentication middleware is applied globally except for public routes
- MongoDB connection is established on server startup
- All timestamps are stored in UTC

## Next Steps

1. Implement User Service with `/users/{userId}/verify` endpoint
2. Set up Chatbot Service on port 4002
3. Set up Learning Service on port 4003
4. Configure production environment variables
5. Add rate limiting for authentication endpoints
6. Implement request logging and monitoring

