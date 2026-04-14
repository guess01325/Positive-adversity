import { useMemo, useState } from 'react';
import { SERVICE_OPTIONS, SERVICE_RATES } from '../lib/constants';
import { calculateHours, toMonthKey } from '../lib/utils';

const initialState = {
  serviceType: 'DCF',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '17:00',
  note: '',
  student: '',
};

export default function EntryForm({ onSubmit, submitting }) {
  const [form, setForm] = useState(initialState);

  const hours = useMemo(
    () => calculateHours(form.startTime, form.endTime),
    [form.startTime, form.endTime]
  );

  const selectedRates = SERVICE_RATES[form.serviceType];
  const clientRate = selectedRates?.client ?? 0;
  const internalRate = selectedRates?.internal ?? 0;

  const totalPay = useMemo(() => clientRate * hours, [clientRate, hours]);
  const internalTotal = useMemo(
    () => internalRate * hours,
    [internalRate, hours]
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      ...form,
      student: form.student.trim(),
      hours,
      hourlyRate: clientRate,
      totalPay,
      internalRate,
      internalTotal,
      monthKey: toMonthKey(form.date),
    };

    try {
      await onSubmit(payload);
      setForm((current) => ({
        ...initialState,
        date: current.date,
      }));
    } catch (error) {
      console.error('Failed to submit entry form:', error);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Add work entry</h2>
          <p className="mt-1 text-sm text-slate-500">
            Log the day, time, note, student, and calculated pay.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live total
          </p>
          <p className="text-2xl font-bold text-slate-900">${totalPay.toFixed(2)}</p>
        </div>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="serviceType"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Service type
          </label>
          <select
            id="serviceType"
            name="serviceType"
            value={form.serviceType}
            onChange={updateField}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {SERVICE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} (${SERVICE_RATES[option].client}/hr)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="mb-2 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={form.date}
            onChange={updateField}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="startTime"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Start time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            value={form.startTime}
            onChange={updateField}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="endTime" className="mb-2 block text-sm font-medium text-slate-700">
            End time
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            value={form.endTime}
            onChange={updateField}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="student" className="mb-2 block text-sm font-medium text-slate-700">
            Student
          </label>
          <input
            id="student"
            name="student"
            type="text"
            value={form.student}
            onChange={updateField}
            placeholder="Enter student name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="note" className="mb-2 block text-sm font-medium text-slate-700">
            Note
          </label>
          <textarea
            id="note"
            name="note"
            rows="6"
            value={form.note}
            onChange={updateField}
            placeholder="Add session notes..."
            maxLength={10000}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">{form.note.length}/10000 characters</p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hours
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{hours.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rate
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">${clientRate}/hr</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Month bucket
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{toMonthKey(form.date)}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? 'Saving...' : 'Save entry'}
          </button>
        </div>
      </form>
    </section>
  );
}
