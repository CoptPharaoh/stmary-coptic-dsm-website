import { supabaseConfig } from "./supabase-config.js";
let client;
let loading;
export async function withTimeout(operation, label, milliseconds = 20000) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out. Check your connection and refresh to retry.`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function getSupabase() {
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    throw new Error("Administration is awaiting Supabase configuration.");
  }
  if (!supabaseConfig.publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key in browser configuration.");
  }
  if (!client) {
    loading ||= withTimeout(import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"), "Loading the authentication library")
      .then(({ createClient }) => {
        client = createClient(supabaseConfig.url, supabaseConfig.publishableKey);
        return client;
      }).catch((error) => { loading = undefined; throw error; });
    await loading;
  }
  return client;
}

