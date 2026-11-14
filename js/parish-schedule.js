// Dates and times below are parish-local (America/Chicago), not visitor-local.
globalThis.parishSchedule = {
  services: [
    { id: "sunday-liturgy", title: "Sunday Divine Liturgy", weekday: 0, start: "08:00", end: "11:30" },
    { id: "wednesday-liturgy", title: "Wednesday Divine Liturgy", weekday: 3, start: "08:00", end: "10:00" },
    { id: "deacons-school", title: "Deacons School", weekday: 6, start: "18:00" },
    { id: "vespers", title: "Vespers", weekday: 6, start: "19:00" },
    { id: "tasbeha", title: "Midnight Praises (Tasbeha)", weekday: 6, start: "20:00" },
  ],
  // Key each exception by service ID and the ORIGINAL local date.
  // "vespers@2026-12-05": { cancelled: true }
  // "vespers@2026-12-12": { date: "2026-12-13", start: "17:00", note: "Rescheduled" }
  exceptions: {},
  // Standalone events: { id: "unique-id", date: "YYYY-MM-DD", title, start: "HH:MM", end?, note? }
  specialEvents: [],
};
