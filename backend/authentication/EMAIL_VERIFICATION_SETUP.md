# Email Verification Setup Guide

## Overview

Email verification has been successfully integrated into the ATOSS.GPT authentication system. Users must verify their email address before they can log in.

## What Was Implemented

### Backend Changes

1. **UserCredentials Model** - Added email verification fields:
   - `emailVerified` (Boolean)
   - `emailVerificationToken` (String)
   - `emailVerificationTokenExpires` (Date)

2. **EmailService** - New service for sending emails:
   - Sends verification emails with HTML templates
   - Supports Gmail and other SMTP providers
   - Falls back to console logging in development mode

3. **AuthService Updates**:
   - Registration now sends verification email
   - Login checks if email is verified
   - Added `verifyEmail()` method
   - Added `resendVerificationEmail()` method

4. **New API Endpoints**:
   - `POST /auth/verify-email` - Verify email with token
   - `POST /auth/resend-verification` - Resend verification email

### Frontend Changes

1. **API Service** (`src/services/api.js`):
   - Created centralized API client with axios
   - Automatic token management
   - Error handling and token refresh

2. **LoginPage** - Updated to use real backend authentication

3. **RegisterPage** - New registration page with form validation

4. **VerifyEmailPage** - New page for email verification

5. **App.jsx** - Added new routes:
   - `/register` - Registration page
   - `/verify-email` - Email verification page

## Email Configuration

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Update `.env` file**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM=noreply@atoss-gpt.com
APP_URL=http://localhost:5173
```

### Option 2: Other SMTP Providers

Update the `.env` file with your SMTP provider settings:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@atoss-gpt.com
APP_URL=http://localhost:5173
```

### Development Mode (No Email Configuration)

If email credentials are not configured, the system will:
- Log verification links to the console
- Still create user accounts
- Allow you to test the flow without sending actual emails

## Testing the Flow

### 1. Registration

1. Navigate to `/register`
2. Fill in the form:
   - Email (must be @tum.de or @mytum.de)
   - Password (min 6 characters)
   - Confirm Password
   - Role (Staff/Admin)
   - Department
3. Submit the form
4. Check your email (or console if in dev mode) for verification link

### 2. Email Verification

1. Click the verification link in the email
2. Or navigate to `/verify-email?token=<your-token>`
3. Email will be verified and you'll be redirected to login

### 3. Login

1. Navigate to `/` (login page)
2. Enter your verified email and password
3. If email is not verified, you'll see an error message
4. After successful login, you'll be redirected to `/chat`

### 4. Resend Verification Email

If you didn't receive the email:
1. Go to `/verify-email` without a token
2. Enter your email address
3. Click "Resend Verification Email"

## API Endpoints

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@tum.de",
  "password": "password123",
  "role": "Staff",
  "department": "Department 1"
}
```

### Verify Email
```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-from-email"
}
```

### Resend Verification
```http
POST /auth/resend-verification
Content-Type: application/json

{
  "email": "user@tum.de"
}
```

### Login (requires verified email)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@tum.de",
  "password": "password123"
}
```

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Next Steps

1. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Email** (see Email Configuration section above)

3. **Start Backend**:
   ```bash
   npm run dev
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Test the Flow**:
   - Register a new account
   - Check email/console for verification link
   - Verify email
   - Login with verified account

## Troubleshooting

### Email Not Sending

- Check SMTP credentials in `.env`
- Verify App Password is correct (for Gmail)
- Check console logs for errors
- In dev mode, check console for verification links

### "Email not verified" Error on Login

- Make sure you clicked the verification link
- Check if token expired (24 hours)
- Use "Resend Verification Email" if needed

### Frontend Can't Connect to Backend

- Verify backend is running on port 4000
- Check `VITE_API_BASE_URL` in frontend `.env`
- Check CORS settings in backend

## Security Notes

- Verification tokens expire after 24 hours
- Tokens are single-use (cleared after verification)
- Passwords are hashed with bcrypt
- JWT tokens are used for authentication
- Email verification is required before login

