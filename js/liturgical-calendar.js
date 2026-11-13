(() => {
  "use strict";

  const DAY = 86400000;
  const FIRST_YEAR = 1902;
  const LAST_YEAR = 2099;
  const MONTHS = ["Tout", "Baba", "Hathor", "Kiahk", "Toba", "Amshir", "Baramhat",
    "Baramouda", "Bashans", "Paona", "Epep", "Mesra", "Nasie"];
  const CATEGORY = {
    major: "Major Feast", minor: "Minor Feast",
    fast: "Fasting Period", commemoration: "Commemoration",
  };

  function formatter(calendar, timeZone, options) {
    return new Intl.DateTimeFormat("en-US", { calendar, timeZone, numberingSystem: "latn", ...options });
  }

  const fields = { year: "numeric", month: "numeric", day: "numeric" };
  const chicago = formatter("gregory", "America/Chicago", fields);
  const coptic = formatter("coptic", "UTC", fields);
  const fullDate = formatter("gregory", "UTC", { dateStyle: "full" });
  const shortDate = formatter("gregory", "UTC", { dateStyle: "medium" });
  const monthTitle = formatter("gregory", "UTC", { year: "numeric", month: "long" });

  function dateParts(format, instant) {
    return Object.fromEntries(format.formatToParts(instant)
      .filter(({ type }) => type === "year" || type === "month" || type === "day")
      .map(({ type, value }) => [type, Number(value)]));
  }

  // Represent Chicago civil dates at UTC midnight, so arithmetic never crosses a DST gap.
  function todayInChicago(instant = new Date()) {
    const { year, month, day } = dateParts(chicago, instant);
    return Date.UTC(year, month - 1, day);
  }

  function copticDate(date) {
    if (coptic.resolvedOptions().calendar !== "coptic") {
      throw new Error("Coptic calendar unavailable");
    }
    return dateParts(coptic, date);
  }

  // USNO Explanatory Supplement, algorithm 9. Julian dates are 13 days behind
  // Gregorian dates throughout the supported spring observance range.
  function pascha(year) {
    const mod = (n, m) => ((n % m) + m) % m;
    const a = 22 + mod(225 - 11 * mod(year, 19), 30);
    const g = a + mod(56 + 6 * year - Math.floor(year / 4) - a, 7);
    return Date.UTC(year, 2 + Math.floor(g / 32), 1 + mod(g - 1, 31) + 13);
  }

  const yearDates = new Map();
  function datesByCopticMonthDay(year) {
    if (!yearDates.has(year)) {
      const result = new Map();
      for (let date = Date.UTC(year, 0, 1); date < Date.UTC(year + 1, 0, 1); date += DAY) {
        const { month, day } = copticDate(date);
        result.set(month * 100 + day, date);
      }
      yearDates.set(year, result);
    }
    return yearDates.get(year);
  }

  function nativity(year) {
    const january = copticDate(Date.UTC(year, 0, 1));
    // Coptic leap years end with year % 4 === 3; the following Kiahk uses day 28.
    return datesByCopticMonthDay(year).get(january.year % 4 === 0 ? 428 : 429);
  }

  const eventCache = new Map();
  function eventsForYear(year) {
    if (!eventCache.has(year)) {
      const dates = datesByCopticMonthDay(year);
      const easter = pascha(year);
      const offset = days => easter + days * DAY;
      const event = (name, category, start, description, end = start) =>
        ({ name, category, start, end, description });

      // Fixed feasts: MVW Coptic diocese. Nativity exception: HCOC Kiahk guide.
      // Annunciation observance can change when it coincides with Pascha rites.
      // Seasonal boundaries: Midlands diocesan calendar and Fr. Tadros Malaty's catechism.
      const events = [
        event("Nativity", "major", nativity(year), "The birth of Jesus Christ."),
        event("Theophany", "major", dates.get(511), "Christ's Baptism in the Jordan."),
        event("Circumcision of the Lord", "minor", dates.get(506), "Christ's circumcision on the eighth day."),
        event("Entrance into the Temple", "minor", dates.get(608), "The presentation of Christ in the Temple."),
        event("Flight into Egypt", "minor", dates.get(924), "The Holy Family's entry into Egypt."),
        event("Wedding at Cana", "minor", dates.get(513), "Christ's first sign in the Gospel of John."),
        event("Transfiguration", "minor", dates.get(1213), "Christ reveals His glory to His disciples."),
        event("Palm Sunday", "major", offset(-7), "Christ's entry into Jerusalem."),
        event("Covenant Thursday", "minor", offset(-3), "The Last Supper and institution of the Eucharist."),
        event("Good Friday", "commemoration", offset(-2), "The Crucifixion and death of Christ."),
        event("Resurrection (Pascha)", "major", easter, "The central feast of Christ's victory over death."),
        event("Thomas Sunday", "minor", offset(7), "The risen Lord appears to St. Thomas."),
        event("Ascension", "major", offset(39), "The fortieth day of the Paschal period."),
        event("Pentecost", "major", offset(49), "The Holy Spirit descends upon the Apostles."),
        event("Nayrouz", "commemoration", dates.get(101), "Coptic New Year and remembrance of the martyrs."),
        event("Fast of Nineveh", "fast", offset(-69), "Three days remembering Nineveh's repentance.", offset(-67)),
        event("Great Lent", "fast", offset(-55), "The preparatory week and forty-day fast, before Lazarus Saturday.", offset(-9)),
        event("Holy Week", "fast", offset(-6), "The Passion days after Palm Sunday, through Bright Saturday.", offset(-1)),
        event("Apostles' Fast", "fast", offset(50), "Prayer and fasting in the spirit of apostolic mission.", dates.get(1105) - DAY),
        event("Fast of St. Mary", "fast", dates.get(1201), "A period of fasting honoring the Theotokos.", dates.get(1215)),
        event("Nativity Fast", "fast", dates.get(316), "Preparation for the Nativity of Christ.", nativity(year + 1) - DAY),
      ];
      eventCache.set(year, events.sort((left, right) => left.start - right.start));
    }
    return eventCache.get(year);
  }

  function dateLabel(date) {
    const { year, month, day } = copticDate(date);
    return `${day} ${MONTHS[month - 1]} ${year} A.M.`;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function eventCard(event) {
    const card = element("li", "", "resource-card");
    card.append(
      element("p", CATEGORY[event.category], `calendar-category calendar-${event.category}`),
      element("h3", event.name),
      element("p", event.start === event.end
        ? `${shortDate.format(event.start)} / ${dateLabel(event.start)}`
        : `${shortDate.format(event.start)} to ${shortDate.format(event.end)} / ${dateLabel(event.start)} to ${dateLabel(event.end)}`),
      element("p", event.description)
    );
    return card;
  }

  function init() {
    const page = document.querySelector(".calendar-page");
    if (!page || coptic.resolvedOptions().calendar !== "coptic") return;
    const find = selector => page.querySelector(selector);
    const grid = find("#calendar-days");
    const heading = find("#calendar-month-heading");
    const dialog = find("#calendar-day-details");
    const previous = find("#calendar-prev");
    const next = find("#calendar-next");
    let today = todayInChicago();
    const startOfMonth = date => Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), 1);
    let month = startOfMonth(today);
    let opener;

    function renderToday() {
      const date = copticDate(today);
      const fields = [fullDate.format(today), dateLabel(today), MONTHS[date.month - 1], `${date.year} A.M.`];
      page.querySelectorAll("[data-calendar-today-value]").forEach((field, index) => {
        field.textContent = fields[index];
      });
      const year = new Date(today).getUTCFullYear();
      const upcoming = [year, year + 1]
        .filter(y => y >= FIRST_YEAR && y <= LAST_YEAR)
        .flatMap(eventsForYear).filter(event => event.start >= today).slice(0, 6);
      find("#calendar-upcoming-list").replaceChildren(...upcoming.map(eventCard));
      find("#calendar-upcoming-empty").hidden = upcoming.length > 0;
    }

    function renderMonth() {
      const first = new Date(month);
      const year = first.getUTCFullYear();
      const end = Date.UTC(year, first.getUTCMonth() + 1, 1);
      const supported = year >= FIRST_YEAR && year <= LAST_YEAR;
      const events = supported ? [...eventsForYear(year - 1), ...eventsForYear(year)] : [];
      const days = document.createDocumentFragment();
      for (let date = month; date < end; date += DAY) {
        const civil = new Date(date);
        const copticDay = copticDate(date);
        const day = element("li", "", "calendar-day");
        if (date === month) day.style.setProperty("--calendar-start", civil.getUTCDay() + 1);
        if (date === today) day.setAttribute("aria-current", "date");
        const time = element("time", String(civil.getUTCDate()), "calendar-day-number");
        time.dateTime = civil.toISOString().slice(0, 10);
        time.setAttribute("aria-label", fullDate.format(date));
        day.append(time, element("span", `${copticDay.day} ${MONTHS[copticDay.month - 1]}`, "calendar-coptic-day"));
        const observances = events.filter(event => event.start <= date && date <= event.end);
        if (observances.length) {
          const button = element("button", "", "calendar-day-events");
          button.type = "button";
          button.setAttribute("aria-haspopup", "dialog");
          button.setAttribute("aria-label", `Observances for ${fullDate.format(date)}: ${observances.map(event => event.name).join(", ")}`);
          for (const event of observances) {
            button.append(element("span", `${CATEGORY[event.category]}: ${event.name}`,
              `calendar-category calendar-${event.category}`));
          }
          button.addEventListener("click", () => {
            opener = button;
            find("#calendar-dialog-title").textContent = fullDate.format(date);
            find("#calendar-dialog-date").textContent = dateLabel(date);
            find("#calendar-dialog-events").replaceChildren(...observances.map(eventCard));
            dialog.showModal();
          });
          day.append(button);
        }
        days.append(day);
      }
      grid.replaceChildren(days);
      heading.textContent = monthTitle.format(month);
      previous.disabled = month <= Date.UTC(FIRST_YEAR, 0, 1);
      next.disabled = month >= Date.UTC(LAST_YEAR, 11, 1);
    }

    function move(step) {
      const date = new Date(month);
      month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1);
      renderMonth();
      if (document.activeElement === (step < 0 ? previous : next)
          && (step < 0 ? previous : next).disabled) find("#calendar-current").focus();
    }

    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    find("#calendar-current").addEventListener("click", () => {
      today = todayInChicago();
      month = startOfMonth(today);
      renderToday();
      renderMonth();
    });
    dialog.addEventListener("close", () => opener?.focus());
    renderToday();
    renderMonth();
    page.querySelectorAll("[data-calendar-live]").forEach(node => { node.hidden = false; });
    page.querySelectorAll("[data-calendar-fallback]").forEach(node => { node.hidden = true; });
    window.setInterval(() => {
      const current = todayInChicago();
      if (current === today || dialog.open) return;
      if (month === startOfMonth(today)) month = startOfMonth(current);
      today = current;
      renderToday();
      renderMonth();
    }, 60000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
