import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function createClient() {
  return getSupabaseBrowserClient();
}
