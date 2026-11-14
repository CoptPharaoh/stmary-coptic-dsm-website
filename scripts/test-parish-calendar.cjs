const assert = require("node:assert/strict");
require("../js/parish-schedule.js");
const { occurrences, localNow, calendarFile } = require("../js/parish-calendar.js");
const { exceptions, specialEvents } = globalThis.parishSchedule;

assert.deepEqual(localNow(new Date("2026-03-08T13:00:00Z")), { date: "2026-03-08", time: "08:00" });
assert.deepEqual(localNow(new Date("2026-11-01T14:00:00Z")), { date: "2026-11-01", time: "08:00" });
assert.equal(localNow(new Date("2026-11-01T02:30:00Z")).date, "2026-10-31");
assert.deepEqual(occurrences("2040-01-01", "2040-01-08").map((event) => event.id),
  ["sunday-liturgy", "wednesday-liturgy", "deacons-school", "vespers", "tasbeha"]);

exceptions["vespers@2026-12-05"] = { cancelled: true };
exceptions["vespers@2026-12-12"] = { date: "2027-01-03", start: "17:00", title: "Rescheduled Vespers" };
specialEvents.push({ id: "special", date: "2026-12-05", title: "Special", start: "18:30" });
assert.deepEqual(occurrences("2026-12-05", "2026-12-06").map((event) => event.id),
  ["deacons-school", "special", "tasbeha"]);
assert.equal(occurrences("2026-12-12", "2026-12-13").some((event) => event.id === "vespers"), false);
assert.equal(occurrences("2027-01-03", "2027-01-04").at(-1).title, "Rescheduled Vespers");
assert.equal(occurrences("2026-12-19", "2026-12-20").find((event) => event.id === "vespers").start, "19:00");

const vespers = occurrences("2026-11-28", "2026-11-29").find((event) => event.id === "vespers");
const weekly = calendarFile(vespers, true);
assert.match(weekly, /DTSTART;TZID=America\/Chicago:20261128T190000/);
assert.match(weekly, /RRULE:FREQ=WEEKLY\r\n/);
assert.match(weekly, /EXDATE;TZID=America\/Chicago:20261205T190000/);
assert.match(weekly, /RECURRENCE-ID;TZID=America\/Chicago:20261212T190000/);
assert.doesNotMatch(weekly, /DTEND|COUNT|UNTIL/);
const sunday = calendarFile(occurrences("2026-12-06", "2026-12-07")[0]);
assert.match(sunday, /DTEND;TZID=America\/Chicago:20261206T113000/);
assert.doesNotMatch(sunday, /RRULE:FREQ=WEEKLY/);
console.log("Parish calendar recurrence, exceptions, Central Time, and ICS exports passed.");
