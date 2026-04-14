import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const { user, role } = useAuth();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">My profile</h2>
      <p className="mt-2 text-sm text-slate-500">This is the per-user page for account details and permissions.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Display name</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{user?.displayName || 'No name provided'}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{user?.email}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{role}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User ID</p>
          <p className="mt-2 break-all text-sm font-medium text-slate-900">{user?.uid}</p>
        </div>
      </div>
    </section>
  );
}
