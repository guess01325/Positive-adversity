import { useMemo, useState } from "react";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString();
}

function formatTime(value) {
  if (!value) return "-";

  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    const [hourString, minute] = value.split(":");
    const hour = Number(hourString);

    if (Number.isNaN(hour)) return value;

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEntryDate(entry) {
  return entry?.date || formatDate(entry?.startTime);
}

function getInternalTotal(entry) {
  const hours = Number(entry?.hours || 0);
  const internalRate = Number(entry?.internalRate || 0);

  if (entry?.internalTotal != null) {
    return Number(entry.internalTotal || 0);
  }

  return Number((hours * internalRate).toFixed(2));
}

function groupEntriesByMonth(entries) {
  return entries.reduce((acc, entry) => {
    const monthKey =
      entry.monthKey ||
      (entry.date ? entry.date.slice(0, 7) : "Unknown Month");

    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }

    acc[monthKey].push(entry);
    return acc;
  }, {});
}

function truncateText(text, maxLength = 180) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

export default function EntriesByMonth({
  entries = [],
  emptyMessage = "No entries found.",
  showStudent = false,
  showInternalTotals = false,
  showAdminActions = false,
  showTimes = true,
  onEdit,
  onDelete,
}) {
  const [selectedNote, setSelectedNote] = useState(null);

  const groupedEntries = useMemo(() => {
    const grouped = groupEntriesByMonth(entries);
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  if (!entries.length) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {emptyMessage}
      </section>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groupedEntries.map(([month, monthEntries]) => {
          const monthTotals = monthEntries.reduce(
            (acc, entry) => {
              const hours = Number(entry.hours || 0);
              const totalPay = Number(entry.totalPay || 0);
              const internalTotal = getInternalTotal(entry);

              acc.hours += hours;
              acc.totalPay += totalPay;
              acc.internalTotal += internalTotal;

              return acc;
            },
            {
              hours: 0,
              totalPay: 0,
              internalTotal: 0,
            }
          );

          return (
            <section key={month} className="space-y-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {month}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {monthEntries.length} entr{monthEntries.length === 1 ? "y" : "ies"}
                    </p>
                  </div>

                  <div
                    className={`grid gap-3 sm:grid-cols-2 ${
                      showInternalTotals ? "lg:grid-cols-3" : "lg:grid-cols-2"
                    }`}
                  >
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Hours
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {monthTotals.hours.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Client Total
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {formatMoney(monthTotals.totalPay)}
                      </p>
                    </div>

                    {showInternalTotals && (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Internal Total
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-900">
                          {formatMoney(monthTotals.internalTotal)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {monthEntries.map((entry) => {
                  const internalTotal = getInternalTotal(entry);
                  const noteValue = String(entry.note || "").trim();
                  const truncatedNote = truncateText(noteValue, 180);
                  const hasLongNote = noteValue.length > 180;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1 min-w-0 flex-1">
                          {showStudent && (
                            <p className="text-lg font-semibold text-slate-900">
                              {entry.student || "No student"}
                            </p>
                          )}

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">User:</span>{" "}
                            {entry.userName || entry.userEmail || entry.userId || "-"}
                          </p>

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Service:</span>{" "}
                            {entry.serviceType || "-"}
                          </p>

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Date:</span>{" "}
                            {getEntryDate(entry)}
                          </p>

                          {showTimes && (
                            <p className="text-sm text-slate-600">
                              <span className="font-medium">Time:</span>{" "}
                              {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                            </p>
                          )}

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Hours:</span>{" "}
                            {Number(entry.hours || 0).toFixed(2)}
                          </p>

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Client Rate:</span>{" "}
                            {formatMoney(entry.hourlyRate || 0)}
                          </p>

                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Client Total:</span>{" "}
                            {formatMoney(entry.totalPay || 0)}
                          </p>

                          {showInternalTotals && (
                            <>
                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Internal Rate:</span>{" "}
                                {formatMoney(entry.internalRate || 0)}
                              </p>

                              <p className="text-sm text-slate-600">
                                <span className="font-medium">Internal Total:</span>{" "}
                                {formatMoney(internalTotal)}
                              </p>
                            </>
                          )}

                          {noteValue && (
                            <div className="pt-2">
                              <p className="text-sm text-slate-700 break-words">
                                <span className="font-medium">Note:</span>{" "}
                                {truncatedNote}
                              </p>

                              {hasLongNote && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedNote(noteValue)}
                                  className="mt-2 text-sm font-medium text-slate-700 underline hover:text-slate-900"
                                >
                                  View full note
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {showAdminActions && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit?.(entry)}
                              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => onDelete?.(entry.id)}
                              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Full Note</h3>
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {selectedNote}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}