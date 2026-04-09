import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Positive Adversity
        </p>
        <h1 className="mb-3 text-2xl font-bold text-slate-900">
          Sign in to continue
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          Use your Google account to access your dashboard, entries, and profile.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}