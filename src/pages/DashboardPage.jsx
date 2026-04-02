import { useEffect, useState } from 'react';
import EntryForm from '../components/EntryForm';
import EntriesByMonth from '../components/EntriesByMonth';
import { useAuth } from '../contexts/AuthContext';
import { createEntry, fetchEntriesByUser } from '../lib/firestore';

export default function DashboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    async function loadEntries() {
      try {
        setLoading(true);
        const data = await fetchEntriesByUser(user.uid);
        setEntries(data);
      } catch (error) {
        console.error('Failed to load entries:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [user?.uid]);

  async function handleCreateEntry(payload) {
    if (!user?.uid) return;

    try {
      setSaving(true);

      await createEntry({
        ...payload,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || '',
      });

      const data = await fetchEntriesByUser(user.uid);
      setEntries(data);
    } catch (error) {
      console.error('Failed to create entry:', error);
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
          Track your work sessions, store the notes for each visit, and keep
          your monthly totals ready for payroll.
        </p>
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