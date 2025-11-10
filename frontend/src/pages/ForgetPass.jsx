import { useState } from "react";

export default function ForgetPass() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
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
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2 focus:border-tum-blue focus:ring-tum-blue"
              placeholder="you@example.com"
            />
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