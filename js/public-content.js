import { getSupabase, withTimeout } from "./supabase-client.js";

export function selectAnnouncements(data, home) {
  return data.filter(item => !item.ministry_id && (home
    ? item.placement === "homepage"
    : ["homepage", "announcements"].includes(item.placement)))
    .sort((a, b) => Date.parse(b.publish_at) - Date.parse(a.publish_at) || a.id.localeCompare(b.id))
    .slice(0, home ? 3 : 100);
}
export function announcementAnchor(id) { return `announcement-${id}`; }
export function preview(item) {
  const text = (item.summary || item.body || "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
}

export function mountAnnouncements(root, getClient = getSupabase) {
  const home = root.dataset.announcements === "home";
  const list = root.querySelector("#announcement-list");
  const status = root.querySelector("#announcement-status");
  const retry = root.querySelector("#announcement-retry");
  function node(tag, text) {
    const result = document.createElement(tag);
    result.textContent = text || "";
    return result;
  }
  function state(name, message) {
    root.dataset.state = name;
    status.textContent = message;
    status.hidden = !message;
    retry.hidden = name !== "error";
    list.setAttribute("aria-busy", String(name === "loading"));
  }
  async function load() {
    list.replaceChildren();
    state("loading", "Loading announcements...");
    try {
      const db = await getClient();
      // Eligibility (status, scheduled publication and expiry) is enforced by the RPC.
      const { data, error } = await withTimeout(db.rpc("published_announcements"), "Loading announcements");
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Invalid announcement response");
      const rows = selectAnnouncements(data, home);
      for (const item of rows) {
        const article = node("article");
        article.className = home ? "announcement-preview" : "announcement-card";
        article.id = announcementAnchor(item.id);
        article.tabIndex = -1;
        const heading = node(home ? "h4" : "h3", item.title);
        const date = new Date(item.publish_at);
        if (!Number.isNaN(date.valueOf())) {
          const time = node("time", new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Chicago" }).format(date));
          time.dateTime = date.toISOString(); article.append(time);
        }
        article.append(heading);
        article.append(node("p", home ? preview(item) : item.body || item.summary));
        if (home) {
          const link = node("a", "Read announcement");
          link.className = "text-link";
          link.href = `announcements.html#${announcementAnchor(item.id)}`;
          link.setAttribute("aria-label", `Read announcement: ${item.title}`);
          article.append(link);
        } else if (item.title_ar || item.body_ar) {
          const arabic = node("div"); arabic.className = "announcement-arabic";
          arabic.lang = "ar"; arabic.dir = "rtl";
          if (item.title_ar) arabic.append(node("h4", item.title_ar));
          if (item.body_ar) arabic.append(node("p", item.body_ar));
          article.append(arabic);
        }
        list.append(article);
      }
      state(rows.length ? "success" : "empty", rows.length ? "" : "No new parish announcements at this time.");
      if (!home && location.hash) {
        const target = [...list.children].find(item => `#${item.id}` === location.hash);
        if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: "start" }); }
      }
    } catch {
      list.replaceChildren();
      state("error", "Announcements are temporarily unavailable. Please try again.");
    }
  }
  retry.onclick = load;
  return load();
}
if (typeof document !== "undefined") {
  document.querySelectorAll("[data-announcements]").forEach(root => mountAnnouncements(root));
}
