import { getSupabase } from "./supabase-client.js";
export async function loadCalendar(from, until) {
 const db = await getSupabase();
 const {data,error} = await db.rpc("parish_calendar_data",{range_start:from,range_end:until});
 if(error) throw error;
 return data;
}

