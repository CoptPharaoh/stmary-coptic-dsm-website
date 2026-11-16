import { getSupabase } from "../supabase-client.js";
const get = (id) => document.getElementById(id);
const status = get("status");
let db, table = "announcements", records = [], factor;
const editor = get("editor");
function message(text) { status.textContent = text; }
async function run(action) {
  try { await action(); } catch (error) { message(error.message); }
}
function check(result) { if (result.error) throw result.error; return result.data; }
function hidePrivate() {
  get("workspace").hidden = true;
  editor.hidden = true;
  records = [];
  get("records").replaceChildren();
}
async function authorize() {
  hidePrivate();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) { get("login").hidden = false; return; }
  get("login").hidden = true;
  get("logout").hidden = false;
  const account = check(await db.from("admin_accounts").select("role,active").eq("user_id", data.user.id).maybeSingle());
  if (!account?.active) throw new Error("This account has no active administrative access.");
  const assurance = check(await db.auth.mfa.getAuthenticatorAssuranceLevel());
  if (["owner","administrator"].includes(account.role) && assurance.currentLevel !== "aal2") {
    get("mfa-panel").hidden = false;
    const factors = check(await db.auth.mfa.listFactors());
    factor = factors.totp.find((item) => item.status === "verified")?.id;
    if (!factor) {
      const enrollment = check(await db.auth.mfa.enroll({ factorType: "totp" }));
      factor = enrollment.id;
      get("qr").src = enrollment.totp.qr_code;
      get("qr").hidden = false;
    }
    message("Verify your authenticator to continue.");
    return;
  }
  get("mfa-panel").hidden = true;
  const ministries = check(await db.from("ministries").select("id,name"));
  editor.elements.ministry_id.replaceChildren(new Option("Parish-wide",""),...ministries.map((m) => new Option(m.name,m.id)));
  get("workspace").hidden = false;
  await load();
}
async function load() {
  records = check(await db.from(table).select("*").order("created_at",{ascending:false}).limit(100));
  render();
  message("Content loaded. Database permissions apply to every save.");
}
function render() {
  const query = get("search").value.trim().toLowerCase();
  const visible = records.filter((record) => record.title.toLowerCase().includes(query));
  get("records").replaceChildren();
  if (!visible.length) { get("records").textContent = "No matching content."; return; }
  for (const record of visible) {
    const row = document.createElement("article"), copy = document.createElement("div");
    const title = document.createElement("h2"), state = document.createElement("p"), button = document.createElement("button");
    title.textContent = record.title; state.textContent = record.status;
    button.textContent = "Edit"; button.onclick = () => edit(record);
    copy.append(title,state); row.append(copy,button); get("records").append(row);
  }
}
function edit(record = {}) {
  editor.reset();
  for (const [name,value] of Object.entries(record)) {
    const field = editor.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "datetime-local" && value) {
      const date = new Date(value);
      date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
      field.value = date.toISOString().slice(0,16);
    } else field.value = value ?? "";
  }
  get("announcement-fields").hidden = table !== "announcements";
  get("event-fields").hidden = table !== "events";
  editor.elements.start_at.required = table === "events";
  editor.elements.ministry_id.disabled = !!record.id;
  editor.hidden = false;
  editor.elements.title.focus();
}
get("login-form").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const form = event.currentTarget;
    check(await db.auth.signInWithPassword({email:form.email.value,password:form.password.value}));
    form.password.value = ""; await authorize();
  });
};
get("reset-request").onclick = () => run(async () => {
  check(await db.auth.resetPasswordForEmail(get("login-form").email.value,{redirectTo:new URL("./index.html",location.href).href}));
  message("Password reset requested. Check your email.");
});
get("password-form").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    check(await db.auth.updateUser({password:get("password-form").password.value}));
    get("password-panel").hidden = true; await authorize();
  });
};
get("verify").onclick = () => run(async () => {
  check(await db.auth.mfa.challengeAndVerify({factorId:factor,code:get("mfa-code").value}));
  get("mfa-code").value = ""; await authorize();
});
get("logout").onclick = () => run(async () => {
  hidePrivate(); check(await db.auth.signOut()); location.reload();
});
editor.onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const names = table === "announcements"
      ? ["title","summary","body","title_ar","body_ar","ministry_id","placement","status","publish_at","expires_at"]
      : ["title","body","ministry_id","location","status","start_at","end_at"];
    const payload = {};
    for (const name of names) {
      const field = editor.elements.namedItem(name);
      payload[name] = field.value;
      if (field.type === "datetime-local") payload[name] = field.value ? new Date(field.value).toISOString() : null;
    }
    payload.ministry_id ||= null;
    if (table === "announcements") payload.publish_at ||= new Date().toISOString();
    if (payload.status === "published" && !confirm("Publish these changes to the public website?")) return;
    const id = editor.elements.id.value;
    const request = id ? db.from(table).update(payload).eq("id",id) : db.from(table).insert(payload);
    const saved = check(await request.select("id"));
    if (!saved.length) throw new Error("Save was denied or the record is no longer available.");
    editor.hidden = true; await load(); message("Changes saved.");
  });
};
document.querySelectorAll("[data-table]").forEach((button) => button.onclick = () => run(async () => {
  table = button.dataset.table; editor.hidden = true; await load();
}));
get("new-record").onclick = () => edit();
get("close-editor").onclick = () => { editor.hidden = true; };
get("refresh").onclick = () => run(load);
get("search").oninput = render;
run(async () => {
  db = await getSupabase();
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") { hidePrivate(); get("login").hidden = false; }
    if (event === "PASSWORD_RECOVERY") { hidePrivate(); get("password-panel").hidden = false; }
  });
  if (location.hash.includes("type=invite") || location.hash.includes("type=recovery")) {
    get("password-panel").hidden = false; message("Set a password for your account."); return;
  }
  await authorize();
});

