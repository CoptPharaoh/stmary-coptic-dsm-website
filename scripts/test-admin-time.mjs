import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../js/admin/time.js", import.meta.url),
  "utf8",
);
const { localInput, parishTimestamp, upcomingServices } = await import(
  "data:text/javascript," + encodeURIComponent(source)
);
assert.equal(parishTimestamp("2026-01-04T08:00"), "2026-01-04T14:00:00.000Z");
assert.equal(parishTimestamp("2026-07-05T08:00"), "2026-07-05T13:00:00.000Z");
assert.equal(localInput("2026-07-05T13:00:00Z"), "2026-07-05T08:00");
assert.throws(() => parishTimestamp("2026-03-08T02:30"), /skipped or repeated/);
assert.throws(() => parishTimestamp("2026-11-01T01:30"), /skipped or repeated/);
assert.equal(parishTimestamp(""), null);
const service = {
  id: "sunday",
  title: "Liturgy",
  weekday: 0,
  start: "08:00",
  end: "11:30",
  startDate: "2026-01-01",
};
let rows = upcomingServices(
  {
    services: [service],
    exceptions: { "sunday@2026-07-05": { cancelled: true } },
  },
  new Date("2026-07-05T12:00:00Z"),
);
assert.equal(rows[0].date, "2026-07-12");
rows = upcomingServices(
  {
    services: [service],
    exceptions: {
      "sunday@2026-07-05": { date: "2026-07-06", start: "09:00", end: null },
    },
  },
  new Date("2026-07-05T12:00:00Z"),
);
assert.equal(rows[0].date, "2026-07-06");
assert.equal(rows[0].end, null);
console.log(
  "PASS Central Time winter/summer conversion, DST gap/fold rejection, blank optional dates, service cancellation/rescheduling and unknown end times.",
);
