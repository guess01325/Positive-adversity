const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isValidEntryDate(value) {
  if (typeof value !== "string") return false;

  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

export function monthKeyFromEntryDate(dateString) {
  return isValidEntryDate(dateString) ? dateString.slice(0, 7) : "";
}

export function formatLocalCalendarDate(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getEntryMonthKey(entry) {
  const dateMonthKey = monthKeyFromEntryDate(entry?.date);
  if (dateMonthKey) return dateMonthKey;

  if (typeof entry?.monthKey === "string" && MONTH_KEY_PATTERN.test(entry.monthKey)) {
    return entry.monthKey;
  }

  const startDate = entry?.startTime?.toDate?.() || entry?.startTime;
  if (startDate) {
    const parsedStartDate = new Date(startDate);
    if (!Number.isNaN(parsedStartDate.getTime())) {
      return formatLocalCalendarDate(parsedStartDate).slice(0, 7);
    }
  }

  return "";
}

function normalizeStudent(value) {
  return String(value || "").trim().toLowerCase();
}

export function auditEntryMonthKeys(entries = [], adjustments = []) {
  const dcfAdjustments = adjustments.filter(
    (adjustment) =>
      adjustment?.type === "dcf_supervision" &&
      adjustment?.serviceType === "DCF",
  );

  return entries.flatMap((entry) => {
    const expectedMonthKey = monthKeyFromEntryDate(entry?.date);
    if (!expectedMonthKey || entry?.monthKey === expectedMonthKey) return [];

    const studentKey = normalizeStudent(entry?.student);
    const relevantMonthKeys = new Set(
      [entry?.monthKey, expectedMonthKey].filter(Boolean),
    );
    const relatedDCFAdjustments = studentKey
      ? dcfAdjustments.filter(
          (adjustment) =>
            normalizeStudent(adjustment?.student) === studentKey &&
            relevantMonthKeys.has(adjustment?.monthKey),
        )
      : [];

    return [
      {
        entry,
        storedMonthKey: entry?.monthKey || "(missing)",
        expectedMonthKey,
        relatedDCFAdjustments,
      },
    ];
  });
}
