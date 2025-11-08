# Research: User Microservice Implementation

**Feature**: 007-user-microservice  
**Date**: 2025-11-08  
**Status**: Complete

## Context from Existing Implementation

### Auth Service Reference (from authREADME.md)

The ATOSS.GPT project already has:

**Implemented Features**:
- Complete authentication backend (login, register, logout, token refresh)
- JWT-based token authentication with refresh token mechanism
- MongoDB database with UserCredentials schema
- API Gateway for routing to microservices
- Password hashing with bcrypt (10 salt rounds)
- Role-based access control (Staff, Admin)
- Department-based organization (3 departments)
- Postman collection for API testing

**Data Model** (UserCredentials):
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

**API Gateway Routing**:
- `/auth/*` → Authentication Microservice (port 4000, local)
- `/users/*` → User Service (port 4001, needs implementation)
- `/chat/*` → Chatbot Service (port 4002, future)
- `/learning/*` → Learning Service (port 4003, future)

**Auth Service Endpoints**:
- POST `/auth/register` - Register new user
- POST `/auth/login` - Authenticate and receive JWT
- POST `/auth/logout` - Logout and invalidate tokens
- POST `/auth/refresh` - Refresh access token
- GET `/auth/verify` - Verify JWT token validity

**Auth Service Environment Variables**:
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-change-in-production
USER_SERVICE_URL=http://localhost:4001
CHATBOT_SERVICE_URL=http://localhost:4002
LEARNING_SERVICE_URL=http://localhost:4003
```

### Key Integration Notes

1. **Separate Concerns**: Auth Service handles credentials and JWT tokens; User Service handles profile data
2. **Database Separation**: Auth Service uses `atoss_gpt_auth` database; User Service should use separate database (e.g., `atoss_gpt_users`)
3. **Verification Endpoint**: Auth Service references a User Service `/users/{userId}/verify` endpoint for checking user existence (integration point)
4. **JWT Validation**: User Service will validate JWT tokens from Auth Service in protected routes (future integration)

## Architecture Decisions

### Independent Implementation Strategy

For this phase:
- **User Service runs independently** on port 4001
- **Mock authentication** using a simple bearer token pattern or bypass for testing
- **Real JWT integration** will happen in subsequent phase after Auth Service coordination
- **Database**: Separate MongoDB database for User Service data (not shared with Auth Service)

### Project Structure

Standard MERN microservice structure with clear separation per Constitution Principle VII (SRP):
```
user-service/
├── config/
│   └── database.js          # MongoDB connection for user data
├── controllers/
│   └── UserController.js    # HTTP request handlers
├── middleware/
│   ├── authMiddleware.js    # Mock auth or token validation
│   └── errorHandler.js      # Error handling
├── models/
│   └── User.js              # User profile schema (Mongoose)
├── routes/
│   └── userRoutes.js        # API routes
├── services/
│   └── UserService.js       # Business logic
├── utils/
│   ├── validators.js        # Input validation
│   └── logger.js            # Logging
├── index.js                 # Server entry point
└── package.json
```

### Technology Stack (Per Constitution)

**Required (MERN Stack)**:
- Node.js runtime
- Express.js (v5.x+)
- MongoDB (separate database instance)
- Mongoose ODM for data access

**Security**:
- bcryptjs (v2.4.3+) for password hashing (10 salt rounds minimum)
- jsonwebtoken for future JWT validation

**Development**:
- dotenv for environment configuration
- nodemon for development auto-reload

### Data Model Design

User Profile entity based on Auth Service UserCredentials but focused on profile-specific data:
- Core fields: id, email, role, department (required)
- Profile fields: firstName, lastName (optional)
- Metadata: active, lastLogin, createdAt, updatedAt
- No password storage in User Service (Auth Service responsibility)
- No JWT tokens in User Service (Auth Service responsibility)

### API Contract

All responses follow consistent JSON format:
```json
{
  "success": true/false,
  "data": {...} or null,
  "error": null or "error message"
}
```

HTTP Status Codes:
- 200: Success (GET, PUT, successful operations)
- 201: Created (POST successful)
- 204: No Content (DELETE successful)
- 400: Bad Request (validation errors)
- 404: Not Found (resource doesn't exist)
- 409: Conflict (email already exists, constraint violation)
- 500: Internal Server Error

## Testing Strategy

### Mock Authentication (MVP Phase)

For independent development without Auth Service dependency:
1. Simple bearer token middleware that accepts any token
2. Optional JWT validation when Auth Service is available
3. Environment flag: `MOCK_AUTH=true` for development

### Manual Testing

Using Postman or similar tools to test:
1. Create user (POST `/users`)
2. Retrieve user (GET `/users/{id}`)
3. Update user (PUT `/users/{id}`)
4. Delete user (DELETE `/users/{id}`)
5. List users with filters (GET `/users?role=Staff`)
6. Error cases (duplicate email, missing fields, not found)

### Data Validation

Test validation at API level:
- Email format validation
- Required field presence
- Allowed enumeration values (role, department)
- Email uniqueness enforcement
- Proper error messages returned

## Known Constraints

1. **Database Connection**: Requires MongoDB running (development: localhost:27017)
2. **Port Configuration**: User Service port 4001, API Gateway port 4000
3. **Enumeration Values**: Roles (Staff, Admin), Departments (Department 1, 2, 3) fixed set
4. **Email Uniqueness**: Database-level unique index required
5. **Password Handling**: In MVP, User Service does NOT handle passwords (Auth Service responsibility)

## Dependencies on Auth Service (Future Integration)

These will be implemented in a subsequent feature/phase:
1. JWT validation middleware using Auth Service's JWT_SECRET
2. User verification endpoint: GET `/users/{userId}/verify` called by Auth Service
3. Consistent authentication flow with Auth Service tokens

## Environment Configuration Template

```env
# User Service Configuration
PORT=4001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_users

# Mock Authentication (set to false when Auth Service ready)
MOCK_AUTH=true

# Logging
LOG_LEVEL=info

# CORS (for API Gateway)
CORS_ORIGIN=http://localhost:4000

# Rate Limiting (future implementation)
RATE_LIMIT_ENABLED=false
```

