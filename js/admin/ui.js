export const get = (id) => document.getElementById(id);
export function node(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text ?? "";
  if (className) el.className = className;
  return el;
}
export function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function message(text, error = false) {
  get("status").textContent = text;
  get("status").dataset.error = String(error);
}
export function badge(status) {
  return node("span", status.replaceAll("_", " "), "badge badge-" + status);
}
export function empty(host, text) {
  host.replaceChildren(node("p", text, "empty-state"));
}
export function button(text, action) {
  const b = node("button", text);
  b.type = "button";
  b.onclick = action;
  return b;
}
