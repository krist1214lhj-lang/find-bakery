import type { Database } from "@/lib/supabase/database.types";
import type {
  VerificationGrade,
  VerificationState,
} from "@/lib/types";
import {
  getEffectiveVerificationGrade,
  getVerificationState,
  selectDisplayVerification,
} from "@/lib/verification";

export type ReverificationQueueItem = {
  id: string;
  locationId: string;
  bakeryName: string;
  field: Database["public"]["Enums"]["verification_field"];
  menuItemId?: string;
  menuName?: string;
  state: Extract<VerificationState, "due-soon" | "expired" | "conflict">;
  storedGrade: VerificationGrade;
  effectiveGrade: VerificationGrade;
  sourceLabel: string;
  sourceUrl?: string;
  verifiedAt: string;
  nextReviewAt: string;
  note?: string;
  canUseOfficialFlow: boolean;
};

export type AdminReverificationQueue = {
  items: ReverificationQueueItem[];
  counts: {
    conflict: number;
    expired: number;
    dueSoon: number;
  };
};

type VerificationRow =
  Database["public"]["Tables"]["verification_records"]["Row"];
type LocationRow = Pick<
  Database["public"]["Tables"]["bakery_locations"]["Row"],
  "id" | "name"
>;
type MenuRow = Pick<
  Database["public"]["Tables"]["menu_items"]["Row"],
  "id" | "name"
>;
type SourceRow = Pick<
  Database["public"]["Tables"]["sources"]["Row"],
  "id" | "publisher" | "type" | "url"
>;

const officialFlowFields = new Set<
  Database["public"]["Enums"]["verification_field"]
>([
  "address",
  "phone",
  "business_hours",
  "closure",
  "menu",
  "price",
  "facility",
  "official_account",
]);

export function buildReverificationQueue(
  records: VerificationRow[],
  locations: LocationRow[],
  menus: MenuRow[],
  sources: SourceRow[],
  now = new Date(),
): AdminReverificationQueue {
  const locationById = new Map(
    locations.map((location) => [location.id, location]),
  );
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const groups = new Map<string, VerificationRow[]>();

  for (const record of records) {
    const key = [
      record.location_id,
      record.field,
      record.menu_item_id ?? "",
    ].join(":");
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const items = [...groups.values()].flatMap((group) => {
    const selected = selectDisplayVerification(
      group.map((record) => ({
        ...record,
        verifiedAt: record.verified_at,
        nextReviewAt: record.next_review_at,
      })),
    );
    if (!selected) {
      return [];
    }

    const state = getVerificationState(selected, now);
    if (
      state !== "due-soon" &&
      state !== "expired" &&
      state !== "conflict"
    ) {
      return [];
    }

    const location = locationById.get(selected.location_id);
    const source = sourceById.get(selected.source_id);
    if (!location || !source) {
      return [];
    }
    const menu = selected.menu_item_id
      ? menuById.get(selected.menu_item_id)
      : undefined;

    const item: ReverificationQueueItem = {
      id: selected.id,
      locationId: selected.location_id,
      bakeryName: location.name,
      field: selected.field,
      menuItemId: selected.menu_item_id ?? undefined,
      menuName: menu?.name,
      state,
      storedGrade: selected.grade,
      effectiveGrade: getEffectiveVerificationGrade(selected, now),
      sourceLabel: source.publisher ?? source.type,
      sourceUrl: source.url ?? undefined,
      verifiedAt: selected.verified_at,
      nextReviewAt: selected.next_review_at,
      note: selected.note ?? undefined,
      canUseOfficialFlow: officialFlowFields.has(selected.field),
    };
    return [item];
  });

  items.sort((left, right) => {
    const priority = { conflict: 0, expired: 1, "due-soon": 2 };
    return (
      priority[left.state] - priority[right.state] ||
      Date.parse(left.nextReviewAt) - Date.parse(right.nextReviewAt)
    );
  });

  return {
    items,
    counts: {
      conflict: items.filter((item) => item.state === "conflict").length,
      expired: items.filter((item) => item.state === "expired").length,
      dueSoon: items.filter((item) => item.state === "due-soon").length,
    },
  };
}
