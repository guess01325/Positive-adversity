import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(null); // 'google' | 'apple' | 'email' | null
  const [mode, setMode] = useState("signin"); // 'signin' or 'signup'

  async function handleGoogleSignIn() {
    try {
      setAuthLoading("google");
      setErrorMessage("");
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error?.message || "Google sign-in failed.");
    } finally {
      setAuthLoading(null);
    }
  }

async function handleAppleSignIn() {
  try {
    setAuthLoading("apple");
    setErrorMessage("");
    await signInWithApple();
  } catch (error) {
    setErrorMessage(error?.message || "Apple sign-in failed.");
  } finally {
    setAuthLoading(null);
  }
}

  async function handleEmailSubmit(e) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setAuthLoading("email");
      setErrorMessage("");

      if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error) {
      setErrorMessage(error?.message || "Authentication failed.");
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

        <button
          type="button"
          onClick={handleAppleSignIn}
          disabled={!!authLoading}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authLoading === "apple" ? "Please wait..." : "Continue with Apple"}
        </button>
      </div>

      <div className="mb-4 mt-6 flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
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
          onClick={() => setMode("signup")}
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

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!!authLoading}
          className="w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
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