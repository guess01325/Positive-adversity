export const fallbackEvents = [
  {
    title: "Community Outreach",
    description: "We are changing community with each meal.",
    eventType: "Food Drive",
    eventDate: "2018-11-11",
    details: "We are changing community with each meal",
    contact: "860-303-0122",
    contactEmail: "Allan@PositiveAdversity.org",
    mediaUrl: "",
    mediaType: "",
    mediaName: "",
    active: true,
  },
];

export const initialEventForm = {
  title: "",
  description: "",
  eventType: "",
  eventDate: "",
  details: "",
  contact: "",
  contactEmail: "Allan@PositiveAdversity.org",
  mediaUrl: "",
  mediaType: "",
  mediaName: "",
  active: true,
};

export function formatEventDate(eventDate) {
  if (!eventDate) return "";

  const date = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return eventDate;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function normalizeEventForm(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    eventType: form.eventType.trim(),
    eventDate: form.eventDate,
    details: form.details.trim(),
    contact: form.contact.trim(),
    contactEmail: form.contactEmail.trim(),
    mediaUrl: form.mediaUrl || "",
    mediaType: form.mediaType || "",
    mediaName: form.mediaName || "",
    active: Boolean(form.active),
  };
}
