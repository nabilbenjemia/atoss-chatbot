/**
 * Ingestion Mocks
 * 
 * Mock data and utilities for testing the ingestion page without authentication.
 * Used when VITE_USE_MOCK_AUTH is set to 'true'.
 */

/**
 * Mock user for testing without authentication
 */
export const mockCurrentUser = {
    id: 'mock-user-001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    preferences: {
        theme: 'light',
    },
};

/**
 * Check if mock auth should be used
 * Returns true if:
 * - VITE_USE_MOCK_AUTH is explicitly set to 'true', OR
 * - In development mode (DEV) and VITE_USE_MOCK_AUTH is not explicitly 'false'
 * 
 * @returns {boolean} True if mock auth is enabled
 */
export const shouldUseMockAuth = () => {
    const envValue = import.meta.env.VITE_USE_MOCK_AUTH;
    
    // Explicit true
    if (envValue === 'true') return true;
    
    // Explicit false
    if (envValue === 'false') return false;
    
    // Default: use mock in development mode
    return import.meta.env.DEV;
};
