import { useEffect, useState } from "react";
import { formatEventDate } from "../lib/events";
import { fetchEvents } from "../lib/firestore";

function EventMedia({ event }) {
  if (!event.mediaUrl) {
    return <div className="mx-auto h-px w-48 bg-slate-300" />;
  }

  if (event.mediaType?.includes("pdf")) {
    return (
      <a
        href={event.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="mx-auto block max-w-sm rounded-xl border border-slate-300 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-900 hover:bg-slate-100"
      >
        View Event PDF
      </a>
    );
  }

  return (
    <img
      src={event.mediaUrl}
      alt={event.title}
      className="mx-auto max-h-80 w-full max-w-xl rounded-xl object-contain"
    />
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDetails, setExpandedDetails] = useState({});

  useEffect(() => {
    let isCancelled = false;

    async function loadEvents() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchEvents();

        if (!isCancelled) {
          setEvents(data || []);
        }
      } catch (error) {
        console.error("Failed to load events:", error);
        if (!isCancelled) {
          setError("Events could not be loaded right now.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Positive Adversity
        </p>
        <h1 className="mt-2 text-3xl font-bold">Events</h1>
        <p className="mt-2 text-sm text-slate-300">
          Community events, outreach, and upcoming opportunities.
        </p>
      </div>

      {loading ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          Loading events...
        </p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No events are posted yet.
        </p>
      ) : (
        <div className="space-y-5">
          {events.map((event, index) => {
            const eventKey = event.id || `${event.title}-${index}`;
            const isExpanded = Boolean(expandedDetails[eventKey]);
            const shouldCollapseDetails = (event.details || "").length > 140;

            return (
              <article
                key={eventKey}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <EventMedia event={event} />

                <div className="mt-6 text-center">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    {event.title}
                  </p>

                  {event.description ? (
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      {event.description}
                    </p>
                  ) : null}

                  {event.eventType ? (
                    <p className="mt-5 text-sm font-extrabold text-slate-900">
                      {event.eventType}
                    </p>
                  ) : null}

                  {event.eventDate || event.dateLabel ? (
                    <p className="mt-4 text-sm font-extrabold text-slate-900">
                      {formatEventDate(event.eventDate) || event.dateLabel}
                    </p>
                  ) : null}

                  {event.details ? (
                    <div className="mx-auto mt-6 max-w-xl rounded-xl bg-slate-50 p-4">
                      <p className="text-sm font-extrabold text-slate-900">
                        Details
                      </p>
                      <p
                        className={`mt-3 text-sm font-semibold text-slate-700 ${
                          shouldCollapseDetails && !isExpanded
                            ? "line-clamp-3"
                            : ""
                        }`}
                      >
                        {event.details}
                      </p>

                      {shouldCollapseDetails ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDetails((currentDetails) => ({
                              ...currentDetails,
                              [eventKey]: !isExpanded,
                            }))
                          }
                          className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? "Show Less" : "Read More"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {event.contact || event.contactEmail ? (
                    <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-extrabold text-slate-900">
                      {event.contact ? (
                        <a href={`tel:${event.contact.replace(/\D/g, "")}`}>
                          Call us: {event.contact}
                        </a>
                      ) : null}

                      {event.contactEmail ? (
                        <a href={`mailto:${event.contactEmail}`}>
                          Email: {event.contactEmail}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
