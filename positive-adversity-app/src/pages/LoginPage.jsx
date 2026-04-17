import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'

  async function handleGoogleSignIn() {
    try {
      setSubmitting(true);
      setErrorMessage('');
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error?.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in with Google or use any email address.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait...' : 'Continue with Google'}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === 'signin'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === 'signup'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600'
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
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Enter password"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Please wait...'
            : mode === 'signup'
            ? 'Create Account'
            : 'Sign In with Email'}
        </button>
      </form>
    </div>
  );
}