import { useEffect, useMemo, useState } from "react";
import EntriesByMonth from "../components/EntriesByMonth";
import { useAuth } from "../contexts/AuthContext";
import { deleteEntry, fetchAllEntries, updateEntry } from "../lib/firestore";
import { exportEntriesPdf } from "../lib/exportReportPdf";

const DCF_SUPERVISION_FEE = 11.25;

function formatDateForInput(dateValue) {
  if (!dateValue) return "";

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeForInput(dateValue) {
  if (!dateValue) return "";

  const d = new Date(dateValue);
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

function getMonthKey(dateStr) {
  if (!dateStr) return "";
  return dateStr.slice(0, 7);
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function AdminPage() {
  const { user, role, isAdmin } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    student: "",
    serviceType: "",
    date: "",
    startTime: "",
    endTime: "",
    hours: "",
    note: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

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
            if (entry.monthKey) return entry.monthKey;
            if (entry.date) return getMonthKey(entry.date);
            if (entry.startTime) {
              const dateStr = formatDateForInput(entry.startTime);
              return getMonthKey(dateStr);
            }
            return "";
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

      const entryMonth =
        entry.monthKey ||
        getMonthKey(entry.date) ||
        (entry.startTime ? getMonthKey(formatDateForInput(entry.startTime)) : "");

      const matchesMonth =
        selectedMonth === "all" || entryMonth === selectedMonth;

      const matchesStudent =
        !studentSearch.trim() ||
        (entry.student || "")
          .toLowerCase()
          .includes(studentSearch.toLowerCase().trim());

      return matchesUser && matchesMonth && matchesStudent;
    });
  }, [entries, selectedUser, selectedMonth, studentSearch]);

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
        const serviceType = String(entry.serviceType || "").trim().toLowerCase();

        const supervisionFee =
          Number(entry.supervisionFee || 0) ||
          (serviceType === "dcf" ? DCF_SUPERVISION_FEE : 0);

        const internalRate = Number(entry.internalRate || 0);
        const fallbackInternalTotal = Number(
          (hours * internalRate + supervisionFee).toFixed(2),
        );

        const internalTotal =
          entry.internalTotal != null
            ? Number(entry.internalTotal || 0)
            : fallbackInternalTotal;

        acc.entryCount += 1;
        acc.hours += hours;
        acc.totalPay += totalPay;
        acc.supervisionFee += supervisionFee;
        acc.internalTotal += internalTotal;

        return acc;
      },
      {
        entryCount: 0,
        hours: 0,
        totalPay: 0,
        supervisionFee: 0,
        internalTotal: 0,
      },
    );
  }, [filteredEntries]);

  async function handleDownloadPdf() {
    try {
      await exportEntriesPdf({
        entries: filteredEntries,
        selectedMonth,
        visibleUserLabel: selectedUserLabel,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(error?.message || "PDF export failed.");
    }
  }

  function handleEdit(entry) {
    setEditingEntry(entry);

    const dateInput =
      entry.date ||
      formatDateForInput(entry.startTime) ||
      formatDateForInput(entry.createdAt);

    const startInput = entry.startTime
      ? formatTimeForInput(entry.startTime)
      : "";

    const endInput = entry.endTime
      ? formatTimeForInput(entry.endTime)
      : "";

    setEditForm({
      student: entry.student || "",
      serviceType: entry.serviceType || "",
      date: dateInput || "",
      startTime: startInput,
      endTime: endInput,
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
      serviceType: "",
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

      const hourlyRate = Number(editingEntry.hourlyRate || 0);
      const internalRate = Number(editingEntry.internalRate || 0);

      const serviceType = editForm.serviceType.trim();
      const isDCF = serviceType.toLowerCase() === "dcf";
      const supervisionFee = isDCF ? DCF_SUPERVISION_FEE : 0;

      const updates = {
        student: editForm.student.trim(),
        serviceType,
        date: editForm.date,
        monthKey: getMonthKey(editForm.date),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        hours,
        note: editForm.note.trim(),
        totalPay: Number((hours * hourlyRate).toFixed(2)),
        supervisionFee,
        internalTotal: Number(
          (hours * internalRate + supervisionFee).toFixed(2),
        ),
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
          Review all work sessions, search by student, manage entries, and
          download reports.
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
            <div>
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
              <input
                type="text"
                value={editForm.serviceType}
                onChange={(e) => handleEditChange("serviceType", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={editForm.hours}
                onChange={(e) => handleEditChange("hours", e.target.value)}
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

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
            <p>
              <span className="font-medium">Calculated Hours:</span>{" "}
              {editForm.hours || "0"}
            </p>
            <p>
              <span className="font-medium">Client Total:</span>{" "}
              {formatMoney(
                Number(editForm.hours || 0) * Number(editingEntry?.hourlyRate || 0),
              )}
            </p>
            <p>
              <span className="font-medium">DCF Supervision Fee:</span>{" "}
              {formatMoney(
                (editForm.serviceType || "").trim().toLowerCase() === "dcf"
                  ? DCF_SUPERVISION_FEE
                  : 0,
              )}
            </p>
            <p>
              <span className="font-medium">Internal Total:</span>{" "}
              {formatMoney(
                Number(editForm.hours || 0) *
                  Number(editingEntry?.internalRate || 0) +
                  ((editForm.serviceType || "").trim().toLowerCase() === "dcf"
                    ? DCF_SUPERVISION_FEE
                    : 0),
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

        <div className="mt-4 grid gap-3 md:grid-cols-5">
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
              DCF Supervision
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totals.supervisionFee)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Internal Total
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totals.internalTotal)}
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
          showTimes={false}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}