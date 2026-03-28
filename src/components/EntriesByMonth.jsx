import { formatCurrency, groupEntriesByMonth, toMonthLabel } from '../lib/utils';

export default function EntriesByMonth({ entries, emptyMessage = 'No entries yet.' }) {
  const grouped = groupEntriesByMonth(entries);
  const monthKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  if (!entries.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
        {emptyMessage}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {monthKeys.map((monthKey) => {
        const month = grouped[monthKey];
        return (
          <section key={monthKey} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{toMonthLabel(monthKey)}</h3>
                <p className="mt-1 text-sm text-slate-500">{month.entries.length} entries recorded</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{month.totalHours.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(month.totalPay)}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Service</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Hours</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Rate</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Note</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {month.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-slate-700">{entry.date}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.serviceType}</td>
                      <td className="px-4 py-3 text-slate-700">{Number(entry.hours).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(entry.hourlyRate)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(entry.totalPay)}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.note}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.userName || entry.userEmail || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
