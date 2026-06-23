import "server-only";

import {
  buildReverificationQueue,
  type AdminReverificationQueue,
} from "@/lib/reverification";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function getAdminReverificationQueue(
  now = new Date(),
): Promise<AdminReverificationQueue> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const [records, locations, menus, sources] = await Promise.all([
    supabase
      .from("verification_records")
      .select("*")
      .in("result", ["confirmed", "supports", "conflicts"])
      .order("verified_at", { ascending: false }),
    supabase.from("bakery_locations").select("id,name"),
    supabase.from("menu_items").select("id,name"),
    supabase.from("sources").select("id,publisher,type,url"),
  ]);

  const failed = [records, locations, menus, sources].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`재검증 대기열 조회 실패: ${failed.error.message}`);
  }

  return buildReverificationQueue(
    records.data ?? [],
    locations.data ?? [],
    menus.data ?? [],
    sources.data ?? [],
    now,
  );
}
