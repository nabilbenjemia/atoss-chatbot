# ATOSS.GPT - Authentication Microservice & API Gateway

This document describes the Authentication Microservice and API Gateway implementation for the ATOSS.GPT project.

## Overview

This service provides two main functions:
- **Authentication Microservice**: Handles user authentication, JWT token generation, email verification, and user credential management
- **API Gateway**: Acts as the central entry point, routing requests to appropriate microservices and providing centralized authentication

## Architecture

The service acts as both an authentication provider and API gateway:
- Handles all `/auth/*` routes locally
- Proxies other routes (`/users/*`, `/chat/*`, `/api/conversations/*`, `/api/videos/*`) to respective microservices
- Provides centralized JWT token validation for protected routes
- Manages user sessions and credentials

## Project Structure

```
backend/authentication/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   └── AuthController.js    # HTTP request handlers for authentication
├── gateway/
│   └── apiGateway.js        # API Gateway routing configuration
├── middleware/
│   ├── authMiddleware.js    # JWT token verification middleware
│   └── gatewayMiddleware.js # Gateway-level authentication middleware
├── models/
│   ├── UserCredentials.js   # User authentication data schema
│   ├── Role.js              # User role enumeration
│   └── Department.js        # Department enumeration
├── routes/
│   └── authRoutes.js        # Authentication API routes
├── services/
│   ├── AuthService.js       # Core authentication business logic
│   └── EmailService.js      # Email verification service
├── utils/
│   └── validation.js        # Email and password validation utilities
├── ATOSS_GPT_Auth.postman_collection.json  # Postman API testing collection
├── EMAIL_VERIFICATION_SETUP.md             # Email configuration guide
├── POSTMAN_TESTING_GUIDE.md                # API testing instructions
└── index.js                 # Main application entry point
```

## Features

### Authentication
- User registration with email verification
- JWT token-based authentication
- Refresh token support
- Password validation and security
- TUM email domain validation (@tum.de, @mytum.de)

### Email Verification
- Automated verification emails on registration
- Email verification required before login
- Resend verification email functionality
- HTML email templates with branding

### User Management
- Role-based access control (Staff, Admin)
- Department assignment
- User profile management
- Password updates
- Account deletion

### API Gateway
- Centralized routing to microservices
- Authentication protection for protected routes
- Request proxying with error handling
- Health monitoring

## API Gateway Routing

The API Gateway routes requests based on URL paths:

- `/api/auth/*` → Authentication Microservice (handled locally)
- `/api/users/*` → User Service (port 4001)
- `/api/chat/*` → LLM Service (port 8000)
- `/api/conversations/*` → Conversation Service (port 4004)
- `/api/analytics/*` → Conversation Service (port 4004)
- `/api/ingestion/*` → Ingestion Service (port 4006)

## Environment Configuration

Create a `.env` file in the `backend/authentication` directory with the following variables:

```env
# Environment Variables for ATOSS.GPT Backend

# Server Configuration
PORT=4003

# MongoDB Configuration
MONGODB_URI=mongodb+srv://admin:admin@atoss-gpt.5bgviqc.mongodb.net/?appName=atoss-gpt

# JWT Configuration
JWT_SECRET=5aa9a87c6f5c37dd14342cb7e51e054ce4e08d9489841c8cd44c05d828a4ffb3
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=8cc6735e232dbf289ce329f9db7c3f78fa1a725029a1e0161f2f05828353340d

# Microservice URLs (use Docker service names)
USER_SERVICE_URL=http://user:4001
CHATBOT_SERVICE_URL=http://llm:8000
LEARNING_SERVICE_URL=http://conversation:4004

# Frontend Configuration
FRONTEND_URL=http://localhost:5173  # CORS origin
APP_URL=http://localhost:5173        # Email links

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=atossgpt@gmail.com
SMTP_PASS=ziub vwkg ggdt kabc
EMAIL_FROM=noreply@atoss-gpt.com
```

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Update configuration values

3. **Configure Email** (Optional):
   - See `EMAIL_VERIFICATION_SETUP.md` for detailed instructions
   - Without email config, verification links are logged to console

4. **Start the Service**:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Authenticate & get JWT |
| POST | `/api/auth/refresh-token` | Refresh access token |
| GET | `/api/auth/verify-email/:token` | Verify email address |
| POST | `/api/auth/resend-verification` | Resend verification email |

### Protected Endpoints (Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/logout` | Invalidate session |

### Admin Endpoints (Admin Role Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/users` | List all users |
| PUT | `/api/auth/users/:id/role` | Update user role |
| DELETE | `/api/auth/users/:id` | Delete user |

For detailed API documentation with request/response examples, see `POSTMAN_TESTING_GUIDE.md`.

## Data Models

### UserCredentials
Stores user authentication data including credentials, tokens, and verification status.

### Role Enumeration
- `Staff`: Standard user role
- `Admin`: Administrator role with elevated privileges

### Department Enumeration
- `Department 1`
- `Department 2`
- `Department 3`

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token generation with expiration
- **Email Validation**: TUM domain restriction
- **Password Strength**: Minimum requirements enforced
- **Token Verification**: Middleware protection for routes
- **Request Validation**: Input sanitization and validation

## Email Verification

Email verification is integrated into the registration process:

1. User registers with TUM email address
2. Verification email sent automatically
3. User clicks verification link in email
4. Email marked as verified in database
5. User can now log in successfully

For detailed email setup instructions, see `EMAIL_VERIFICATION_SETUP.md`.

## Testing

### Postman Collection
- Import `ATOSS_GPT_Auth.postman_collection.json` into Postman
- Follow the testing guide in `POSTMAN_TESTING_GUIDE.md`
- Use the provided test sequences for complete API validation

### Health Check
```bash
curl http://localhost:4003/api/health
```

## Development

### Running in Development Mode
```bash
npm run dev
```

This enables:
- Automatic server restart on file changes
- Detailed logging
- Email verification links logged to console

### Docker Support
```bash
# Build image
docker build -t atoss-gpt-auth .

# Run container
docker run -p 4003:4003 atoss-gpt-auth
```

## Troubleshooting

### Common Issues

1. **Email Verification Not Working**:
   - Check SMTP configuration in `.env`
   - Verify email credentials (use App Password for Gmail)
   - Check console logs for verification links in development

2. **JWT Token Errors**:
   - Ensure JWT_SECRET is properly configured
   - Check token expiration settings
   - Verify Authorization header format: `Bearer <token>`

3. **Database Connection Issues**:
   - Verify MongoDB is running
   - Check MONGODB_URI in `.env`
   - Ensure database permissions are correct

4. **Gateway Routing Issues**:
   - Verify microservice URLs in `.env`
   - Check if target services are running
   - Review gateway middleware configuration

For detailed troubleshooting guides:
- `EMAIL_VERIFICATION_SETUP.md`
- `POSTMAN_TESTING_GUIDE.md`

## License

This project is part of the ATOSS.GPT system for TUM Universitäts Klinikum.

