import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import logoFull from '../assets/logo-full.png';

export default function LoginPage() {
  const { signInWithGoogle, signInWithApple } = useAuth();

  const [errorMessage, setErrorMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(null);


  async function handleGoogleSignIn() {
    try {
      setAuthLoading("google");
      setErrorMessage("");
      await signInWithGoogle();
    } catch (error) {
      console.error("GOOGLE SIGN-IN ERROR:", error);
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
      console.error("APPLE SIGN-IN ERROR:", error);
      setErrorMessage(error?.message || "Apple sign-in failed.");
    } finally {
      setAuthLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          
          {/* Logo + Header */}
          <div className="mb-10 flex flex-col items-center text-center">
            <img
              src= {logoFull}
              alt="Positive Adversity logo"
              className="mb-4 h-28 w-auto sm:mb-0 sm:h-32"
            />

            <h1 className="text-3xl font-bold text-gray-900">
              Welcome Back
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Sign in to continue
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={authLoading !== null}
              className="w-full rounded-2xl bg-black py-4 text-white font-semibold transition hover:opacity-90 disabled:opacity-60"
            >
              {authLoading === "google"
                ? "Signing in..."
                : "Continue with Google"}
            </button>

            <button
              onClick={handleAppleSignIn}
              disabled={authLoading !== null}
              className="w-full rounded-2xl border border-gray-300 py-4 font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {authLoading === "apple"
                ? "Signing in..."
                : "Continue with Apple"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}