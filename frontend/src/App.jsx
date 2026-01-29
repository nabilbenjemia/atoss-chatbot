import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import ForgetPass from "./pages/ForgetPass.jsx";
import ChatbotPage from "./pages/ChatbotPage.jsx";
import LearningPage from "./pages/LearningMaterialPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UserProfilePage from "./pages/UserProfilePage.jsx";
import IngestionPage from "./pages/IngestionPage.jsx";
import AnalyticsDashboard from "./pages/AnalyticsDashboard.jsx";


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forget-password" element={<ForgetPass />} />
        <Route
          path="/chatbot"
          element={
            <ProtectedRoute>
              <ChatbotPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning"
          element={
            <ProtectedRoute>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<UserProfilePage />} />
        {/* Admin routes */}
        <Route path="/admin/ingestion" element={<IngestionPage />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Router>
  );
}

