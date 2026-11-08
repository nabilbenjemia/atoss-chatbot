import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { authAPI } from "../services/api";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState({ type: "loading", message: "Verifying your email..." });
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const hasVerifiedRef = useRef(false); // Prevent multiple verification attempts

  useEffect(() => {
    // Only run verification once
    if (hasVerifiedRef.current) {
      return;
    }

    const token = searchParams.get("token");
    if (token) {
      hasVerifiedRef.current = true; // Mark as attempted
      // searchParams.get() already decodes, but handle edge cases
      let decodedToken = token;
      try {
        // Try decoding in case it was double-encoded
        decodedToken = decodeURIComponent(token);
      } catch (e) {
        // If decoding fails, use original token (already decoded)
        decodedToken = token;
      }
      verifyEmail(decodedToken);
    } else {
      setStatus({
        type: "error",
        message: "No verification token provided."
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const verifyEmail = async (token) => {
    try {
      const result = await authAPI.verifyEmail(token);
      if (result.success) {
        setStatus({
          type: "success",
          message: result.message || "Email verified successfully! You can now log in."
        });
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        setStatus({
          type: "error",
          message: result.message || "Email verification failed."
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Email verification failed.";
      setStatus({
        type: "error",
        message: errorMessage
      });
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    if (!email) {
      setStatus({
        type: "error",
        message: "Please enter your email address."
      });
      return;
    }

    try {
      setResending(true);
      const result = await authAPI.resendVerificationEmail(email);
      if (result.success) {
        setStatus({
          type: "success",
          message: result.message || "Verification email sent! Please check your inbox."
        });
      } else {
        setStatus({
          type: "error",
          message: result.message || "Failed to send verification email."
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to send verification email.";
      setStatus({
        type: "error",
        message: errorMessage
      });
    } finally {
      setResending(false);
    }
  };

  const alertStyles =
    status.type === "success"
      ? "bg-tum-green-5 border-tum-green-3 text-tum-grey-1"
      : status.type === "loading"
      ? "bg-tum-blue-5 border-tum-blue-3 text-tum-grey-1"
      : "bg-tum-red-4 border-tum-red text-tum-grey-1";

  return (
    <div className="flex items-center justify-center min-h-screen bg-tum-white p-6">
      <div className="w-full max-w-md rounded-2xl bg-tum-white p-8 shadow-xl ring-1 ring-tum-grey-7">
        <div className="mb-6 flex items-center justify-center">
          <img
            src="/TUM_Kli_icon.png"
            alt="TUM Klinikum"
            className="h-12 w-auto"
          />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-tum-blue">Email Verification</h1>
        </div>

        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${alertStyles}`}>
          {status.message}
        </div>

        {status.type === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-tum-grey-4 text-center">
              The verification link may have expired or already been used. If you've already verified your email, you can log in directly. Otherwise, enter your email address below to resend the verification link.
            </p>
            <form onSubmit={handleResendVerification} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tum.de"
                className="w-full rounded-xl border border-tum-grey-7 px-3 py-2 outline-none transition focus:border-tum-blue focus:ring-2 focus:ring-tum-blue-light"
                required
              />
              <button
                type="submit"
                disabled={resending}
                className="inline-flex w-full items-center justify-center rounded-xl bg-tum-blue px-4 py-2.5 text-tum-white transition hover:bg-tum-dark-blue active:scale-[.99] disabled:opacity-60"
              >
                {resending ? "Sending…" : "Resend Verification Email"}
              </button>
            </form>
          </div>
        )}

        {status.type === "success" && (
          <div className="text-center">
            <p className="text-sm text-tum-grey-4 mb-4">
              Redirecting to login page...
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl bg-tum-blue px-4 py-2.5 text-tum-white transition hover:bg-tum-dark-blue"
            >
              Go to Login
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm font-medium text-tum-blue hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}


