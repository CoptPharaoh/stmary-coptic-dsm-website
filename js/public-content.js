import { getSupabase } from "./supabase-client.js";
const list = document.getElementById("announcement-list");
const status = document.getElementById("announcement-status");
const retry = document.getElementById("announcement-retry");
async function load() {
  retry.hidden = true;
  list.replaceChildren();
  status.textContent = "Loading announcements…";
  try {
    const db = await getSupabase();
    const { data, error } = await db.rpc("published_announcements");
    if (error) throw error;
    const announcements = data.filter((item) => item.placement === "announcements");
    status.textContent = announcements.length ? "" : "There are no current announcements.";
    for (const item of announcements) {
      const article = document.createElement("article");
      const heading = document.createElement("h3");
      const text = document.createElement("p");
      heading.textContent = item.title;
      text.textContent = item.body || item.summary;
      text.style.whiteSpace = "pre-wrap";
      article.append(heading,text);
      if (item.body_ar) {
        const arabic = document.createElement("p");
        arabic.lang = "ar"; arabic.dir = "rtl";
        arabic.textContent = item.body_ar; article.append(arabic);
      }
      list.append(article);
    }
  } catch {
    status.textContent = "Announcements are temporarily unavailable. Please contact the parish for current information.";
    retry.hidden = false;
  }
}
retry.onclick = load;
load();

