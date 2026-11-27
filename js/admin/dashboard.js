import { withTimeout } from "../supabase-client.js";
import { get, node, check, message, badge, empty, button } from "./ui.js";
import {
  localInput,
  parishTimestamp,
  dateLabel,
  clockLabel,
  addDays,
  upcomingServices,
} from "./time.js";
import { createSchedules } from "./schedules.js";

export function createDashboard({ db, account, user, grants, ministries }) {
  let alive = true,
    revision = 0,
    view = "overview",
    page = 0,
    original = {},
    dirty = false,
    saving = false;
  const form = get("editor"),
    field = (name) => form.elements.namedItem(name),
    size = 25;
  const allowed = (permission, ministry = null) =>
    account.role === "owner" ||
    grants.some(
      (g) =>
        g.permission === permission &&
        (g.ministry_id === null || g.ministry_id === ministry),
    );
  const any = (permission) =>
    allowed(permission) || grants.some((g) => g.permission === permission);
  const request = async (query) => {
    if (!alive) throw Error("Session ended.");
    const result = await withTimeout(query, "Data request");
    if (!alive) throw Error("Session ended.");
    return result;
  };
  const run = async (action) => {
    try {
      await action();
    } catch (error) {
      if (alive)
        message(
          error.message || "Unable to load data. Use Refresh to retry.",
          true,
        );
    }
  };
  const schedules = createSchedules({
    db,
    request,
    run,
    allowed,
    onChange: () => {
      dirty = true;
    },
    onSaved: () => {
      dirty = false;
    },
  });
  const statuses = () => [
    "draft",
    "pending_review",
    "published",
    ...(view === "events" ? ["cancelled"] : []),
    "archived",
  ];
  function closeEditor() {
    get("editor-panel").hidden = true;
    get("preview-panel").hidden = true;
    form.reset();
    original = {};
    dirty = false;
  }
  function mayLeave() {
    return !dirty || confirm("Discard your unsaved changes?");
  }
  function options(select, items) {
    select.replaceChildren(
      ...items.map(([label, value]) => new Option(label, value)),
    );
  }
  function ministryOptions(permission) {
    return [
      ...(allowed(permission) ? [["Parish-wide", ""]] : []),
      ...ministries
        .filter((m) => allowed(permission, m.id))
        .map((m) => [m.name, m.id]),
    ];
  }
  function permissionState() {
    const scope = field("ministry_id").value || null;
    const publish = allowed(view + ".publish", scope);
    const protectedRecord = ["published", "archived", "cancelled"].includes(
      original.status,
    );
    const placementProtected =
      view === "announcements" &&
      ["homepage", "site_banner"].includes(original.placement);
    const editable =
      allowed(view + ".edit", scope) &&
      (!protectedRecord || publish) &&
      (!placementProtected || allowed("announcements.publish"));
    for (const option of field("status").options)
      option.disabled =
        !publish &&
        ["published", "archived", "cancelled"].includes(option.value);
    for (const option of field("placement").options)
      option.disabled =
        ["homepage", "site_banner"].includes(option.value) &&
        !allowed("announcements.publish");
    get("publish-now").hidden = !publish || !editable;
    get("save-record").disabled = !editable;
    get("save-record").textContent =
      field("status").value === "draft"
        ? "Save draft"
        : field("status").value === "published"
          ? "Save published content"
          : "Save changes";
    get("editor-permission").textContent = !editable
      ? "Read-only: publishing permission is required to change this record."
      : publish
        ? "Saving published content updates the public website. Publication dates are Central Time."
        : "You can save drafts or submit for review. Publishing requires additional permission.";
  }
  async function overview(token) {
    const today = localInput(new Date()).slice(0, 10);
    const metrics = [
      [
        "Published announcements",
        "announcements",
        "announcements.edit",
        (q) => q.eq("status", "published"),
      ],
      [
        "Draft announcements",
        "announcements",
        "announcements.edit",
        (q) => q.eq("status", "draft"),
      ],
      [
        "Upcoming events",
        "events",
        "events.edit",
        (q) =>
          q.eq("status", "published").gte("start_at", new Date().toISOString()),
      ],
      [
        "Active weekly services",
        "recurring_event_series",
        "schedules.manage",
        (q) =>
          q
            .eq("status", "published")
            .lte("start_date", today)
            .or("end_date.is.null,end_date.gte." + today),
      ],
    ];
    get("metrics").replaceChildren();
    empty(get("upcoming-list"), "Loading services...");
    empty(get("activity-list"), "Loading activity...");
    for (const [label, table, permission, filter] of metrics) {
      const card = node("article", null, "metric"),
        value = node("p", "Loading...", "metric-value");
      card.append(node("h2", label), value);
      get("metrics").append(card);
      if (
        !(permission === "schedules.manage"
          ? allowed(permission)
          : any(permission))
      ) {
        value.textContent = "—";
        card.append(node("p", "Not permitted", "metric-note"));
        continue;
      }
      try {
        const result = await request(
          filter(db.from(table).select("id", { count: "exact", head: true })),
        );
        check(result);
        if (token !== revision) return;
        value.textContent = String(result.count ?? 0);
        card.append(
          node(
            "p",
            table === "announcements"
              ? "By status in your permitted scope"
              : "In your permitted scope",
            "metric-note",
          ),
        );
      } catch (error) {
        if (!alive || token !== revision) return;
        value.textContent = "—";
        card.append(node("p", "Unavailable. Refresh to retry.", "metric-note"));
        message(error.message, true);
      }
    }
    try {
      const data = check(
        await request(
          db.rpc("parish_calendar_data", {
            range_start: today,
            range_end: addDays(today, 28),
          }),
        ),
      );
      if (token !== revision) return;
      const rows = upcomingServices(data);
      get("upcoming-list").replaceChildren();
      if (!rows.length)
        empty(
          get("upcoming-list"),
          "No services scheduled in the next four weeks.",
        );
      for (const row of rows) {
        const item = node("div", null, "data-row"),
          copy = node("div");
        copy.append(
          node("h3", row.title),
          node(
            "p",
            `${row.date} · ${clockLabel(row.start)}${row.end ? " – " + clockLabel(row.end) : ""} Central`,
          ),
        );
        item.append(copy);
        get("upcoming-list").append(item);
      }
    } catch (error) {
      if (!alive || token !== revision) return;
      empty(get("upcoming-list"), "Services unavailable. Refresh to retry.");
      message(error.message, true);
    }
    if (!allowed("audit.read")) {
      empty(
        get("activity-list"),
        "Activity history requires parish-wide audit permission.",
      );
      return;
    }
    try {
      const rows = check(
        await request(
          db
            .from("audit_logs")
            .select("action,entity,occurred_at")
            .order("occurred_at", { ascending: false })
            .limit(6),
        ),
      );
      if (token !== revision) return;
      get("activity-list").replaceChildren();
      if (!rows.length)
        empty(get("activity-list"), "No activity recorded yet.");
      for (const row of rows) {
        const item = node("div", null, "data-row"),
          copy = node("div");
        copy.append(
          node("h3", `${row.action} · ${row.entity.replaceAll("_", " ")}`),
          node("p", dateLabel(row.occurred_at)),
        );
        item.append(copy);
        get("activity-list").append(item);
      }
    } catch (error) {
      if (alive && token === revision) {
        empty(get("activity-list"), "Activity unavailable. Refresh to retry.");
        message(error.message, true);
      }
    }
  }
  async function load() {
    const token = ++revision;
    message("Loading authorized content...");
    if (view === "overview") {
      await overview(token);
      if (alive && token === revision)
        message("Overview refreshed. Counts reflect your authorized scope.");
      return;
    }
    if (view === "services") {
      await schedules.load();
      if (alive && token === revision) message("Weekly services loaded.");
      return;
    }
    empty(get("records"), "Loading content...");
    get("previous-page").disabled = get("next-page").disabled = true;
    let query = db
      .from(view)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * size, page * size + size - 1);
    const search = get("search").value.trim();
    if (search)
      query = query.ilike(
        "title",
        "%" + search.replace(/[\\%_]/g, "\\$&") + "%",
      );
    if (get("status-filter").value)
      query = query.eq("status", get("status-filter").value);
    const ministry = get("ministry-filter").value;
    if (ministry)
      query =
        ministry === "parish"
          ? query.is("ministry_id", null)
          : query.eq("ministry_id", ministry);
    if (view === "announcements" && get("placement-filter").value)
      query = query.eq("placement", get("placement-filter").value);
    try {
      const result = await request(query),
        rows = check(result);
      if (token !== revision) return;
      if (!rows.length && page > 0) {
        page--;
        return load();
      }
      get("records").replaceChildren();
      if (!rows.length)
        empty(get("records"), "No matching content in your permitted scope.");
      for (const row of rows) {
        const article = node("article", null, "data-row"),
          copy = node("div");
        copy.append(
          node("h3", row.title),
          badge(row.status),
          node(
            "p",
            ministries.find((m) => m.id === row.ministry_id)?.name ||
              "Parish-wide",
          ),
        );
        copy.append(
          node(
            "p",
            view === "announcements"
              ? `Publishes: ${dateLabel(row.publish_at)} · Expires: ${dateLabel(row.expires_at)} · ${row.placement.replaceAll("_", " ")}`
              : `Starts: ${dateLabel(row.start_at)} · Ends: ${dateLabel(row.end_at)}`,
          ),
        );
        article.append(
          copy,
          button("Open", () => {
            if (mayLeave()) edit(row);
          }),
        );
        get("records").append(article);
      }
      get("page-label").textContent =
        `Page ${page + 1} · ${result.count ?? rows.length} records`;
      get("previous-page").disabled = page === 0;
      get("next-page").disabled = (page + 1) * size >= (result.count ?? 0);
      message("Content loaded. Dates shown in Central Time.");
    } catch (error) {
      if (alive && token === revision)
        empty(get("records"), "Content unavailable. Use Refresh to retry.");
      throw error;
    }
  }
  function edit(record = {}) {
    closeEditor();
    original = { ...record };
    options(
      field("status"),
      statuses().map((s) => [s.replaceAll("_", " "), s]),
    );
    options(field("ministry_id"), ministryOptions(view + ".edit"));
    for (const [name, value] of Object.entries(record)) {
      const input = field(name);
      if (input)
        input.value =
          input.type === "datetime-local" ? localInput(value) : (value ?? "");
    }
    for (const [id, enabled] of [
      ["announcement-fields", view === "announcements"],
      ["event-fields", view === "events"],
    ]) {
      get(id).hidden = !enabled;
      get(id).disabled = !enabled;
    }
    field("start_at").required = view === "events";
    field("ministry_id").disabled = Boolean(record.id);
    get("editor-heading").textContent =
      (record.id ? "Edit " : "New ") +
      (view === "events" ? "event" : "announcement");
    get("editor-panel").hidden = false;
    permissionState();
    field("title").focus();
  }
  async function save(publishNow = false) {
    if (saving || !alive || !form.reportValidity()) return;
    const payload = {},
      names =
        view === "announcements"
          ? [
              "title",
              "summary",
              "body",
              "title_ar",
              "body_ar",
              "ministry_id",
              "placement",
              "status",
              "publish_at",
              "expires_at",
            ]
          : [
              "title",
              "body",
              "ministry_id",
              "location",
              "status",
              "start_at",
              "end_at",
            ];
    for (const name of names) {
      const input = field(name);
      payload[name] =
        input.type === "datetime-local"
          ? original[name] && input.value === localInput(original[name])
            ? original[name]
            : parishTimestamp(input.value)
          : input.value;
    }
    payload.ministry_id ||= null;
    if (view === "announcements")
      payload.publish_at ||= new Date().toISOString();
    if (publishNow) {
      payload.status = "published";
      if (view === "announcements")
        payload.publish_at = new Date().toISOString();
    }
    if (!allowed(view + ".edit", payload.ministry_id))
      throw Error("Editing is not permitted in this ministry.");
    if (
      [payload.status, original.status].some((s) =>
        ["published", "archived", "cancelled"].includes(s),
      ) &&
      !allowed(view + ".publish", payload.ministry_id)
    )
      throw Error("Publishing permission is required.");
    if (
      view === "announcements" &&
      [payload.placement, original.placement].some((p) =>
        ["homepage", "site_banner"].includes(p),
      ) &&
      !allowed("announcements.publish")
    )
      throw Error(
        "Parish-wide publishing permission is required for this placement.",
      );
    if (
      view === "announcements" &&
      payload.placement === "ministry" &&
      !payload.ministry_id
    )
      throw Error("Select a ministry for ministry placement.");
    const start = view === "events" ? payload.start_at : payload.publish_at,
      end = view === "events" ? payload.end_at : payload.expires_at;
    if (end && new Date(end) <= new Date(start))
      throw Error(
        "The end or expiration must be after the start or publication time.",
      );
    if (
      [payload.status, original.status].some((s) =>
        ["published", "archived", "cancelled"].includes(s),
      ) &&
      !confirm(
        `Save ${payload.status.replaceAll("_", " ")} content? This may change what visitors see on the public website.`,
      )
    )
      return;
    saving = true;
    get("save-record").disabled = true;
    get("publish-now").disabled = true;
    try {
      const query = original.id
        ? db.from(view).update(payload).eq("id", original.id)
        : db.from(view).insert(payload);
      const rows = check(await request(query.select("id")));
      if (!rows.length) throw Error("Save denied or record unavailable.");
      closeEditor();
      await load();
      if (alive) message("Changes saved successfully.");
    } finally {
      saving = false;
      if (alive) {
        get("publish-now").disabled = false;
        permissionState();
      }
    }
  }
  async function navigate(next) {
    const moveFocus = get("sidebar").contains(document.activeElement);
    if (saving || schedules.isBusy() || !mayLeave()) return;
    if (
      next !== "overview" &&
      !(next === "services" ? allowed("schedules.manage") : any(next + ".edit"))
    )
      return;
    view = next;
    page = 0;
    closeEditor();
    schedules.close();
    document
      .querySelectorAll("[data-panel]")
      .forEach(
        (el) =>
          (el.hidden =
            el.dataset.panel !==
            (next === "overview"
              ? "overview"
              : next === "services"
                ? "services"
                : "content")),
      );
    document.querySelectorAll("[data-view]").forEach((el) => {
      el.classList.toggle("active", el.dataset.view === view);
      el.setAttribute(
        "aria-current",
        el.dataset.view === view ? "page" : "false",
      );
    });
    get("view-title").textContent = {
      overview: "Overview",
      announcements: "Announcements",
      events: "Events",
      services: "Weekly Services",
    }[view];
    get("sidebar").classList.remove("is-open");
    get("sidebar-toggle").setAttribute("aria-expanded", "false");
    if (moveFocus) get("view-title").focus({ preventScroll: true });
    if (["announcements", "events"].includes(view)) {
      get("search").value = "";
      options(get("status-filter"), [
        ["All statuses", ""],
        ...statuses().map((s) => [s.replaceAll("_", " "), s]),
      ]);
      options(get("ministry-filter"), [
        ["All permitted ministries", ""],
        ...ministryOptions(view + ".edit").map(([l, v]) => [l, v || "parish"]),
      ]);
      get("placement-filter").value = "";
      get("placement-filter-label").hidden = view !== "announcements";
    }
    await load();
  }
  form.oninput = () => {
    dirty = true;
    permissionState();
  };
  form.onchange = form.oninput;
  form.onsubmit = (e) => {
    e.preventDefault();
    run(() => save());
  };
  get("publish-now").onclick = () => run(() => save(true));
  get("close-editor").onclick = () => {
    if (!saving && mayLeave()) closeEditor();
  };
  get("preview-button").onclick = () => {
    const host = get("preview-content");
    host.replaceChildren(
      node("h2", field("title").value),
      node(
        "p",
        view === "announcements"
          ? field("summary").value
          : field("location").value,
      ),
      node("p", field("body").value),
    );
    if (
      view === "announcements" &&
      (field("title_ar").value || field("body_ar").value)
    ) {
      const ar = node("div");
      ar.lang = "ar";
      ar.dir = "rtl";
      ar.append(
        node("h2", field("title_ar").value),
        node("p", field("body_ar").value),
      );
      host.append(ar);
    }
    get("preview-panel").hidden = false;
  };
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.hidden =
      el.dataset.view !== "overview" &&
      !(el.dataset.view === "services"
        ? allowed("schedules.manage")
        : any(el.dataset.view + ".edit"));
    el.onclick = () => run(() => navigate(el.dataset.view));
  });
  document.querySelectorAll("[data-create]").forEach((el) => {
    el.hidden = !any(el.dataset.create + ".edit");
    el.onclick = () =>
      run(async () => {
        await navigate(el.dataset.create);
        if (alive && view === el.dataset.create && !dirty) edit();
      });
  });
  get("new-record").onclick = () => {
    if (!saving && mayLeave()) edit();
  };
  get("refresh").onclick = () =>
    run(async () => {
      if (!saving && !schedules.isBusy() && mayLeave()) {
        closeEditor();
        schedules.close();
        await load();
      }
    });
  let timer;
  get("search").oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 0;
      run(load);
    }, 250);
  };
  for (const id of ["status-filter", "ministry-filter", "placement-filter"])
    get(id).onchange = () => {
      page = 0;
      run(load);
    };
  get("previous-page").onclick = () => {
    if (page > 0) {
      page--;
      run(load);
    }
  };
  get("next-page").onclick = () => {
    page++;
    run(load);
  };
  get("sidebar-toggle").onclick = () => {
    const open = get("sidebar").classList.toggle("is-open");
    get("sidebar-toggle").setAttribute("aria-expanded", String(open));
  };
  const unload = (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", unload);
  get("user-role").textContent = account.role;
  get("user-email").textContent = user.email || "";
  return {
    start: () => run(() => navigate("overview")),
    dispose() {
      alive = false;
      revision++;
      clearTimeout(timer);
      window.removeEventListener("beforeunload", unload);
      schedules.dispose();
      closeEditor();
      for (const id of [
        "metrics",
        "records",
        "activity-list",
        "upcoming-list",
        "preview-content",
      ])
        get(id).replaceChildren();
      get("user-role").textContent = get("user-email").textContent = "";
      get("search").value = "";
      field("ministry_id").replaceChildren();
      get("ministry-filter").replaceChildren();
      get("page-label").textContent = "";
      original = {};
    },
  };
}
