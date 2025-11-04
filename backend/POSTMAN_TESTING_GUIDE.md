# Postman Testing Guide for ATOSS.GPT Authentication

## Quick Start

1. **Import the Collection**: Import `ATOSS_GPT_Auth.postman_collection.json` into Postman
2. **Verify Server is Running**: The server should be running on `http://localhost:4000`
3. **Test Endpoints**: Follow the testing sequence below

## Testing Sequence

### Step 1: Health Check
**GET** `http://localhost:4000/api/health`

- **Expected Response**: `200 OK`
- **Response Body**:
```json
{
  "status": "ok",
  "service": "API Gateway",
  "timestamp": "2025-11-04T16:41:47.356Z"
}
```

### Step 2: Register a New User
**POST** `http://localhost:4000/auth/register`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "test@example.com",
  "password": "securePassword123",
  "role": "Staff",
  "department": "Department 1"
}
```

**Expected Response**: `201 Created`
**Response Body**:
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": "user-id-uuid",
    "email": "test@example.com",
    "role": "Staff",
    "department": "Department 1"
  }
}
```

**Try different roles**:
- `"role": "Staff"` or `"role": "Admin"`
- `"department": "Department 1"`, `"Department 2"`, or `"Department 3"`

### Step 3: Login
**POST** `http://localhost:4000/auth/login`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "test@example.com",
  "password": "securePassword123"
}
```

**Expected Response**: `200 OK`
**Response Body**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-id-uuid",
      "email": "test@example.com",
      "role": "Staff",
      "department": "Department 1"
    }
  }
}
```

**Save the token** for use in protected endpoints!

### Step 4: Verify Token
**GET** `http://localhost:4000/auth/verify`

**Headers**:
```
Authorization: Bearer <your-token-here>
```

**Expected Response**: `200 OK`
**Response Body**:
```json
{
  "success": true,
  "data": {
    "id": "user-id-uuid",
    "email": "test@example.com",
    "role": "Staff",
    "department": "Department 1"
  }
}
```

### Step 5: Refresh Token
**POST** `http://localhost:4000/auth/refresh`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "refreshToken": "<your-refresh-token-here>"
}
```

**Expected Response**: `200 OK`
**Response Body**:
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-access-token"
  }
}
```

### Step 6: Logout
**POST** `http://localhost:4000/auth/logout`

**Headers**:
```
Authorization: Bearer <your-token-here>
```

**Expected Response**: `200 OK`
**Response Body**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

After logout, try using the token again - it should be invalidated.

## Error Testing

### Test Invalid Login
**POST** `http://localhost:4000/auth/login`
```json
{
  "email": "wrong@example.com",
  "password": "wrongpassword"
}
```
**Expected Response**: `401 Unauthorized`

### Test Missing Token
**GET** `http://localhost:4000/auth/verify`
(No Authorization header)
**Expected Response**: `401 Unauthorized`

### Test Invalid Token
**GET** `http://localhost:4000/auth/verify`
```
Authorization: Bearer invalid-token-here
```
**Expected Response**: `401 Unauthorized`

### Test Invalid Registration
**POST** `http://localhost:4000/auth/register`
```json
{
  "email": "test@example.com",
  "password": "short"
}
```
**Expected Response**: `400 Bad Request` (missing department)

## Postman Environment Variables (Optional)

If you import the collection, it will automatically:
- Save `auth_token` and `refresh_token` after login
- Use `{{auth_token}}` in Authorization headers automatically

To set up manually:
1. Create a new Environment in Postman
2. Add variables:
   - `auth_token`: (will be set automatically after login)
   - `refresh_token`: (will be set automatically after login)
3. Use `{{auth_token}}` in Authorization headers

## Testing Checklist

- [ ] Health check endpoint works
- [ ] User registration works
- [ ] Login returns JWT token
- [ ] Token verification works
- [ ] Token refresh works
- [ ] Logout invalidates token
- [ ] Invalid credentials return 401
- [ ] Missing token returns 401
- [ ] Invalid token returns 401
- [ ] Registration validation works

## Common Issues

**Connection Refused**: Make sure the server is running (`npm run dev`)

**401 Unauthorized**: 
- Check if token is correctly formatted: `Bearer <token>`
- Make sure token hasn't expired
- Verify token wasn't invalidated by logout

**400 Bad Request**: 
- Check JSON format
- Verify all required fields are present
- Check email format
- Verify role and department values match enum values

**MongoDB Connection Error**: 
- Make sure MongoDB is running
- Check MongoDB connection string in `.env` file

