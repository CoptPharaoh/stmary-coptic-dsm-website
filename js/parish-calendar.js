(() => {
  const zone = "America/Chicago";
  const { services, exceptions, specialEvents } = globalThis.parishSchedule;
  const civil = (date) => new Date(date + "T12:00:00Z");
  const iso = (date) => date.toISOString().slice(0, 10);
  const addDays = (date, days) => {
    const next = civil(date);
    next.setUTCDate(next.getUTCDate() + days);
    return iso(next);
  };
  const weekday = (date) => civil(date).getUTCDay();
  const parishClock = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  function localNow(now) {
    const p = Object.fromEntries(parishClock.formatToParts(now).map(({ type, value }) => [type, value]));
    return { date: p.year + "-" + p.month + "-" + p.day, time: p.hour + ":" + p.minute };
  }

  function occurrences(from, until) {
    const result = [];
    const within = (date) => from <= date && date < until;
    for (const service of services) {
      const offset = (service.weekday - weekday(from) + 7) % 7;
      for (let date = addDays(from, offset); within(date); date = addDays(date, 7)) {
        if (!Object.hasOwn(exceptions, service.id + "@" + date)) {
          result.push({ ...service, date, originalDate: date, service });
        }
      }
      for (const [key, change] of Object.entries(exceptions)) {
        const [id, originalDate] = key.split("@");
        if (id !== service.id || change.cancelled) continue;
        const date = change.date || originalDate;
        if (within(date)) {
          // A different start needs an explicit new end; the old end may no longer apply.
          const end = Object.hasOwn(change, "end") ? change.end : change.start ? undefined : service.end;
          result.push({ ...service, ...change, date, end, originalDate, service });
        }
      }
    }
    return result.concat(specialEvents.filter((event) => within(event.date)))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || a.title.localeCompare(b.title));
  }

  const calDate = (date, time) => date.replaceAll("-", "") + "T" + time.replace(":", "") + "00";
  const stamp = (date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const escapeText = (value) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n")
    .replace(/[,;]/g, (char) => "\\" + char);
  const domain = "@stmary-coptic-dsm-website";
  const tz = [
    "BEGIN:VTIMEZONE", "TZID:" + zone,
    "BEGIN:DAYLIGHT", "DTSTART:20070311T020000", "TZOFFSETFROM:-0600", "TZOFFSETTO:-0500",
    "TZNAME:CDT", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "DTSTART:20071104T020000", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0600",
    "TZNAME:CST", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD", "END:VTIMEZONE",
  ];
  function calendarFile(event, weekly = false, now = new Date()) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//St Mary Coptic Orthodox Church//Parish Calendar//EN", ...tz];
    const dateLine = (key, date, time) => key + ";TZID=" + zone + ":" + calDate(date, time);
    function append(item, uid, extra = []) {
      lines.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp(now),
        "SUMMARY:" + escapeText(item.title), dateLine("DTSTART", item.date, item.start));
      if (item.end) lines.push(dateLine("DTEND", item.date, item.end));
      lines.push("LOCATION:" + escapeText("St. Mary Coptic Orthodox Church, Des Moines, Iowa"));
      if (item.note) lines.push("DESCRIPTION:" + escapeText(item.note));
      lines.push(...extra, "END:VEVENT");
    }
    if (weekly) {
      const service = event.service;
      const anchor = event.originalDate;
      const uid = service.id + domain;
      const extras = ["RRULE:FREQ=WEEKLY"];
      const replacements = [];
      for (const [key, change] of Object.entries(exceptions)) {
        const [id, date] = key.split("@");
        if (id !== service.id || date < anchor) continue;
        if (change.cancelled) extras.push(dateLine("EXDATE", date, service.start));
        else {
          const updatedDate = change.date || date;
          const replacement = occurrences(updatedDate, addDays(updatedDate, 1))
            .find((item) => item.service === service && item.originalDate === date);
          if (replacement) replacements.push([replacement, dateLine("RECURRENCE-ID", date, service.start)]);
        }
      }
      append({ ...service, date: anchor }, uid, extras);
      replacements.forEach(([item, recurrence]) => append(item, uid, [recurrence]));
    } else {
      append(event, event.id + "-" + (event.originalDate || event.date) + domain);
    }
    // Fold by UTF-8 octets, preserving whole Unicode code points (RFC 5545).
    const encoder = new TextEncoder();
    return lines.concat("END:VCALENDAR").map((line) => {
      let output = "", width = 0;
      for (const char of line) {
        const bytes = encoder.encode(char).length;
        if (width + bytes > 75) { output += "\r\n "; width = 1; }
        output += char;
        width += bytes;
      }
      return output;
    }).join("\r\n") + "\r\n";
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { occurrences, localNow, calendarFile };
  }
  if (typeof document === "undefined") return;

  const textDate = (date, options) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(civil(date));
  const timeText = (time) => {
    const [hour, minute] = time.split(":");
    return (Number(hour) % 12 || 12) + ":" + minute + (Number(hour) >= 12 ? " PM" : " AM");
  };
  const hours = ({ start, end }) => timeText(start) + (end ? "\u2013" + timeText(end) : "");
  const schoolNext = document.querySelector("[data-school-next]");
  if (schoolNext) {
    const schoolHours = document.querySelectorAll("[data-school-hours] li");
    const schoolServices = ["deacons-school", "vespers", "tasbeha"];
    schoolServices.forEach((id, index) => {
      const service = services.find((item) => item.id === id);
      if (!service || !schoolHours[index]) return;
      const day = textDate(addDays("2026-01-04", service.weekday), { weekday: "long" });
      schoolHours[index].textContent = day + " · " + service.title + " · " + hours(service) + " Central";
    });
    function updateSchoolDate() {
      const { date, time } = localNow(new Date());
      const next = occurrences(date, addDays(date, 365)).find(
        (event) => event.id === "deacons-school" && event.date + event.start >= date + time,
      );
      schoolNext.textContent = next
        ? "Next session: " + textDate(next.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
          " at " + hours(next) + " Central." + (next.note ? " " + next.note : "")
        : "See the parish calendar for the next Deacons School session.";
    }
    updateSchoolDate();
    setInterval(updateSchoolDate, 30_000);
  }
  const el = (tag, value, cls) => {
    const node = document.createElement(tag);
    if (value) node.textContent = value;
    if (cls) node.className = cls;
    return node;
  };
  function downloadButton(event, weekly) {
    const button = el("button", weekly ? "Add weekly series (.ics)" : "Add this service (.ics)", "text-link");
    button.type = "button";
    button.setAttribute("aria-label", button.textContent + ": " + event.title);
    button.addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([calendarFile(event, weekly)], { type: "text/calendar;charset=utf-8" }));
      const a = el("a");
      a.href = url;
      a.download = event.id + (weekly ? "-weekly" : "-" + event.date) + ".ics";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return button;
  }
  function card(event, full) {
    const article = el("article", "", "event-item");
    const date = el("time", "", "event-date");
    date.dateTime = event.date;
    date.append(textDate(event.date, { month: "short" }), el("br"), el("strong", String(Number(event.date.slice(-2)))));
    const copy = el("div");
    copy.append(el("h3", event.title), el("p", textDate(event.date, { weekday: "long" }) + " \u00b7 " + hours(event)));
    if (event.note) copy.append(el("p", event.note));
    if (full) {
      const actions = el("div", "", "parish-calendar-actions");
      actions.append(downloadButton(event, false));
      if (event.service) actions.append(downloadButton(event, true));
      copy.append(actions);
    }
    article.append(date, copy);
    return article;
  }

  function renderUpcoming() {
    const upcoming = document.querySelector("[data-parish-upcoming]");
    if (!upcoming) return;
    const { date, time } = localNow(new Date());
    const next = [];
    for (let from = date; next.length < 5; from = addDays(from, 28)) {
      next.push(...occurrences(from, addDays(from, 28))
        .filter((event) => event.date > date || event.start >= time));
    }
    upcoming.replaceChildren(...next.slice(0, 5).map((event) => card(event, false)));
  }
  if (document.querySelector("[data-parish-upcoming]")) {
    renderUpcoming();
    setInterval(renderUpcoming, 60000);
  }
  const monthForm = document.querySelector("[data-parish-month]");
  if (!monthForm) return;
  const input = monthForm.elements.month;
  const list = document.querySelector("[data-parish-month-events]");
  const heading = document.querySelector("#parish-month-title");
  const current = () => localNow(new Date()).date.slice(0, 7);
  let month = current();
  function shift(value, delta) {
    const date = civil(value + "-01");
    date.setUTCMonth(date.getUTCMonth() + delta);
    return iso(date).slice(0, 7);
  }
  function render() {
    input.value = month;
    heading.textContent = textDate(month + "-01", { month: "long", year: "numeric" });
    const events = occurrences(month + "-01", shift(month, 1) + "-01");
    list.replaceChildren(...(events.length ? events.map((event) => card(event, true)) : [el("p", "No services are scheduled this month.")]));
  }
  monthForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(input.value) && input.value >= "2007-01" && input.value < "9999-01") month = input.value;
    render();
  });
  monthForm.addEventListener("click", (event) => {
    const action = event.target.closest("[data-month-action]")?.dataset.monthAction;
    if (!action) return;
    const next = action === "today" ? current() : shift(month, Number(action));
    if (/^\d{4}-\d{2}$/.test(next) && next >= "2007-01" && next < "9999-01") month = next;
    render();
  });
  render();
  monthForm.hidden = false;
})();
