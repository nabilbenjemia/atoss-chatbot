# User Microservice - Implementation Summary

## Overview

A new `/user` microservice has been implemented to handle user account management. This service coordinates with the existing Authentication Service to provide comprehensive user management capabilities.

## Implemented Features

### ✅ Core Features (Requested)
1. **Change User Type (Role)**: Users can switch between "Admin" and "Staff" roles
2. **Adjust Department**: Users can change their department affiliation
3. **Change Username**: Users can set/update a display name (separate from email)
4. **Change Password**: Users can update their password with current password verification
5. **Delete Account**: Users can permanently delete their account

### ✅ Additional Features (Recommended)
1. **Get User Profile**: Retrieve complete user profile information
2. **Update Preferences**: Manage user preferences (theme, language, notifications)
3. **Account Activity**: View last login and account creation information
4. **Email Verification Status**: Check email verification status

## Architecture

### Service Separation
- **User Service** (Port 4001): Manages user profile data (username, preferences)
- **Authentication Service** (Port 4000): Manages user credentials (email, password, role, department)

### Data Flow
```
User Request → API Gateway → User Service → Authentication Service
                                     ↓
                              UserProfile DB
```

### API Endpoints

#### User Service Endpoints (`/users/*`)
- `GET /users/me` - Get current user profile
- `GET /users/:userId/verify` - Verify user exists (for auth service)
- `PATCH /users/me/username` - Update username
- `PATCH /users/me/role` - Update role
- `PATCH /users/me/department` - Update department
- `PATCH /users/me/password` - Update password
- `PATCH /users/me/preferences` - Update preferences
- `DELETE /users/me` - Delete account

#### Authentication Service Endpoints (Internal)
- `GET /auth/user/:userId` - Get user credentials
- `PATCH /auth/user/:userId/role` - Update role in credentials
- `PATCH /auth/user/:userId/department` - Update department in credentials
- `PATCH /auth/user/:userId/password` - Update password in credentials
- `DELETE /auth/user/:userId` - Delete user credentials

## Security Features

1. **Authentication Required**: All endpoints require JWT token authentication
2. **Authorization Checks**: Users can only modify their own data
3. **Password Verification**: Password changes require current password
4. **Input Validation**: All inputs are validated before processing

## Database Structure

### UserProfile Collection (User Service)
```javascript
{
  userId: String (unique, indexed),
  username: String (optional, max 50 chars),
  preferences: {
    theme: 'light' | 'dark' | 'auto',
    language: String,
    notifications: {
      email: Boolean,
      chat: Boolean
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### UserCredentials Collection (Auth Service)
- Already exists, extended with new update methods
- Contains: email, passwordHash, role, department, emailVerified, etc.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd backend/user
   npm install
   ```

2. **Configure Environment**
   Create `.env` in `backend/user/`:
   ```env
   PORT=4001
   MONGODB_URI=mongodb://localhost:27017/atoss_gpt_user
   AUTH_SERVICE_URL=http://localhost:4000
   ```

3. **Start Services**
   ```bash
   # Start Authentication Service (if not running)
   cd backend/authentication
   npm run dev

   # Start User Service
   cd backend/user
   npm run dev
   ```

## Usage Examples

### Update Username
```bash
curl -X PATCH http://localhost:4000/users/me/username \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username": "John Doe"}'
```

### Update Role
```bash
curl -X PATCH http://localhost:4000/users/me/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "Admin"}'
```

### Update Department
```bash
curl -X PATCH http://localhost:4000/users/me/department \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"department": "Department 2"}'
```

### Change Password
```bash
curl -X PATCH http://localhost:4000/users/me/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newPassword456"
  }'
```

### Delete Account
```bash
curl -X DELETE http://localhost:4000/users/me \
  -H "Authorization: Bearer <token>"
```

## Notes

- The User Service communicates with the Authentication Service via HTTP calls
- All credential updates (role, department, password) are synchronized with the Auth Service
- User profile data (username, preferences) is stored separately in the User Service database
- The API Gateway routes `/users/*` requests to the User Service on port 4001
- All endpoints validate that users can only modify their own data

## Future Enhancements (Optional)

1. Email change functionality (requires email verification)
2. Account activity history/logging
3. Profile picture upload
4. Two-factor authentication
5. Account recovery options
6. Admin endpoints for managing other users
