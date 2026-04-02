import { useEffect, useMemo, useState } from 'react';
import EntriesByMonth from '../components/EntriesByMonth';
import { fetchAllEntries } from '../lib/firestore';
import { formatCurrency } from '../lib/utils';

export default function AdminPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchAllEntries();
        setEntries(data);
      } catch (error) {
        console.error('Failed to load admin entries:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const userOptions = useMemo(() => {
    const map = new Map();

    entries.forEach((entry) => {
      const id = entry.userId;
      const name = entry.userName || entry.name || entry.employeeName || entry.userId;

      if (id && !map.has(id)) {
        map.set(id, name);
      }
    });

    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [entries]);

  const monthOptions = useMemo(() => {
    const months = [...new Set(entries.map((entry) => entry.monthKey).filter(Boolean))];
    return months.sort().reverse();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const search = studentSearch.trim().toLowerCase();

    return entries.filter((entry) => {
      const userMatch = selectedUser === 'all' || entry.userId === selectedUser;
      const monthMatch = selectedMonth === 'all' || entry.monthKey === selectedMonth;
      const studentName = (entry.student || '').toLowerCase();
      const studentMatch = !search || studentName.includes(search);

      return userMatch && monthMatch && studentMatch;
    });
  }, [entries, selectedUser, selectedMonth, studentSearch]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.clientPay += Number(entry.totalPay || 0);
        acc.internalPay += Number(entry.internalTotal || 0);
        acc.hours += Number(entry.hours || 0);
        acc.count += 1;
        return acc;
      },
      { clientPay: 0, internalPay: 0, hours: 0, count: 0 },
    );
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">All Staff Overview</h2>
            <p className="mt-2 text-sm text-slate-500">
              Review all users, notes, totals, and service entries in one place for HR and payroll.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.count}</p>
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.hours.toFixed(2)}</p>
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client pay</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(totals.clientPay)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal pay</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(totals.internalPay)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Filter by user</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All Users</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Filter by month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All Months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Search by student</label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Type student name..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          Loading admin data...
        </section>
      ) : (
        <EntriesByMonth
          entries={filteredEntries}
          emptyMessage="No employee data has been logged yet."
          showStudent={true}
          showInternalTotals={true}
        />
      )}
    </div>
  );
}