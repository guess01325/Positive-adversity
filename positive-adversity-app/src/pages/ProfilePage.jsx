import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { deleteUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  anonymizeEntriesForDeletedUser,
  deleteUserProfile,
} from '../lib/firestore';

export default function ProfilePage() {
  const { user, role, logout } = useAuth();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleDeleteAccount() {
    if (!user?.uid) {
      setError('No signed-in user found.');
      return;
    }

    if (confirmText.trim() !== 'DELETE') {
      setError('Type DELETE exactly to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    setError('');
    setSuccess('');

    try {
      // 1. Anonymize entries
      await anonymizeEntriesForDeletedUser(user.uid);

      // 2. Delete profile doc
      await deleteUserProfile(user.uid);

      // 3. Delete Firebase auth user
      await deleteUser(auth.currentUser);

      setSuccess('Your account has been deleted.');

      // 4. Log out
      await logout();
    } catch (err) {
      console.error('Delete account error:', err);

      if (err?.code === 'auth/requires-recent-login') {
        setError(
          'For security, please sign out and sign back in, then try again.'
        );
      } else {
        setError(err?.message || 'Failed to delete account.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My profile</h2>
        <p className="mt-2 text-sm text-slate-500">
          This is the per-user page for account details and permissions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Display name
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {user?.displayName || 'No name provided'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {user?.email}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Role
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {role}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            User ID
          </p>
          <p className="mt-2 break-all text-sm font-medium text-slate-900">
            {user?.uid}
          </p>
        </div>
      </div>

      {/* DELETE ACCOUNT SECTION */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h3 className="text-lg font-semibold text-red-700">
          Delete account
        </h3>

        <p className="mt-2 text-sm text-red-700">
          Deleting your account removes your sign-in access and personal profile.
          Organization records such as mentoring entries may be retained for
          operational or compliance purposes.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">
            Type <span className="font-bold">DELETE</span> to confirm
          </label>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-400"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-3 text-sm font-medium text-green-600">
            {success}
          </p>
        )}

        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="mt-4 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isDeleting ? 'Deleting account...' : 'Delete My Account'}
        </button>
      </div>
    </section>
  );
}