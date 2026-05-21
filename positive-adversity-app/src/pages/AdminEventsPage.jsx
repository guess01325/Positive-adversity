import { useEffect, useState } from "react";
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEvent,
} from "../lib/firestore";
import {
  formatEventDate,
  initialEventForm,
  normalizeEventForm,
} from "../lib/events";

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function EventMediaPreview({ event }) {
  if (!event.mediaUrl) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-2 text-xs text-slate-500">
        No media
      </div>
    );
  }

  if (event.mediaType === "application/pdf") {
    return (
      <a
        href={event.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 p-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-100"
      >
        View PDF
      </a>
    );
  }

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-2">
      <img
        src={event.mediaUrl}
        alt={event.title}
        className="max-h-20 rounded-lg object-contain"
      />
    </div>
  );
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [editingEventId, setEditingEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchEvents({ includeInactive: true });
      setEvents(data || []);
    } catch (loadError) {
      console.error("Failed to load events:", loadError);
      setError(loadError?.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function handleFormChange(event) {
    const { name, value, checked, type } = event.target;

    setEventForm((currentForm) => ({
      ...currentForm,
      [name]:
        type === "checkbox"
          ? checked
          : name === "contact"
            ? formatPhoneNumber(value)
            : value,
    }));
  }

  function handleEditEvent(event) {
    setMessage("");
    setError("");
    setEditingEventId(event.id);
    setEventForm({
      title: event.title || "",
      description: event.description || "",
      eventType: event.eventType || "",
      eventDate: event.eventDate || event.dateLabel || "",
      details: event.details || "",
      contact: event.contact || "",
      contactEmail: event.contactEmail || "",
      mediaUrl: event.mediaUrl || "",
      mediaType: event.mediaType || "",
      mediaName: event.mediaName || "",
      active: event.active !== false,
    });
  }

  function handleCancelEdit() {
    setEditingEventId("");
    setEventForm(initialEventForm);
  }

  async function handleSubmitEvent(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      setSaving(true);
      const payload = normalizeEventForm(eventForm);

      if (!payload.title) {
        throw new Error("Event title is required.");
      }

      if (editingEventId) {
        await updateEvent(editingEventId, payload);
        setMessage("Event updated.");
      } else {
        await createEvent(payload);
        setMessage("Event created.");
      }

      await loadEvents();
      handleCancelEdit();
    } catch (saveError) {
      console.error("Failed to save event:", saveError);
      setError(saveError?.message || "Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingEventId(eventId);

    try {
      await deleteEvent(eventId);
      setEvents((currentEvents) =>
        currentEvents.filter((event) => event.id !== eventId),
      );
      if (editingEventId === eventId) {
        handleCancelEdit();
      }
      setMessage("Event deleted.");
    } catch (deleteError) {
      console.error("Failed to delete event:", deleteError);
      setError(deleteError?.message || "Failed to delete event.");
    } finally {
      setDeletingEventId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Events
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin Events</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create and update events that appear on the public Events page.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">
            {editingEventId ? "Edit Event" : "Create Event"}
          </h2>

          {editingEventId ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmitEvent}>
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="text-sm font-semibold text-slate-700">
              Event Photo or PDF URL
              <input
                type="url"
                name="mediaUrl"
                value={eventForm.mediaUrl}
                onChange={handleFormChange}
                placeholder="https://example.com/event-photo.png"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Media Type
              <select
                name="mediaType"
                value={eventForm.mediaType}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                <option value="">Image</option>
                <option value="application/pdf">PDF</option>
              </select>
            </label>
          </div>

          {eventForm.mediaUrl ? (
            <div className="rounded-xl bg-slate-100 p-3">
              {eventForm.mediaType === "application/pdf" ? (
                <a
                  href={eventForm.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  View Event PDF
                </a>
              ) : (
                <div className="flex h-44 items-center justify-center">
                  <img
                    src={eventForm.mediaUrl}
                    alt={eventForm.title || "Event media preview"}
                    className="max-h-40 rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Event Title
              <input
                type="text"
                name="title"
                value={eventForm.title}
                onChange={handleFormChange}
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Event Type
              <input
                type="text"
                name="eventType"
                value={eventForm.eventType}
                onChange={handleFormChange}
                placeholder="Food Drive"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Event Date
              <input
                type="date"
                name="eventDate"
                value={eventForm.eventDate}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Contact Phone
              <input
                type="text"
                name="contact"
                value={eventForm.contact}
                onChange={handleFormChange}
                placeholder="860-303-0122"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Contact Email
            <input
              type="email"
              name="contactEmail"
              value={eventForm.contactEmail}
              onChange={handleFormChange}
              placeholder="Allan@PositiveAdversity.org"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Short Description
            <textarea
              name="description"
              value={eventForm.description}
              onChange={handleFormChange}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Details
            <textarea
              name="details"
              value={eventForm.details}
              onChange={handleFormChange}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="active"
              checked={eventForm.active}
              onChange={handleFormChange}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : editingEventId ? "Save Event" : "Create Event"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading events...
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No events created yet.
          </p>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <EventMediaPreview event={event} />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {event.active === false ? "Inactive" : "Active"}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {event.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.eventType || "No type"} ·{" "}
                      {formatEventDate(event.eventDate) || "No date"}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {event.details || event.description || "No details"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditEvent(event)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={deletingEventId === event.id}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingEventId === event.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
