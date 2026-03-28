import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Positive Adversity</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Sign in to manage notes, hours, and payroll.</h1>
        <p className="mt-3 text-sm text-slate-600">
          This first version includes Google login, monthly tracking, personal history, and an HR admin view.
        </p>

        <div className="mt-8 rounded-2xl bg-slate-100 p-5">
          <p className="text-sm text-slate-700">Use your approved Google account to enter session notes and keep payroll totals organized by month.</p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
