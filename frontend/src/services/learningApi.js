import axios from 'axios';

const LEARNING_API_URL = import.meta.env.VITE_LEARNING_API_URL || 'http://localhost:4005';

const learningApi = axios.create({
  baseURL: LEARNING_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
learningApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default learningApi;
