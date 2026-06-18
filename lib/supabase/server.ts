import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  const config = getSupabaseServerConfig();
  if (!config.configured) {
    return null;
  }

  return createClient<Database>(config.value.url, config.value.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
