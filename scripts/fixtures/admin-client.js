// Browser-test adapter only. This module is never referenced by production HTML.
const mode = new URLSearchParams(location.search).get("fixture") || "owner";
window.__writes = [];
window.__reads = [];
let signedOut = false,
  listener;
const ministries = [
  { id: "youth", name: "Youth Ministry" },
  { id: "family", name: "Family Ministry" },
];
const announcements = [
  {
    id: "a1",
    title: "Parish family gathering",
    summary: "Join our parish family for prayer and fellowship.",
    body: "We look forward to welcoming you.\nAll parish families are welcome.",
    title_ar: "اجتماع العائلة",
    body_ar: "أهلاً وسهلاً بالجميع",
    status: "published",
    placement: "homepage",
    ministry_id: null,
    publish_at: "2026-11-20T14:00:00Z",
    expires_at: null,
    created_at: "2026-11-20T14:00:00Z",
  },
  {
    id: "a2",
    title: "Youth service project",
    summary: "Serve together this season.",
    body: "A draft for review.",
    status: "draft",
    placement: "ministry",
    ministry_id: "youth",
    publish_at: "2026-12-01T14:00:00Z",
    expires_at: null,
    created_at: "2026-11-21T14:00:00Z",
  },
];
const services = [
  ["sunday", "Sunday Divine Liturgy", 0, "08:00", "11:30"],
  ["wednesday", "Wednesday Divine Liturgy", 3, "08:00", "10:00"],
  ["school", "Saturday Deacons School", 6, "18:00", null],
  ["vespers", "Saturday Vespers", 6, "19:00", null],
  ["praises", "Saturday Midnight Praises", 6, "20:00", null],
].map(([id, title, weekday, start, end]) => ({
  id,
  title,
  weekday,
  local_start_time: start,
  local_end_time: end,
  start_date: "2026-01-01",
  end_date: null,
  status: "published",
  timezone: "America/Chicago",
}));
const tables = {
  announcements,
  events: [
    {
      id: "e1",
      title: "Parish retreat",
      body: "A day of prayer.",
      location: "St. Mary",
      status: "published",
      ministry_id: null,
      start_at: "2027-07-04T13:00:00Z",
      end_at: null,
      created_at: "2026-11-21T14:00:00Z",
    },
  ],
  recurring_event_series: services,
  event_exceptions: [],
  audit_logs: [
    {
      action: "INSERT",
      entity: "announcements",
      occurred_at: "2026-11-21T14:00:00Z",
    },
  ],
  ministries,
  admin_grants:
    mode === "servant"
      ? [{ permission: "announcements.edit", ministry_id: "youth" }]
      : [],
};
function query(table) {
  let filters = [],
    sort = [],
    range = null,
    limit = null,
    head = false,
    single = false,
    operation = "select",
    payload;
  const q = {
    select(_cols, options = {}) {
      head = options.head;
      return q;
    },
    eq(k, v) {
      filters.push((r) => r[k] === v);
      return q;
    },
    is(k, v) {
      return q.eq(k, v);
    },
    gte(k, v) {
      filters.push((r) => r[k] >= v);
      return q;
    },
    lte(k, v) {
      filters.push((r) => r[k] <= v);
      return q;
    },
    or() {
      return q;
    },
    ilike(k, v) {
      const term = v.slice(1, -1).replace(/\\/g, "").toLowerCase();
      filters.push((r) => (r[k] || "").toLowerCase().includes(term));
      return q;
    },
    order(k, opts = {}) {
      sort.push([k, opts.ascending !== false]);
      return q;
    },
    range(a, b) {
      range = [a, b];
      return q;
    },
    limit(n) {
      limit = n;
      return q;
    },
    maybeSingle() {
      single = true;
      return q;
    },
    update(value) {
      operation = "update";
      payload = value;
      return q;
    },
    insert(value) {
      operation = "insert";
      payload = value;
      return q;
    },
    upsert(value) {
      operation = "upsert";
      payload = value;
      return q;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
  };
  async function execute() {
    window.__reads.push(table);
    if (window.__delay)
      await new Promise((resolve) => setTimeout(resolve, window.__delay));
    if (table === "admin_accounts")
      return {
        data: signedOut
          ? null
          : { active: true, role: mode === "servant" ? "servant" : "owner" },
      };
    if (
      mode === "error" &&
      [
        "announcements",
        "events",
        "recurring_event_series",
        "audit_logs",
      ].includes(table)
    )
      return { error: { message: "Fixture network failure" } };
    if (operation !== "select") {
      window.__writes.push({ table, operation, payload });
      if (window.__denySave)
        return { error: { message: "Permission denied by fixture" } };
      return { data: [{ id: "fixture-saved" }] };
    }
    let rows = [...(tables[table] || [])].map((row) =>
      table === "admin_grants" ? { ...row, user_id: "fixture-user" } : row,
    );
    if (mode === "many" && table === "announcements")
      rows = Array.from({ length: 30 }, (_, index) => ({
        ...announcements[0],
        id: "a" + index,
        title: "Announcement " + index,
      }));
    if (mode === "empty" && !["ministries", "admin_grants"].includes(table))
      rows = [];
    if (mode === "servant" && table === "announcements")
      rows = rows.filter((r) => r.ministry_id === "youth");
    rows = rows.filter((r) => filters.every((f) => f(r)));
    for (const [key, asc] of sort.toReversed())
      rows.sort(
        (a, b) => String(a[key]).localeCompare(String(b[key])) * (asc ? 1 : -1),
      );
    const count = rows.length;
    if (range) rows = rows.slice(range[0], range[1] + 1);
    if (limit) rows = rows.slice(0, limit);
    return { data: head ? null : single ? rows[0] || null : rows, count };
  }
  return q;
}
export const withTimeout = async (operation) => operation;
export async function getSupabase() {
  return {
    from: query,
    rpc: async () => ({
      data: {
        services:
          mode === "empty"
            ? []
            : services.map((s) => ({
                id: s.id,
                title: s.title,
                weekday: s.weekday,
                start: s.local_start_time,
                end: s.local_end_time,
                startDate: s.start_date,
                endDate: null,
              })),
        exceptions: {},
        specialEvents: [],
      },
    }),
    auth: {
      getUser: async () => ({
        data: {
          user:
            signedOut || mode === "anonymous"
              ? null
              : window.__signedInUser || {
                  id: "fixture-user",
                  email: "parish-admin@example.invalid",
                },
        },
      }),
      onAuthStateChange(fn) {
        listener = fn;
        window.__authEvent = (event, session) => {
          if (event === "SIGNED_OUT") signedOut = true;
          if (event === "SIGNED_IN") window.__signedInUser = session.user;
          listener(event, session);
        };
      },
      signOut: async () => {
        signedOut = true;
        listener("SIGNED_OUT");
        return {};
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: {
            currentLevel:
              mode === "mfa" && !window.__mfaVerified ? "aal1" : "aal2",
          },
        }),
        listFactors: async () => ({
          data: { totp: [{ id: "fixture-factor", status: "verified" }] },
        }),
        challengeAndVerify: async () =>
          window.__mfaVerified
            ? { data: {} }
            : { error: { message: "Invalid test code" } },
      },
    },
  };
}
