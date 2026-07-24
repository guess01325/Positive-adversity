import { useEffect, useMemo, useState } from "react";
import EntriesByMonth from "../components/EntriesByMonth";
import { useAuth } from "../contexts/AuthContext";
import {
  addMonthlyFeeAdjustment,
  deleteAdjustment,
  deleteEntry,
  fetchAllEntries,
  findMonthlyFeeAdjustment,
  updateEntry,
} from "../lib/firestore";
import { exportEntriesPdf } from "../lib/exportReportPdf";
import {
  SERVICE_OPTIONS,
  SERVICE_RATES,
  getMonthlyFeeOptionsForService,
} from "../lib/constants";
import {
  getEntryMonthKey,
  monthKeyFromEntryDate,
} from "../lib/entryMonth";

function formatDateForInput(dateValue) {
  if (!dateValue) return "";

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeForInput(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  const combined = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(combined.getTime())) return null;

  return combined;
}

function calculateHours(startDate, endDate) {
  if (!startDate || !endDate) return "";

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return "";

  const hours = diffMs / (1000 * 60 * 60);
  return Number(hours.toFixed(2));
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalizeStudentName(value) {
  return String(value || "").trim().toLowerCase();
}

export default function AdminPage() {
  const { user, role, isAdmin } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    student: "",
    serviceType: "DCF",
    date: "",
    startTime: "",
    endTime: "",
    hours: "",
    note: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [monthlyFeeAdjustments, setMonthlyFeeAdjustments] = useState({});
  const [loadingMonthlyFees, setLoadingMonthlyFees] = useState(false);
  const [savingMonthlyFees, setSavingMonthlyFees] = useState({});

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        const data = await fetchAllEntries();
        setEntries(data || []);
      } catch (error) {
        console.error("Failed to load admin entries:", error);
        alert(error?.message || "Failed to load admin entries");
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin || role === "admin") {
      loadEntries();
    } else {
      setLoading(false);
    }
  }, [isAdmin, role]);

  const userOptions = useMemo(() => {
    const map = new Map();

    entries.forEach((entry) => {
      const key = entry.userId || "";
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          label: entry.userName || entry.userEmail || key,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [entries]);

  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(
        entries
          .map((entry) => {
            return getEntryMonthKey(entry);
          })
          .filter(Boolean),
      ),
    );

    return months.sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesUser =
        selectedUser === "all" || entry.userId === selectedUser;

      const entryMonth = getEntryMonthKey(entry);

      const matchesMonth =
        selectedMonth === "all" || entryMonth === selectedMonth;

      const matchesStudent =
        !studentSearch.trim() ||
        (entry.student || "")
          .toLowerCase()
          .includes(studentSearch.toLowerCase().trim());

      const matchesService =
        serviceFilter === "all" || entry.serviceType === serviceFilter;

      return matchesUser && matchesMonth && matchesStudent && matchesService;
    });
  }, [entries, selectedUser, selectedMonth, studentSearch, serviceFilter]);

  const selectedUserLabel =
    selectedUser === "all"
      ? "All Users"
      : userOptions.find((option) => option.userId === selectedUser)?.label ||
        "Selected User";

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        const hours = Number(entry.hours || 0);
        const totalPay = Number(entry.totalPay || 0);
        const internalRate = Number(entry.internalRate || 0);

        const internalTotal =
          entry.internalTotal != null
            ? Number(entry.internalTotal || 0)
            : Number((hours * internalRate).toFixed(2));

        acc.entryCount += 1;
        acc.hours += hours;
        acc.totalPay += totalPay;
        acc.internalTotal += internalTotal;

        return acc;
      },
      {
        entryCount: 0,
        hours: 0,
        totalPay: 0,
        internalTotal: 0,
      },
    );
  }, [filteredEntries]);

  const normalizedStudentSearch = studentSearch.trim();
  const eligibleMonthlyFees = useMemo(() => {
    if (serviceFilter === "all") return [];
    return getMonthlyFeeOptionsForService(serviceFilter);
  }, [serviceFilter]);
  const eligibleMonthlyFeeTypes = useMemo(
    () => eligibleMonthlyFees.map((fee) => fee.value).join("|"),
    [eligibleMonthlyFees],
  );
  const hasSelectedStudentServiceEntry = useMemo(() => {
    if (
      selectedMonth === "all" ||
      serviceFilter === "all" ||
      !normalizedStudentSearch
    ) {
      return false;
    }

    const studentKey = normalizeStudentName(normalizedStudentSearch);

    return entries.some((entry) => {
      return (
        getEntryMonthKey(entry) === selectedMonth &&
        entry.serviceType === serviceFilter &&
        normalizeStudentName(entry.student) === studentKey
      );
    });
  }, [entries, normalizedStudentSearch, selectedMonth, serviceFilter]);
  const canManageMonthlyFees =
    selectedMonth !== "all" &&
    normalizedStudentSearch.length > 0 &&
    eligibleMonthlyFees.length > 0 &&
    hasSelectedStudentServiceEntry;
  const selectedServiceLabel =
    SERVICE_OPTIONS.find((option) => option.value === serviceFilter)?.label ||
    "Select an eligible service";
  const appliedMonthlyFees = useMemo(
    () =>
      eligibleMonthlyFees
        .map((fee) => {
          const adjustment = monthlyFeeAdjustments[fee.value];
          if (!adjustment) return null;

          return {
            label: adjustment.feeName || fee.label,
            amount: Number(adjustment.amount || 0),
            monthKey: adjustment.monthKey || selectedMonth,
          };
        })
        .filter(Boolean),
    [eligibleMonthlyFees, monthlyFeeAdjustments, selectedMonth],
  );
  const appliedMonthlyFeeTotal = useMemo(
    () =>
      appliedMonthlyFees.reduce(
        (sum, fee) => sum + Number(fee?.amount || 0),
        0,
      ),
    [appliedMonthlyFees],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadMonthlyFeeAdjustments() {
      if (!canManageMonthlyFees) {
        setMonthlyFeeAdjustments({});
        return;
      }

      try {
        setLoadingMonthlyFees(true);
        const adjustments = await Promise.all(
          eligibleMonthlyFees.map(async (fee) => {
            const adjustment = await findMonthlyFeeAdjustment(
              fee.value,
              selectedMonth,
              normalizedStudentSearch,
            );

            return [fee.value, adjustment];
          }),
        );

        if (!isCancelled) {
          setMonthlyFeeAdjustments(Object.fromEntries(adjustments));
        }
      } catch (error) {
        console.error("Failed to load monthly fee adjustments:", error);
        if (!isCancelled) {
          setMonthlyFeeAdjustments({});
        }
      } finally {
        if (!isCancelled) {
          setLoadingMonthlyFees(false);
        }
      }
    }

    loadMonthlyFeeAdjustments();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedMonth,
    normalizedStudentSearch,
    eligibleMonthlyFees,
    eligibleMonthlyFeeTypes,
    canManageMonthlyFees,
  ]);

  async function handleDownloadPdf() {
    try {
      await exportEntriesPdf({
        entries: filteredEntries,
        selectedMonth,
        visibleUserLabel: selectedUserLabel,
        monthlyFees: appliedMonthlyFees,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(error?.message || "PDF export failed.");
    }
  }

  async function handleAddMonthlyFee(fee) {
    if (!canManageMonthlyFees) {
      alert(
        "Select an eligible service, choose a specific month, and enter a student with that service first.",
      );
      return;
    }

    try {
      setSavingMonthlyFees((current) => ({ ...current, [fee.value]: true }));

      const existing = await findMonthlyFeeAdjustment(
        fee.value,
        selectedMonth,
        normalizedStudentSearch,
      );

      if (existing) {
        setMonthlyFeeAdjustments((current) => ({
          ...current,
          [fee.value]: existing,
        }));
        alert(`${fee.label} is already applied for this student and month.`);
        return;
      }

      await addMonthlyFeeAdjustment({
        feeType: fee.value,
        monthKey: selectedMonth,
        student: normalizedStudentSearch,
        createdBy: user?.email || "",
      });

      const refreshed = await findMonthlyFeeAdjustment(
        fee.value,
        selectedMonth,
        normalizedStudentSearch,
      );

      setMonthlyFeeAdjustments((current) => ({
        ...current,
        [fee.value]: refreshed || null,
      }));

      if (refreshed) {
        alert(`${fee.label} applied.`);
      } else {
        alert(`${fee.label} may have saved, but it did not refresh correctly.`);
      }
    } catch (error) {
      console.error("Failed to add monthly fee adjustment:", error);
      alert(error?.message || `Failed to add ${fee.label}.`);
    } finally {
      setSavingMonthlyFees((current) => ({ ...current, [fee.value]: false }));
    }
  }

  async function handleRemoveMonthlyFee(fee) {
    const adjustment = monthlyFeeAdjustments[fee.value];
    if (!adjustment?.id) return;

    const confirmed = window.confirm(`Remove ${fee.label} for this student and month?`);
    if (!confirmed) return;

    try {
      setSavingMonthlyFees((current) => ({ ...current, [fee.value]: true }));

      await deleteAdjustment(adjustment.id);

      const refreshed = await findMonthlyFeeAdjustment(
        fee.value,
        selectedMonth,
        normalizedStudentSearch,
      );

      setMonthlyFeeAdjustments((current) => ({
        ...current,
        [fee.value]: refreshed || null,
      }));

      if (!refreshed) {
        alert(`${fee.label} removed.`);
      } else {
        alert(`${fee.label} may still exist for this selection.`);
      }
    } catch (error) {
      console.error("Failed to remove monthly fee adjustment:", error);
      alert(error?.message || `Failed to remove ${fee.label}.`);
    } finally {
      setSavingMonthlyFees((current) => ({ ...current, [fee.value]: false }));
    }
  }

  function handleEdit(entry) {
    setEditingEntry(entry);

    const dateInput =
      entry.date ||
      formatDateForInput(entry.startTime) ||
      formatDateForInput(entry.createdAt);

    const startInput = formatTimeForInput(entry.startTime);
    const endInput = formatTimeForInput(entry.endTime);

    setEditForm({
      student: entry.student || "",
      serviceType: entry.serviceType || "DCF",
      date: dateInput || "",
      startTime: startInput || "",
      endTime: endInput || "",
      hours: String(entry.hours ?? ""),
      note: entry.note || "",
    });

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  function handleCancelEdit() {
    setEditingEntry(null);
    setEditForm({
      student: "",
      serviceType: "DCF",
      date: "",
      startTime: "",
      endTime: "",
      hours: "",
      note: "",
    });
  }

  function handleEditChange(name, value) {
    setEditForm((prev) => {
      const updated = {
        ...prev,
        [name]: value,
      };

      if (name === "date" || name === "startTime" || name === "endTime") {
        const start = combineDateAndTime(updated.date, updated.startTime);
        const end = combineDateAndTime(updated.date, updated.endTime);
        const autoHours = calculateHours(start, end);

        if (autoHours !== "") {
          updated.hours = String(autoHours);
        }
      }

      return updated;
    });
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;

    if (!editForm.date || !editForm.startTime || !editForm.endTime) {
      alert("Please enter date, start time, and end time.");
      return;
    }

    const startDateTime = combineDateAndTime(editForm.date, editForm.startTime);
    const endDateTime = combineDateAndTime(editForm.date, editForm.endTime);

    if (!startDateTime || !endDateTime) {
      alert("Please enter valid date and time values.");
      return;
    }

    if (endDateTime <= startDateTime) {
      alert("End time must be after start time.");
      return;
    }

    const hours = Number(editForm.hours);
    if (Number.isNaN(hours) || hours < 0) {
      alert("Please enter valid hours.");
      return;
    }

    try {
      setSavingEdit(true);

      const serviceType = editForm.serviceType.trim();
      const rateConfig = SERVICE_RATES[serviceType] || {};
      const hourlyRate =
        rateConfig.client != null
          ? Number(rateConfig.client)
          : Number(editingEntry.hourlyRate || 0);
      const internalRate =
        rateConfig.internal != null
          ? Number(rateConfig.internal)
          : Number(editingEntry.internalRate || 0);

      const updates = {
        student: editForm.student.trim(),
        serviceType,
        date: editForm.date,
        monthKey: monthKeyFromEntryDate(editForm.date),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        hours,
        note: editForm.note.trim(),
        hourlyRate,
        internalRate,
        totalPay: Number((hours * hourlyRate).toFixed(2)),
        internalTotal: Number((hours * internalRate).toFixed(2)),
      };

      await updateEntry(editingEntry.id, updates);

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntry.id
            ? {
                ...entry,
                ...updates,
              }
            : entry,
        ),
      );

      alert("Entry updated successfully.");
      handleCancelEdit();
    } catch (error) {
      console.error("Update failed:", error);
      alert(error?.message || "Failed to update entry.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(entryId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this entry?",
    );
    if (!confirmed) return;

    try {
      await deleteEntry(entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));

      if (editingEntry?.id === entryId) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert(error?.message || "Failed to delete entry.");
    }
  }

  const handlePaymentConfirmedToggle = async (entry) => {
    const isCurrentlyConfirmed = entry.paymentConfirmed === true;
    const newValue = !isCurrentlyConfirmed;

    // Only confirm when turning OFF
    if (isCurrentlyConfirmed) {
      const confirmTurnOff = window.confirm(
        "Are you sure you want to remove payment confirmation?",
      );

      if (!confirmTurnOff) return;
    }

    try {
      await updateEntry(entry.id, {
        paymentConfirmed: newValue,
      });

      setEntries((prevEntries) =>
        prevEntries.map((item) =>
          item.id === entry.id ? { ...item, paymentConfirmed: newValue } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to update payment confirmation:", error);
      alert("Payment confirmation could not be updated. Please try again.");
    }
  };

  if (!user) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        You must be signed in to view this page.
      </section>
    );
  }

  if (!isAdmin && role !== "admin") {
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
          Review all work sessions, search by student, manage entries, add DCF
          supervision by month, and download reports.
        </p>
      </section>

      {editingEntry && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Edit Entry
              </h3>
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
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Student
              </label>
              <input
                type="text"
                value={editForm.student}
                onChange={(e) => handleEditChange("student", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Service Type
              </label>
              <select
                value={editForm.serviceType}
                onChange={(e) =>
                  handleEditChange("serviceType", e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} (${SERVICE_RATES[option.value]?.client ?? 0}
                    /hr)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => handleEditChange("date", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Start Time
              </label>
              <input
                type="time"
                value={editForm.startTime}
                onChange={(e) => handleEditChange("startTime", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                End Time
              </label>
              <input
                type="time"
                value={editForm.endTime}
                onChange={(e) => handleEditChange("endTime", e.target.value)}
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
                onChange={(e) => handleEditChange("note", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-medium">Calculated Hours:</span>{" "}
              {editForm.hours || "0"}
            </p>
            <p>
              <span className="font-medium">Client Total:</span>{" "}
              {formatMoney(
                Number(editForm.hours || 0) *
                  Number(
                    SERVICE_RATES[editForm.serviceType]?.client ??
                      editingEntry?.hourlyRate ??
                      0,
                  ),
              )}
            </p>
            <p>
              <span className="font-medium">Internal Total:</span>{" "}
              {formatMoney(
                Number(editForm.hours || 0) *
                  Number(
                    SERVICE_RATES[editForm.serviceType]?.internal ??
                      editingEntry?.internalRate ??
                      0,
                  ),
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
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
        <div className="grid gap-3 md:grid-cols-4">
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

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All Services</option>
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {eligibleMonthlyFees.length > 0 && (
          <div className="mt-4 space-y-3">
            {eligibleMonthlyFees.map((fee) => {
              const adjustment = monthlyFeeAdjustments[fee.value] || null;
              const isSaving = savingMonthlyFees[fee.value] === true;

              return (
                <div
                  key={fee.value}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {fee.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Apply one {formatMoney(fee.amount)} charge for the
                        selected month and student.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                          Service:{" "}
                          <span className="font-medium">
                            {selectedServiceLabel}
                          </span>
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                          Month:{" "}
                          <span className="font-medium">
                            {selectedMonth === "all"
                              ? "Select a month"
                              : selectedMonth}
                          </span>
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                          Student:{" "}
                          <span className="font-medium">
                            {normalizedStudentSearch || "Enter a student name"}
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            loadingMonthlyFees
                              ? "bg-amber-100 text-amber-700"
                              : adjustment
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {loadingMonthlyFees
                            ? "Status: Checking..."
                            : adjustment
                            ? "Status: Active"
                            : "Status: Not Applied"}
                        </span>

                        <span className="text-sm text-slate-600">
                          Fee Amount:{" "}
                          <span className="font-medium">
                            {formatMoney(fee.amount)}
                          </span>
                        </span>

                        {adjustment && (
                          <span className="text-sm font-medium text-green-700">
                            Applied
                          </span>
                        )}
                      </div>

                      {adjustment && (
                        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                          <span className="font-medium">Matched Record:</span>{" "}
                          {adjustment.student} • {adjustment.monthKey} •{" "}
                          {adjustment.feeName || fee.label}
                        </div>
                      )}

                      {!canManageMonthlyFees && (
                        <p className="mt-3 text-sm text-amber-700">
                          Select a specific month and enter a student with this
                          service to manage this fee.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddMonthlyFee(fee)}
                        disabled={
                          !canManageMonthlyFees || !!adjustment || isSaving
                        }
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving && !adjustment
                          ? "Applying..."
                          : `Apply ${fee.label} (${formatMoney(fee.amount)})`}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveMonthlyFee(fee)}
                        disabled={!adjustment || isSaving}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving && adjustment
                          ? "Removing..."
                          : `Remove ${fee.label}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Entries
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {totals.entryCount}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Hours
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {totals.hours.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Client Total
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totals.totalPay)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Internal Total
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totals.internalTotal + appliedMonthlyFeeTotal)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!filteredEntries.length}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            PDF Report
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
          showTimes={true}
          monthlyFees={appliedMonthlyFees}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPaymentConfirmedToggle={handlePaymentConfirmedToggle}
        />
      )}
    </div>
  );
}
