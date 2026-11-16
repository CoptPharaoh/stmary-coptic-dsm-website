import { supabaseConfig } from "./supabase-config.js";
let client;
export async function getSupabase() {
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    throw new Error("Administration is awaiting Supabase configuration.");
  }
  if (!supabaseConfig.publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key in browser configuration.");
  }
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm");
    client = createClient(supabaseConfig.url, supabaseConfig.publishableKey);
  }
  return client;
}

