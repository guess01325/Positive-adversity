import { useCallback, useEffect, useState } from 'react';
import EntryForm from '../components/EntryForm';
import EntriesByMonth from '../components/EntriesByMonth';
import { useAuth } from '../contexts/AuthContext';
import {
  createEntry,
  fetchEntriesByUser,
  fetchAllEntries,
  fetchEntryById,
} from '../lib/firestore';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { collection, getDocs } from 'firebase/firestore';


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
    console.log('loadEntries START', {
      uid: user.uid,
      email: user.email,
    });


    setLoading(true);

    console.log('BEFORE fetchEntriesByUser');
    const data = await fetchEntriesByUser(user.uid);
    console.log('AFTER fetchEntriesByUser', data);

    setEntries(data);

    console.log('loadEntries SUCCESS', data);
  } catch (error) {
    console.error('Failed to load entries:', error);
    alert(error?.message || 'Failed to load entries');
  } finally {
    console.log('loadEntries FINALLY');
    setLoading(false);
  }
}, [user?.uid, user?.email]);

async function logout() {
  console.log('logOut START');
  await signOut(auth);
  console.log('logout SUCCESS');
}


  async function debugAllEntries() {
    try {
      console.log('DEBUG ALL ENTRIES START');
      const all = await fetchAllEntries();
      console.log('DEBUG ALL ENTRIES COUNT', all.length);
      console.log('DEBUG ALL ENTRIES', all);
    } catch (error) {
      console.error('DEBUG ALL ENTRIES ERROR', error);
    }
  }

  async function debugKnownEntry() {
  try {
    console.log('DEBUG KNOWN ENTRY START');
    const entry = await fetchEntryById('OwR3t8PHWUKF6mzbNUmP');
    console.log('DEBUG KNOWN ENTRY RESULT', entry);
  } catch (error) {
    console.error('DEBUG KNOWN ENTRY ERROR', error);
  }
}

  async function smokeTestDirectRead() {
  try {
    console.log('SMOKE DIRECT READ START');

    const ref = doc(db, 'entries', 'OwR3t8PHWUKF6mzbNUmP');
    const snap = await getDoc(ref);

    console.log('SMOKE DIRECT READ EXISTS', snap.exists());

    if (snap.exists()) {
      console.log('SMOKE DIRECT READ DATA', { id: snap.id, ...snap.data() });
    } else {
      console.log('SMOKE DIRECT READ NOT FOUND');
    }
  } catch (error) {
    console.error('SMOKE DIRECT READ ERROR', error);
  }
}


async function smokeTestEntriesCollection() {
  try {
    console.log('SMOKE COLLECTION READ START');

    const snap = await getDocs(collection(db, 'entries'));

    console.log('SMOKE COLLECTION READ COUNT', snap.size);
    console.log(
      'SMOKE COLLECTION IDS',
      snap.docs.map((d) => d.id)
    );
  } catch (error) {
    console.error('SMOKE COLLECTION READ ERROR', error);
  }
}


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
      console.log('AFTER createEntry', created);

      const freshEntries = await fetchEntriesByUser(user.uid);
      setEntries(freshEntries);

      return created;
    } catch (error) {
      console.error('Failed to create entry:', error);
      alert(error?.message || 'Failed to save entry');
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

      <button type="button" onClick={debugAllEntries}>
        Debug All Entries
      </button>

<button type="button" onClick={debugKnownEntry}>
  Debug Known Entry
</button>


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

<button type="button" onClick={smokeTestDirectRead}>
  Smoke Direct Read
</button>
<button type="button" onClick={smokeTestEntriesCollection}>
  Smoke Collection Read
</button>
    </div>
  );
}