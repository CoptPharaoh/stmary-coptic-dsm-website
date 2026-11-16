import { getSupabase } from "../supabase-client.js";
const get = id => document.getElementById(id);
const status = get("status");
const seriesForm = get("series-form");
const exceptionForm = get("exception-form");
async function run(action) {
 try { await action(await getSupabase()); } catch(error) { status.textContent = error.message; }
}
function check(result) { if(result.error) throw result.error; return result.data; }
get("load-series").onclick = () => run(async db => {
 const rows = check(await db.from("recurring_event_series").select("*").order("weekday"));
 get("series-list").replaceChildren();
 if(!rows.length) get("series-list").textContent = "No permitted recurring services.";
 for(const row of rows) {
  const button = document.createElement("button");
  button.textContent = row.title;
  button.onclick = () => {
   seriesForm.reset(); exceptionForm.reset();
   for(const [name,value] of Object.entries(row)) {
    const field = seriesForm.elements.namedItem(name);
    if(field) field.value = value ?? "";
   }
   exceptionForm.elements.series_id.value = row.id;
   seriesForm.hidden = exceptionForm.hidden = false;
  };
  get("series-list").append(button);
 }
});
seriesForm.onsubmit = event => {
 event.preventDefault();
 if(!confirm("Change this entire recurring series?")) return;
 run(async db => {
  const values = Object.fromEntries(new FormData(seriesForm));
  const id = values.id; delete values.id;
  values.weekday = Number(values.weekday);
  values.local_end_time ||= null; values.end_date ||= null;
  const rows = check(await db.from("recurring_event_series").update(values).eq("id",id).select("id"));
  if(!rows.length) throw new Error("Update denied or series unavailable.");
  status.textContent = "Recurring service saved.";
 });
};
exceptionForm.onsubmit = event => {
 event.preventDefault();
 run(async db => {
  const values = Object.fromEntries(new FormData(exceptionForm));
  values.cancelled = values.action === "cancel"; delete values.action;
  for(const key of ["replacement_date","replacement_start","replacement_end"]) values[key] = values.cancelled ? null : values[key] || null;
  if(!values.cancelled && (!values.replacement_date || !values.replacement_start)) throw new Error("Enter a replacement date and start time.");
  check(await db.from("event_exceptions").upsert(values,{onConflict:"series_id,original_date"}).select("id"));
  status.textContent = "Occurrence change saved.";
 });
};

