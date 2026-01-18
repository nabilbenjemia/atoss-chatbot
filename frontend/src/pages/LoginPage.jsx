import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { authAPI } from "../services/api";
import { validateTUMEmail, validatePassword } from "../utils/validation";


export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "idle", message: "" }); 
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasShownLogoutToast = useRef(false);

  // Check for logout success parameter on mount
  useEffect(() => {
    const logoutParam = searchParams.get('logout');
    if (logoutParam === 'success' && !hasShownLogoutToast.current) {
      hasShownLogoutToast.current = true;
      // Remove the query parameter from URL
      setSearchParams({});
      // Show toast notification
      toast.success("Successfully logged out", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [searchParams, setSearchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const validate = () => {
    const next = {};
    
    // Validate email
    const emailValidation = validateTUMEmail(form.email);
    if (!emailValidation.valid) {
      next.email = emailValidation.message;
    }
    
    // Validate password
    const passwordValidation = validatePassword(form.password);
    if (!passwordValidation.valid) {
      next.password = passwordValidation.message;
    }
    
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Only clear status on successful validation attempt, not at the start
    // This allows error messages to persist until the user fixes the issue
    if (!validate()) {
      // Keep any existing error status when validation fails
      return;
    }

    // Clear previous error messages only when starting a new valid submission
    setStatus({ type: "idle", message: "" });

    try {
      setLoading(true);
      const result = await authAPI.login(form.email, form.password);
      
      if (result.success) {
        setStatus({ type: "success", message: "Login successful. Welcome to the TUM Klinikum chatbot." });
        // Redirect to chatbot layout after successful login
        setTimeout(() => {
          navigate("/chatbot");
        }, 1000);
      } else {
        setStatus({
          type: "error",
          message: result.message || "Login failed. Please check your credentials.",
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Unexpected error. Please try again.";
      setStatus({ type: "error", message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

      

  const alertStyles =
    status.type === "success"
      ? "bg-tum-green-5 border-tum-green-3 text-tum-grey-1"
      : "bg-tum-red-4 border-tum-red text-tum-grey-1";

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section className="hidden lg:flex items-center justify-center bg-gradient-to-br from-tum-blue to-tum-dark-blue p-12 text-tum-white">
        <div className="max-w-md space-y-6 text-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ATOSS.GPT</h1>
            <p className="mt-2 text-tum-white/80 text-base font-light">
                Assisting the Workforce Management System
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 bg-tum-white">
        <div className="w-full max-w-md rounded-2xl bg-tum-white p-8 shadow-xl ring-1 ring-tum-grey-7">
          <div className="mb-6 flex items-center justify-center">
            <img
              src="/TUM_Kli_icon.png"
              alt="TUM Klinikum"
              className="h-12 w-auto"
            />
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-tum-blue">Log in</h1>
            <p className="mt-1 text-sm text-tum-grey-4">Access the TUM Klinikum chatbot</p>
          </div>

          {status.type !== "idle" && (
            <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${alertStyles}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-tum-grey-3">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@tum.de"
                className={`w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2
                 ${errors.email
                    ? "border-tum-red ring-tum-red-1"
                    : "border-tum-grey-7 focus:border-tum-blue focus:ring-tum-blue-light"}`}
              />
              {errors.email && <p className="mt-1 text-xs text-tum-red">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-tum-grey-3">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2
                 ${errors.password
                    ? "border-tum-red ring-tum-red-1"
                    : "border-tum-grey-7 focus:border-tum-blue focus:ring-tum-blue-light"}`}
              />
              {errors.password && <p className="mt-1 text-xs text-tum-red">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate("/forget-password")}
                className="text-sm font-medium text-tum-blue hover:underline bg-tum-white focus:outline-none border-0"
              >
                Forgot password?
              </button>
              <Link
                to="/register"
                className="text-sm font-medium text-tum-blue hover:underline"
              >
                Create account
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-tum-grey-3">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-tum-grey-7 text-tum-blue focus:ring-tum-blue"
                />
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-tum-blue px-4 py-2.5 text-tum-white transition hover:bg-tum-dark-blue active:scale-[.99] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}