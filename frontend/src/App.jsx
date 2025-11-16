import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ForgetPass from "./pages/ForgetPass.jsx";
import ChatbotLayout from "./layouts/ChatbotLayout.jsx";


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/forget-password" element={<ForgetPass />} />
        <Route path="/chatbot" element={<ChatbotLayout />} />
      </Routes>
    </Router>
  );
}

