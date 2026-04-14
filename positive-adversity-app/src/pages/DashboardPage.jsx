import { useCallback, useEffect, useState } from 'react';
import EntryForm from '../components/EntryForm';
import EntriesByMonth from '../components/EntriesByMonth';
import { useAuth } from '../contexts/AuthContext';
import { createEntry, fetchEntriesByUser } from '../lib/firestore';

export default function DashboardPage() {
  const { user, role, isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!user?.uid) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchEntriesByUser(user.uid);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load entries:', error);
      alert(error?.message || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    loadEntries();
  }, [user?.uid, loadEntries]);

  async function handleCreateEntry(payload) {
    if (!user?.uid) {
      throw new Error('You must be logged in to save an entry.');
    }

    try {
      setSaving(true);

      const entryToCreate = {
        ...payload,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || '',
      };

      const created = await createEntry(entryToCreate);
      const freshEntries = await fetchEntriesByUser(user.uid);
      setEntries(freshEntries);
      return created;
    } catch (error) {
      console.error('Failed to create entry:', error);
      alert(error?.message || 'Failed to save entry.');
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <h2 className="text-2xl font-bold">
          Welcome back, {user?.displayName?.split(' ')[0] || 'User'}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Track your work sessions, store notes, and keep monthly totals organized.
        </p>

        <div className="mt-4 text-sm text-slate-200">
          <div>Email: {user?.email || '—'}</div>
          <div>Role: {role}</div>
          <div>Admin: {isAdmin ? 'Yes' : 'No'}</div>
        </div>
      </section>

      <EntryForm onSubmit={handleCreateEntry} submitting={saving} />

      {loading ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          Loading your entries...
        </section>
      ) : (
        <EntriesByMonth
          entries={entries}
          emptyMessage="No work sessions logged yet for this account."
          showStudent={true}
          showInternalTotals={false}
        />
      )}
    </div>
  );
}
