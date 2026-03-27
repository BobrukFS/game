import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function createClient() {
  return getSupabaseServerClient();
}
