import { useEffect, useMemo, useState } from 'react';
import EntriesByMonth from '../components/EntriesByMonth';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteEntry,
  fetchAllEntries,
  updateEntry,
} from '../lib/firestore';
import { exportEntriesPdf } from '../lib/exportReportPdf';

export default function AdminPage() {
  const { user, role, isAdmin } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    student: '',
    serviceType: '',
    hours: '',
    note: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        const data = await fetchAllEntries();
        setEntries(data);
      } catch (error) {
        console.error('Failed to load admin entries:', error);
        alert(error?.message || 'Failed to load admin entries');
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin || role === 'admin') {
      loadEntries();
    } else {
      setLoading(false);
    }
  }, [isAdmin, role]);

  const userOptions = useMemo(() => {
    const map = new Map();

    entries.forEach((entry) => {
      const key = entry.userId || '';
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          label: entry.userName || entry.userEmail || key,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [entries]);

  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(entries.map((entry) => entry.monthKey).filter(Boolean))
    );

    return months.sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesUser =
        selectedUser === 'all' || entry.userId === selectedUser;

      const matchesMonth =
        selectedMonth === 'all' || entry.monthKey === selectedMonth;

      const matchesStudent =
        !studentSearch.trim() ||
        (entry.student || '')
          .toLowerCase()
          .includes(studentSearch.toLowerCase().trim());

      return matchesUser && matchesMonth && matchesStudent;
    });
  }, [entries, selectedUser, selectedMonth, studentSearch]);

  const selectedUserLabel =
    selectedUser === 'all'
      ? 'All Users'
      : userOptions.find((option) => option.userId === selectedUser)?.label ||
        'Selected User';

  function handleDownloadPdf() {
    exportEntriesPdf({
      entries: filteredEntries,
      selectedUser,
      selectedMonth,
      visibleUserLabel: selectedUserLabel,
    });
  }

  function handleEdit(entry) {
    setEditingEntry(entry);
    setEditForm({
      student: entry.student || '',
      serviceType: entry.serviceType || '',
      hours: String(entry.hours ?? ''),
      note: entry.note || '',
    });

    // helpful on mobile so user sees the form immediately
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  function handleCancelEdit() {
    setEditingEntry(null);
    setEditForm({
      student: '',
      serviceType: '',
      hours: '',
      note: '',
    });
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;

    const hours = Number(editForm.hours);
    if (Number.isNaN(hours) || hours < 0) {
      alert('Please enter valid hours.');
      return;
    }

    try {
      setSavingEdit(true);

      const hourlyRate = Number(editingEntry.hourlyRate || 0);
      const internalRate = Number(editingEntry.internalRate || 0);

      const updates = {
        student: editForm.student.trim(),
        serviceType: editForm.serviceType.trim(),
        hours,
        note: editForm.note.trim(),
        totalPay: hours * hourlyRate,
        internalTotal: hours * internalRate,
      };

      await updateEntry(editingEntry.id, updates);

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntry.id
            ? {
                ...entry,
                ...updates,
              }
            : entry
        )
      );

      alert('Entry updated successfully.');
      handleCancelEdit();
    } catch (error) {
      console.error('Update failed:', error);
      alert(error?.message || 'Failed to update entry.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(entryId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this entry?'
    );
    if (!confirmed) return;

    try {
      await deleteEntry(entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));

      if (editingEntry?.id === entryId) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error?.message || 'Failed to delete entry.');
    }
  }

  if (!user) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        You must be signed in to view this page.
      </section>
    );
  }

  if (!isAdmin && role !== 'admin') {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        You do not have access to this page.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Review all work sessions, search by student, manage entries, and download reports.
        </p>
      </section>

      {editingEntry && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Edit Entry</h3>
              <p className="mt-1 text-sm text-slate-500">
                Update the selected entry and save changes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Student
              </label>
              <input
                type="text"
                value={editForm.student}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, student: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Service Type
              </label>
              <input
                type="text"
                value={editForm.serviceType}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    serviceType: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={editForm.hours}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, hours: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Note
              </label>
              <textarea
                rows={4}
                value={editForm.note}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, note: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All Users</option>
            {userOptions.map((option) => (
              <option key={option.userId} value={option.userId}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All Months</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by student"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!filteredEntries.length}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          Loading admin entries...
        </section>
      ) : (
        <EntriesByMonth
          entries={filteredEntries}
          emptyMessage="No matching work sessions found."
          showStudent={true}
          showInternalTotals={true}
          showAdminActions={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}