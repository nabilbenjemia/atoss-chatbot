import axios from 'axios';

// API base URL - adjust this to match your backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4003';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
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

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // Don't redirect if we're on the login page (allow login errors to be displayed)
      // or on the profile page (let it handle its own redirect)
      const currentPath = window.location.pathname;
      if (currentPath !== '/profile' && currentPath !== '/') {
        window.location.href = '/';
      }
      // If on login page or profile page, let the component handle the error/redirect
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  // Login
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
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
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
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
    const response = await api.get('/auth/verify');
    return response.data;
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('auth_token', response.data.data.token);
    }
    return response.data;
  },

  // Verify email
  verifyEmail: async (token) => {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  // Resend verification email
  resendVerificationEmail: async (email) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
};

// User Management API
export const userAPI = {
  // Get user profile
  getProfile: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  // Update username
  updateUsername: async (username) => {
    const response = await api.patch('/users/me/username', { username });
    return response.data;
  },

  // Update role
  updateRole: async (role) => {
    const response = await api.patch('/users/me/role', { role });
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
    const response = await api.patch('/users/me/department', { department });
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
    const response = await api.patch('/users/me/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  // Update preferences
  updatePreferences: async (preferences) => {
    const response = await api.patch('/users/me/preferences', { preferences });
    return response.data;
  },

  // Update profile picture
  updateProfilePicture: async (profilePicture) => {
    const response = await api.patch('/users/me/profile-picture', { profilePicture });
    return response.data;
  },

  // Delete profile picture
  deleteProfilePicture: async () => {
    const response = await api.delete('/users/me/profile-picture');
    return response.data;
  },

  // Delete account
  deleteAccount: async () => {
    const response = await api.delete('/users/me');
    // Clear localStorage after successful deletion
    if (response.data.success) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    return response.data;
  },

  // Add admin - promote a staff user to admin by email (admin only)
  addAdmin: async (email) => {
    const response = await api.post('/users/add-admin', { email });
    return response.data;
  },
};

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('auth_token');
};

export default api;


