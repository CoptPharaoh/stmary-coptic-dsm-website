import { get, node, check, message, badge, empty, button } from "./ui.js";
import { weekdays, clockLabel } from "./time.js";

export function createSchedules({
  db,
  request,
  run,
  allowed,
  onChange,
  onSaved,
}) {
  const series = get("series-form"),
    exception = get("exception-form");
  let alive = true,
    revision = 0,
    busy = false,
    rows = [],
    changes = [];
  function close() {
    revision++;
    series.hidden = exception.hidden = true;
    series.reset();
    exception.reset();
    get("exception-list").replaceChildren();
    get("exception-service").textContent = "";
  }
  async function load() {
    if (!allowed("schedules.manage"))
      throw Error("Parish-wide schedule permission is required.");
    const version = ++revision;
    empty(get("series-list"), "Loading weekly services...");
    try {
      rows = check(
        await request(
          db
            .from("recurring_event_series")
            .select("*")
            .order("weekday")
            .order("local_start_time"),
        ),
      );
      if (!alive || version !== revision) return;
      get("series-list").replaceChildren();
      if (!rows.length)
        empty(get("series-list"), "No recurring services available.");
      for (const row of rows) {
        const article = node("article", null, "data-row"),
          copy = node("div"),
          actions = node("div", null, "record-actions");
        copy.append(
          node("h3", row.title),
          badge(row.status),
          node(
            "p",
            `${weekdays[row.weekday]} · ${clockLabel(row.local_start_time)}${row.local_end_time ? " – " + clockLabel(row.local_end_time) : ""} Central`,
          ),
        );
        actions.append(
          button("Edit series", () => open(row, false)),
          button("Change one date", () => run(() => open(row, true))),
        );
        article.append(copy, actions);
        get("series-list").append(article);
      }
    } catch (error) {
      if (alive && version === revision)
        empty(
          get("series-list"),
          "Services unavailable. Use Refresh to retry.",
        );
      throw error;
    }
  }
  function replacements() {
    const modify = exception.elements.action.value === "modify";
    get("replacement-fields").hidden = !modify;
    for (const name of ["replacement_date", "replacement_start"])
      exception.elements[name].required = modify;
  }
  async function open(row, occurrence) {
    if (
      busy ||
      ((!series.hidden || !exception.hidden) &&
        !confirm("Discard the open schedule form?"))
    )
      return;
    close();
    onSaved();
    if (!occurrence) {
      for (const [name, value] of Object.entries(row)) {
        const input = series.elements.namedItem(name);
        if (input) input.value = value ?? "";
      }
      series.hidden = false;
      series.elements.title.focus();
      return;
    }
    exception.hidden = false;
    exception.elements.series_id.value = row.id;
    get("exception-service").textContent = row.title;
    replacements();
    empty(get("exception-list"), "Loading occurrence changes...");
    const version = ++revision;
    try {
      changes = check(
        await request(
          db
            .from("event_exceptions")
            .select("*")
            .eq("series_id", row.id)
            .order("original_date", { ascending: false })
            .limit(100),
        ),
      );
    } catch (error) {
      if (alive && version === revision)
        empty(
          get("exception-list"),
          "Occurrence changes unavailable. Close and reopen this form to retry.",
        );
      throw error;
    }
    if (!alive || version !== revision) return;
    get("exception-list").replaceChildren();
    if (!changes.length) empty(get("exception-list"), "No occurrence changes.");
    for (const item of changes) {
      get("exception-list").append(
        button(
          `${item.original_date}: ${item.cancelled ? "Cancelled" : "Rescheduled to " + item.replacement_date}`,
          () => {
            for (const [name, value] of Object.entries(item)) {
              const input = exception.elements.namedItem(name);
              if (input) input.value = value ?? "";
            }
            exception.elements.action.value = item.cancelled
              ? "cancel"
              : "modify";
            replacements();
            onChange();
          },
        ),
      );
    }
    if (changes.length === 100)
      get("exception-list").append(
        node(
          "p",
          "Showing the latest 100 changes. Enter an original date to update an older occurrence.",
          "muted",
        ),
      );
  }
  async function save(form, occurrence) {
    if (busy || !alive || !form.reportValidity()) return;
    if (!allowed("schedules.manage"))
      throw Error("Schedule management is not permitted.");
    const values = Object.fromEntries(new FormData(form));
    let query;
    if (occurrence) {
      values.cancelled = values.action === "cancel";
      delete values.action;
      for (const name of [
        "replacement_date",
        "replacement_start",
        "replacement_end",
      ])
        values[name] = values.cancelled ? null : values[name] || null;
      const parent = rows.find((row) => row.id === values.series_id);
      if (
        !parent ||
        new Date(values.original_date + "T12:00:00Z").getUTCDay() !==
          parent.weekday ||
        values.original_date < parent.start_date ||
        (parent.end_date && values.original_date > parent.end_date)
      )
        throw Error(
          "Choose an original date within this series on its scheduled weekday.",
        );
      if (
        values.replacement_end &&
        values.replacement_end <= values.replacement_start
      )
        throw Error("End time must be after the start time.");
      if (
        !confirm(
          `Save this ${values.cancelled ? "cancellation" : "rescheduling"} for ${values.original_date}? Any existing change for this date will be replaced.`,
        )
      )
        return;
      query = db
        .from("event_exceptions")
        .upsert(values, { onConflict: "series_id,original_date" });
    } else {
      const id = values.id;
      delete values.id;
      values.weekday = Number(values.weekday);
      values.local_end_time ||= null;
      values.end_date ||= null;
      if (
        values.local_end_time &&
        values.local_end_time <= values.local_start_time
      )
        throw Error("End time must be after the start time.");
      if (values.end_date && values.end_date < values.start_date)
        throw Error("Effective end must not precede the start date.");
      if (
        !confirm(
          "Change this entire weekly series? Existing occurrence changes must remain valid.",
        )
      )
        return;
      query = db.from("recurring_event_series").update(values).eq("id", id);
    }
    busy = true;
    const submit = form.querySelector('[type="submit"],button:not([type])');
    if (submit) submit.disabled = true;
    try {
      const result = check(await request(query.select("id")));
      if (!result.length) throw Error("Update denied or record unavailable.");
      if (!alive) return;
      close();
      onSaved();
      await load();
      if (alive)
        message(
          occurrence ? "Occurrence change saved." : "Weekly series saved.",
        );
    } finally {
      busy = false;
      if (submit) submit.disabled = false;
    }
  }
  series.oninput = exception.oninput = onChange;
  exception.elements.action.onchange = replacements;
  series.onsubmit = (e) => {
    e.preventDefault();
    run(() => save(series, false));
  };
  exception.onsubmit = (e) => {
    e.preventDefault();
    run(() => save(exception, true));
  };
  document.querySelectorAll("[data-close]").forEach(
    (el) =>
      (el.onclick = () => {
        if (!busy && confirm("Discard this schedule form?")) {
          close();
          onSaved();
        }
      }),
  );
  return {
    load,
    close,
    isBusy: () => busy,
    dispose() {
      alive = false;
      revision++;
      rows = [];
      changes = [];
      close();
      get("series-list").replaceChildren();
    },
  };
}
