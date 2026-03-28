import { useEffect, useMemo, useState } from 'react';
import EntriesByMonth from '../components/EntriesByMonth';
import { fetchAllEntries } from '../lib/firestore';
import { formatCurrency } from '../lib/utils';

export default function AdminPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const data = await fetchAllEntries();
      setEntries(data);
      setLoading(false);
    }

    loadData();
  }, []);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.pay += Number(entry.totalPay || 0);
        acc.hours += Number(entry.hours || 0);
        acc.count += 1;
        return acc;
      },
      { pay: 0, hours: 0, count: 0 },
    );
  }, [entries]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Admin payroll view</h2>
            <p className="mt-2 text-sm text-slate-500">
              Review all users, notes, totals, and service entries in one place for HR and payroll.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.count}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.hours.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(totals.pay)}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">Loading admin data...</section>
      ) : (
        <EntriesByMonth entries={entries} emptyMessage="No employee data has been logged yet." />
      )}
    </div>
  );
}
