# ATOSS.GPT - User Management Microservice

This microservice handles user profile management and account operations.

## Features

### User Profile Management
- **Get Profile**: Retrieve current user's complete profile information
- **Update Username**: Change display name (separate from email)
- **Update Role**: Switch between "Admin" and "Staff" roles
- **Update Department**: Change department affiliation
- **Update Password**: Change account password (requires current password)
- **Update Preferences**: Manage user preferences (theme, language, notifications)
- **Delete Account**: Permanently delete user account

### Additional Features
- **Profile Preferences**: Store user preferences (theme, language, notification settings)
- **Account Activity**: View last login and account creation information
- **Email Verification Status**: Check email verification status

## Project Structure

```
backend/user/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   └── UserController.js    # HTTP request handlers for user management
├── models/
│   └── UserProfile.js       # User profile database schema
├── routes/
│   └── userRoutes.js        # User route definitions
├── services/
│   └── UserService.js       # Core user management business logic
├── index.js                 # Main server entry point
├── package.json
└── README.md
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend/user
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `backend/user/` directory with the following variables:

```env
PORT=4001

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_user

# Auth Service URL (for credential updates)
AUTH_SERVICE_URL=http://localhost:4000

# Optional: Internal service token for service-to-service communication
INTERNAL_SERVICE_TOKEN=your-internal-service-token
```

### 3. Run the Service

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Endpoints

All endpoints require authentication via JWT token (Bearer token in Authorization header).

### Get User Profile
```
GET /users/me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "userId": "...",
    "username": "John Doe",
    "email": "user@tum.de",
    "role": "Staff",
    "department": "Department 1",
    "emailVerified": true,
    "lastLogin": "...",
    "preferences": {...},
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Update Username
```
PATCH /users/me/username
Authorization: Bearer <token>
Body: { "username": "New Name" }
```

### Update Role
```
PATCH /users/me/role
Authorization: Bearer <token>
Body: { "role": "Admin" }  // or "Staff"
```

### Update Department
```
PATCH /users/me/department
Authorization: Bearer <token>
Body: { "department": "Department 2" }
```

### Update Password
```
PATCH /users/me/password
Authorization: Bearer <token>
Body: {
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### Update Preferences
```
PATCH /users/me/preferences
Authorization: Bearer <token>
Body: {
  "preferences": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": true,
      "chat": false
    }
  }
}
```

### Delete Account
```
DELETE /users/me
Authorization: Bearer <token>
```

### Verify User (Internal)
```
GET /users/:userId/verify

Response:
{
  "success": true,
  "exists": true
}
```

## Integration with Authentication Service

The User Service coordinates with the Authentication Service for credential updates:
- **Role changes**: Updates UserCredentials in auth service
- **Department changes**: Updates UserCredentials in auth service  
- **Password changes**: Updates password hash in auth service
- **Account deletion**: Removes UserCredentials from auth service

The User Service stores additional profile information (username, preferences) in its own database.

## Architecture Notes

- User profile data (username, preferences) is stored in the User Service database
- User credentials (email, password, role, department) are stored in the Authentication Service database
- The User Service makes HTTP calls to the Authentication Service for credential updates
- All endpoints require JWT authentication except `/users/:userId/verify` (used by auth service)
