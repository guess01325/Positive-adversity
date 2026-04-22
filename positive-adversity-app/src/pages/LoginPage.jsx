import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const platform = Capacitor.getPlatform();
  const showAppleSignIn = platform === "ios";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(null);
  const [mode, setMode] = useState("signin");

  async function handleGoogleSignIn() {
    try {
      setAuthLoading("google");
      setErrorMessage("");
      setSuccessMessage("");
      await signInWithGoogle();
    } catch (error) {
      console.error("LOGIN PAGE GOOGLE ERROR:", error);
      setErrorMessage(error?.message || "Google sign-in failed.");
    } finally {
      setAuthLoading(null);
    }
  }

  async function handleAppleSignIn() {
    try {
      setAuthLoading("apple");
      setErrorMessage("");
      setSuccessMessage("");
      await signInWithApple();
    } catch (error) {
      console.error("LOGIN PAGE APPLE ERROR:", error);
      setErrorMessage(error?.message || "Apple sign-in failed.");
    } finally {
      setAuthLoading(null);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();

    try {
      setAuthLoading("email");
      setErrorMessage("");
      setSuccessMessage("");

      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail || !password) {
        throw new Error("Email and password are required.");
      }

      if (mode === "signup") {
        await signUpWithEmail(cleanEmail, password);
        setSuccessMessage("Account created successfully.");
      } else {
        await signInWithEmail(cleanEmail, password);
      }
    } catch (error) {
      console.error("LOGIN PAGE EMAIL ERROR:", error);
      setErrorMessage(
        error?.message ||
          (mode === "signup"
            ? "Account creation failed."
            : "Email sign-in failed.")
      );
    } finally {
      setAuthLoading(null);
    }
  }

  async function handleForgotPassword() {
    try {
      setAuthLoading("reset");
      setErrorMessage("");
      setSuccessMessage("");

      await resetPassword(email);

      setSuccessMessage(
        "If this email uses password sign-in, a reset link has been sent."
      );
    } catch (error) {
      console.error("LOGIN PAGE RESET ERROR:", error);
      setErrorMessage(error?.message || "Could not send reset email.");
    } finally {
      setAuthLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in with Google or use any email address.
      </p>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={!!authLoading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authLoading === "google" ? "Please wait..." : "Continue with Google"}
        </button>

        {showAppleSignIn && (
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={!!authLoading}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authLoading === "apple" ? "Please wait..." : "Continue with Apple"}
          </button>
        )}
      </div>

      <div className="mb-4 mt-6 flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setErrorMessage("");
            setSuccessMessage("");
          }}
          disabled={!!authLoading}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "signin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setErrorMessage("");
            setSuccessMessage("");
          }}
          disabled={!!authLoading}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "signup"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="you@example.com"
            disabled={!!authLoading}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Enter password"
            disabled={!!authLoading}
          />
        </div>

        {mode === "signin" && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={!!authLoading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authLoading === "reset" ? "Sending..." : "Forgot Password?"}
            </button>
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!!authLoading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authLoading === "email"
            ? "Please wait..."
            : mode === "signup"
            ? "Create Account"
            : "Sign In with Email"}
        </button>
      </form>
    </div>
  );
}