import { SERVICE_RATES } from './constants';

export function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end < start) {
    end += 24 * 60;
  }

  return Number(((end - start) / 60).toFixed(2));
}

export function calculatePay(serviceType, hours) {
  const rate = SERVICE_RATES[serviceType] ?? 0;
  return Number((rate * hours).toFixed(2));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value ?? 0));
}

export function toMonthKey(dateString) {
  const date = new Date(dateString);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function toMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function groupEntriesByMonth(entries) {
  return entries.reduce((acc, entry) => {
    const key = entry.monthKey;
    if (!acc[key]) {
      acc[key] = { entries: [], totalPay: 0, totalHours: 0 };
    }
    acc[key].entries.push(entry);
    acc[key].totalPay += Number(entry.totalPay || 0);
    acc[key].totalHours += Number(entry.hours || 0);
    return acc;
  }, {});
}





