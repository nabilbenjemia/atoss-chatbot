import { useState } from "react";
import { validateTUMEmail } from "../utils/validation";

export default function ForgetPass() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    // Validate email
    const emailValidation = validateTUMEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.message);
      return;
    }

    // TODO: Implement password reset API call
    setStatus(`Password reset link would be sent to ${email}`);
    alert(`Password reset link sent to ${email}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-md">
        <h1 className="text-2xl font-semibold text-center text-tum-blue mb-6">
          Reset your password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
              className={`mt-1 block w-full rounded-lg border p-2 focus:ring-2 ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-tum-blue focus:ring-tum-blue"
              }`}
              placeholder="you@tum.de"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {status && <p className="mt-1 text-xs text-green-600">{status}</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-tum-blue text-white py-2 px-4 rounded-lg hover:bg-tum-blue/90 transition"
          >
            Send reset link
          </button>
        </form>
      </div>
    </div>
  );
}