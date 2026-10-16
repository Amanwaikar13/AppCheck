// Fixed locale and time zone so server and client render identical strings.
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDateTime(iso) {
  return `${dateTimeFormat.format(new Date(iso))} UTC`;
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatTime(iso) {
  return `${timeFormat.format(new Date(iso))} UTC`;
}
