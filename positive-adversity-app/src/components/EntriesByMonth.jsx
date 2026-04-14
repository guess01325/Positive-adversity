import { useMemo } from 'react';
import { formatCurrency } from '../lib/utils';

export default function EntriesByMonth({
  entries,
  emptyMessage = 'No entries found.',
  showInternalTotals = false,
  showStudent = false,
  showAdminActions = false,
  onEdit,
  onDelete,
}) {
  const groupedEntries = useMemo(() => {
    const groups = entries.reduce((acc, entry) => {
      const month = entry.monthKey || 'No Month';

      if (!acc[month]) {
        acc[month] = [];
      }

      acc[month].push(entry);
      return acc;
    }, {});

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  if (!entries.length) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {emptyMessage}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEntries.map(([month, monthEntries]) => {
        const monthTotals = monthEntries.reduce(
          (acc, entry) => {
            acc.hours += Number(entry.hours || 0);
            acc.clientPay += Number(entry.totalPay || 0);
            acc.internalPay += Number(entry.internalTotal || 0);
            acc.count += 1;
            return acc;
          },
          { hours: 0, clientPay: 0, internalPay: 0, count: 0 }
        );

        return (
          <section
            key={month}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{month}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {monthTotals.count} entries • {monthTotals.hours.toFixed(2)} hours
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Client Pay
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(monthTotals.clientPay)}
                  </p>
                </div>

                {showInternalTotals && (
                  <div className="rounded-xl bg-slate-100 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Internal Pay
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatCurrency(monthTotals.internalPay)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {monthEntries.map((entry, index) => (
                <div
                  key={entry.id || `${entry.date}-${entry.serviceType}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {entry.date || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Service Type
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {entry.serviceType || '—'}
                      </p>
                    </div>

                    {showStudent && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Student
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {entry.student || '—'}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Hours
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {Number(entry.hours || 0).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client Rate
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatCurrency(Number(entry.hourlyRate || 0))}/hr
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client Total
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatCurrency(Number(entry.totalPay || 0))}
                      </p>
                    </div>

                    {showInternalTotals && (
                      <>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Internal Rate
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {formatCurrency(Number(entry.internalRate || 0))}/hr
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Internal Total
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {formatCurrency(Number(entry.internalTotal || 0))}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Note
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                      {entry.note || '—'}
                    </p>
                  </div>

                  {entry.userName && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Staff Member
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{entry.userName}</p>
                    </div>
                  )}

                  {showAdminActions && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(entry)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete?.(entry.id)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}