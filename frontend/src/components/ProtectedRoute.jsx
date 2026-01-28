import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../services/api';

export default function ProtectedRoute({ children }) {
  // Check if user has a valid auth token
  if (!isAuthenticated()) {
    // If not logged in, redirect to login page
    return <Navigate to="/" replace />;
  }
  // If logged in, show the requested page
  return children;
}
