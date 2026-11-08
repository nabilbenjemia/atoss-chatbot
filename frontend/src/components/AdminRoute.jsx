import { Navigate } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../services/api';

/**
 * AdminRoute - Protected route that requires admin role
 * 
 * Checks if user is authenticated AND has Admin role.
 * Redirects to login if not authenticated, or back to chatbot if not admin.
 */
export default function AdminRoute({ children }) {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        return <Navigate to="/" replace />;
    }

    // Check if user has admin role
    const user = getCurrentUser();
    if (!user || user.role !== 'Admin') {
        // Not admin - redirect to chatbot
        return <Navigate to="/chatbot" replace />;
    }

    return children;
}
