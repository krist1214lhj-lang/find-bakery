import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  AdminOfficialVerificationQueue,
  OfficialSourceType,
  OfficialVerificationDraft,
  OfficialVerificationField,
} from "@/lib/official-verification";

type LocationRow = Pick<
  Database["public"]["Tables"]["bakery_locations"]["Row"],
  | "id"
  | "name"
  | "road_address"
  | "phone"
  | "status"
  | "parking"
  | "seating"
  | "takeout"
  | "shipping"
>;
type MenuRow = Pick<
  Database["public"]["Tables"]["menu_items"]["Row"],
  "id" | "location_id" | "name" | "price" | "availability"
>;
type ActionRow =
  Database["public"]["Tables"]["official_verification_actions"]["Row"];
type SourceRow = Pick<
  Database["public"]["Tables"]["sources"]["Row"],
  "id" | "publisher" | "url"
>;
type VerificationRow = Pick<
  Database["public"]["Tables"]["verification_records"]["Row"],
  "id" | "verified_at" | "next_review_at"
>;

export async function getAdminOfficialVerificationQueue(): Promise<AdminOfficialVerificationQueue> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const [locations, menus, actions, sources, verifications] = await Promise.all([
    supabase
      .from("bakery_locations")
      .select(
        "id,name,road_address,phone,status,parking,seating,takeout,shipping",
      )
      .order("name"),
    supabase
      .from("menu_items")
      .select("id,location_id,name,price,availability")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("official_verification_actions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("sources").select("id,publisher,url"),
    supabase
      .from("verification_records")
      .select("id,verified_at,next_review_at"),
  ]);

  const failed = [locations, menus, actions, sources, verifications].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`공식 확인 데이터 조회 실패: ${failed.error.message}`);
  }

  return mapQueue(
    locations.data ?? [],
    menus.data ?? [],
    actions.data ?? [],
    sources.data ?? [],
    verifications.data ?? [],
  );
}

export async function registerAdminOfficialVerification(
  draft: OfficialVerificationDraft,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const args: Database["public"]["Functions"]["register_official_verification"]["Args"] =
    {
      target_location_id: draft.locationId,
      target_field: draft.field,
      target_menu_item_id: draft.menuItemId,
      official_source_type: draft.sourceType,
      source_publisher: draft.publisher,
      source_url: draft.sourceUrl,
      source_published_at: draft.publishedAt,
      source_effective_from: draft.effectiveFrom,
      source_effective_until: draft.effectiveUntil,
      account_platform: draft.accountPlatform,
      account_handle: draft.accountHandle,
      account_officiality_evidence: draft.officialityEvidence,
      verification_note: draft.note,
    };

  const { error } = await supabase.rpc("register_official_verification", args);
  if (error) {
    throw new Error(error.message);
  }

  return getAdminOfficialVerificationQueue();
}

function mapQueue(
  locations: LocationRow[],
  menus: MenuRow[],
  actions: ActionRow[],
  sources: SourceRow[],
  verifications: VerificationRow[],
): AdminOfficialVerificationQueue {
  const locationById = new Map(
    locations.map((location) => [location.id, location]),
  );
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const verificationById = new Map(
    verifications.map((verification) => [verification.id, verification]),
  );

  return {
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      roadAddress: location.road_address,
      phone: location.phone ?? undefined,
      status: location.status,
      facilities: [
        `주차 ${location.parking}`,
        `좌석 ${location.seating}`,
        `포장 ${location.takeout}`,
        `택배 ${location.shipping}`,
      ].join(" · "),
      menus: menus
        .filter((menu) => menu.location_id === location.id)
        .map((menu) => ({
          id: menu.id,
          name: menu.name,
          price: menu.price ?? undefined,
          availability: menu.availability,
        })),
    })),
    actions: actions.flatMap((action) => {
      const location = locationById.get(action.location_id);
      const source = sourceById.get(action.source_id);
      const verification = verificationById.get(
        action.verification_record_id,
      );
      if (!location || !source || !verification) {
        return [];
      }
      const menu = action.menu_item_id
        ? menuById.get(action.menu_item_id)
        : undefined;
      return [
        {
          id: action.id,
          locationId: action.location_id,
          bakeryName: location.name,
          menuItemId: action.menu_item_id ?? undefined,
          menuName: menu?.name,
          field: action.field as OfficialVerificationField,
          sourceType: action.source_type as OfficialSourceType,
          publisher: source.publisher ?? "공식 출처",
          sourceUrl: source.url ?? undefined,
          note: action.note,
          verifiedAt: verification.verified_at,
          nextReviewAt: verification.next_review_at,
        },
      ];
    }),
  };
}
