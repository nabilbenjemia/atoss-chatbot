import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../services/api";

export default function RegisterPage() {
  const [form, setForm] = useState({ 
    email: "", 
    password: "", 
    confirmPassword: "",
    role: "Staff",
    department: "Department 1"
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((e) => ({ ...e, [name]: "" }));
    }
  };

  const validate = () => {
    const next = {};
    if (!form.email || !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      next.email = "Enter a valid email.";
    } else if (!form.email.endsWith("@tum.de") && !form.email.endsWith("@mytum.de")) {
      next.email = "Please use your TUM email address (@tum.de or @mytum.de).";
    }
    if (!form.password || form.password.length < 6) {
      next.password = "At least 6 characters.";
    }
    if (form.password !== form.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    if (!form.department) {
      next.department = "Please select a department.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "idle", message: "" });
    if (!validate()) return;

    try {
      setLoading(true);
      const result = await authAPI.register({
        email: form.email,
        password: form.password,
        role: form.role,
        department: form.department
      });

      if (result.success) {
        setStatus({ 
          type: "success", 
          message: result.data?.message || "Registration successful! Please check your email to verify your account." 
        });
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        setStatus({
          type: "error",
          message: result.message || "Registration failed. Please try again.",
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
            <h1 className="text-2xl font-semibold tracking-tight text-tum-blue">Create Account</h1>
            <p className="mt-1 text-sm text-tum-grey-4">Register for the TUM Klinikum chatbot</p>
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

            <div>
              <label className="mb-1 block text-sm font-medium text-tum-grey-3">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2
                 ${errors.confirmPassword
                    ? "border-tum-red ring-tum-red-1"
                    : "border-tum-grey-7 focus:border-tum-blue focus:ring-tum-blue-light"}`}
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-tum-red">{errors.confirmPassword}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-tum-grey-3">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full rounded-xl border border-tum-grey-7 px-3 py-2 outline-none transition focus:border-tum-blue focus:ring-2 focus:ring-tum-blue-light"
              >
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-tum-grey-3">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className={`w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2
                 ${errors.department
                    ? "border-tum-red ring-tum-red-1"
                    : "border-tum-grey-7 focus:border-tum-blue focus:ring-tum-blue-light"}`}
              >
                <option value="">Select Department</option>
                <option value="Department 1">Department 1</option>
                <option value="Department 2">Department 2</option>
                <option value="Department 3">Department 3</option>
              </select>
              {errors.department && <p className="mt-1 text-xs text-tum-red">{errors.department}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-tum-blue px-4 py-2.5 text-tum-white transition hover:bg-tum-dark-blue active:scale-[.99] disabled:opacity-60"
            >
              {loading ? "Creating Account…" : "Create Account"}
            </button>

            <div className="text-center text-sm text-tum-grey-4">
              Already have an account?{" "}
              <Link to="/" className="font-medium text-tum-blue hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}


