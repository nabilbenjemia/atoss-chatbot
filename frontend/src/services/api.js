import axios from 'axios';

// API base URL - adjust this to match your backend URL
const AUTH_LOGIN_URL = import.meta.env.VITE_AUTH_LOGIN_URL || 'http://localhost:4000';
const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:4001';

// Create axios instance with default config
const authApi = axios.create({
  baseURL: AUTH_LOGIN_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const userApi = axios.create({
  baseURL: USER_SERVICE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


// Add token to requests if available
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors for authApi
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // Only redirect if we're not already on the profile page
      const currentPath = window.location.pathname;
      if (currentPath !== '/profile') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  // Login
  login: async (email, password) => {
    const response = await authApi.post('/auth/login', { email, password });
    if (response.data.success) {
      // Store tokens and user data
      localStorage.setItem('auth_token', response.data.data.token);
      localStorage.setItem('refresh_token', response.data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Register
  register: async (userData) => {
    const response = await authApi.post('/auth/register', userData);
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await authApi.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call result
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  // Verify token
  verifyToken: async () => {
    const response = await authApi.get('/auth/verify');
    return response.data;
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await authApi.post('/auth/refresh', { refreshToken });
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('auth_token', response.data.data.token);
    }
    return response.data;
  },

  // Verify email
  verifyEmail: async (token) => {
    const response = await authApi.post('/auth/verify-email', { token });
    return response.data;
  },

  // Resend verification email
  resendVerificationEmail: async (email) => {
    const response = await authApi.post('/auth/resend-verification', { email });
    return response.data;
  },
};

// User Management API
export const userAPI = {
  // Get user profile
  getProfile: async () => {
    const response = await userApi.get('/me');
    return response.data;
  },

  // Update username
  updateUsername: async (username) => {
    const response = await userApi.patch('/me/username', { username });
    return response.data;
  },

  // Update role
  updateRole: async (role) => {
    const response = await userApi.patch('/me/role', { role });
    if (response.data.success) {
      // Update user in localStorage
      const currentUser = getCurrentUser();
      if (currentUser) {
        currentUser.role = role;
        localStorage.setItem('user', JSON.stringify(currentUser));
      }
    }
    return response.data;
  },

  // Update department
  updateDepartment: async (department) => {
    const response = await userApi.patch('/me/department', { department });
    if (response.data.success) {
      // Update user in localStorage
      const currentUser = getCurrentUser();
      if (currentUser) {
        currentUser.department = department;
        localStorage.setItem('user', JSON.stringify(currentUser));
      }
    }
    return response.data;
  },

  // Update password
  updatePassword: async (currentPassword, newPassword) => {
    const response = await userApi.patch('/me/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  // Update preferences
  updatePreferences: async (preferences) => {
    const response = await userApi.patch('/me/preferences', { preferences });
    return response.data;
  },

  // Update profile picture
  updateProfilePicture: async (profilePicture) => {
    const response = await userApi.patch('/me/profile-picture', { profilePicture });
    return response.data;
  },

  // Delete profile picture
  deleteProfilePicture: async () => {
    const response = await userApi.delete('/me/profile-picture');
    return response.data;
  },

  // Delete account
  deleteAccount: async () => {
    const response = await userApi.delete('/me');
    // Clear localStorage after successful deletion
    if (response.data.success) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    return response.data;
  },
};

// Attach same interceptors to userApi
userApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

userApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      const currentPath = window.location.pathname;
      if (currentPath !== '/profile') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('auth_token');
};

export { authApi, userApi };
export default userApi;


