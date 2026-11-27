export const zone = "America/Chicago";
export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function localInput(value) {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function parishTimestamp(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("Enter a complete date and time.");
  // Modern Chicago uses UTC-5/-6. Round-trip both candidates to reject DST gaps/overlaps.
  const clock = Date.parse(value + "Z");
  const candidates = [5, 6]
    .map((hours) => new Date(clock + hours * 3600000).toISOString())
    .filter((iso) => localInput(iso) === value);
  if (candidates.length !== 1)
    throw Error(
      "This Central Time is skipped or repeated during daylight saving time. Choose a time outside the clock-change hour.",
    );
  return candidates[0];
}
export function dateLabel(value) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not set";
}
export function clockLabel(value) {
  if (!value) return "";
  const [h, m] = value.split(":");
  return `${Number(h) % 12 || 12}:${m} ${Number(h) >= 12 ? "PM" : "AM"}`;
}
export const addDays = (date, days) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
// Same recurrence/exception rules as the existing public parish calendar.
export function upcomingServices({ services, exceptions }, now = new Date()) {
  const current = localInput(now),
    from = current.slice(0, 10),
    until = addDays(from, 28),
    rows = [];
  for (const service of services) {
    const offset =
      (service.weekday - new Date(from + "T12:00:00Z").getUTCDay() + 7) % 7;
    for (
      let date = addDays(from, offset);
      date < until;
      date = addDays(date, 7)
    ) {
      if (
        (!service.startDate || date >= service.startDate) &&
        (!service.endDate || date <= service.endDate) &&
        !Object.hasOwn(exceptions, service.id + "@" + date)
      )
        rows.push({ ...service, date });
    }
    for (const [key, change] of Object.entries(exceptions)) {
      const [id, original] = key.split("@");
      if (
        id !== service.id ||
        change.cancelled ||
        (service.startDate && original < service.startDate) ||
        (service.endDate && original > service.endDate)
      )
        continue;
      const date = change.date || original;
      if (date >= from && date < until)
        rows.push({
          ...service,
          ...change,
          date,
          end: Object.hasOwn(change, "end")
            ? change.end
            : change.start
              ? null
              : service.end,
        });
    }
  }
  return rows
    .filter((r) => r.date + "T" + r.start >= current)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 5);
}
