import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { formatRegionLabel, matchesRegionFilter } from "@/lib/region";
import { getCategoryImage } from "@/lib/category-image";
import { extractRationale, resolveFame } from "@/lib/fame";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Bakery,
  BakerySearchInput,
  BreadCategory,
  ImageTone,
  MenuItem,
  SpecialSchedule,
  VerificationGrade,
} from "@/lib/types";
import {
  getEffectiveVerificationGrade,
  getVerificationState,
  selectDisplayVerification,
} from "@/lib/verification";

type Tables = Database["public"]["Tables"];
type LocationRow = Tables["bakery_locations"]["Row"];
type BusinessHourRow = Tables["business_hours"]["Row"];
type CategoryRow = Tables["bread_categories"]["Row"];
type LocationCategoryRow = Tables["location_bread_categories"]["Row"];
type MenuRow = Tables["menu_items"]["Row"];
type SourceRow = Pick<
  Tables["sources"]["Row"],
  "id" | "type" | "url" | "publisher"
>;
type VerificationRow = Pick<
  Tables["verification_records"]["Row"],
  | "id"
  | "location_id"
  | "menu_item_id"
  | "field"
  | "source_id"
  | "grade"
  | "result"
  | "verified_at"
  | "next_review_at"
  | "normalized_value"
>;
type ScheduleRow = Tables["special_schedules"]["Row"];
type FameRow = Tables["fame_evidence"]["Row"];

type BakeryDataSet = {
  locations: LocationRow[];
  hours: BusinessHourRow[];
  categories: CategoryRow[];
  locationCategories: LocationCategoryRow[];
  menus: MenuRow[];
  sources: SourceRow[];
  verifications: VerificationRow[];
  schedules: ScheduleRow[];
  fameEvidence: FameRow[];
};

export class BakeryRepositoryUnavailableError extends Error {
  constructor(message = "Supabase 공개 조회 설정이 필요합니다.") {
    super(message);
    this.name = "BakeryRepositoryUnavailableError";
  }
}

export const getBreadCategories = cache(async (): Promise<BreadCategory[]> => {
  const { categories } = await loadBakeryDataSet();
  return categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    emoji: getCategoryEmoji(category.slug),
  }));
});

export const getAllBakeries = cache(async (): Promise<Bakery[]> => {
  const data = await loadBakeryDataSet();
  return data.locations.map((location) => mapBakery(location, data));
});

export async function getBakeryById(id: string) {
  const bakeries = await getAllBakeries();
  return bakeries.find((bakery) => bakery.id === id);
}

export async function getBakeryBySlug(slug: string) {
  const bakeries = await getAllBakeries();
  return bakeries.find((bakery) => bakery.slug === slug);
}

export async function getRecentlyVerifiedBakeries(limit: number) {
  const bakeries = await getAllBakeries();
  return [...bakeries]
    .sort(
      (left, right) =>
        Date.parse(right.verification.checkedAt) -
        Date.parse(left.verification.checkedAt),
    )
    .slice(0, limit);
}

export async function searchBakeries(input: BakerySearchInput) {
  const bakeries = await getAllBakeries();
  return filterBakeries(bakeries, input);
}

export function filterBakeries(bakeries: Bakery[], input: BakerySearchInput) {
  const keywords = getSearchKeywords(input.q);

  return bakeries.filter((bakery) => {
    const searchableValues = [
      bakery.name,
      ...bakery.searchAliases,
      bakery.region,
      bakery.roadAddress,
      ...bakery.categories,
      ...bakery.menus.map((menu) => menu.name),
    ].map(normalizeSearchValue);
    const matchesKeyword =
      keywords.length === 0 ||
      keywords.every((keyword) =>
        searchableValues.some((value) => value.includes(keyword)),
      );
    const matchesCategory =
      !input.category || bakery.categorySlugs.includes(input.category);
    const matchesRegion =
      !input.region || matchesRegionFilter(bakery.region, input.region);

    return matchesKeyword && matchesCategory && matchesRegion;
  });
}

const loadBakeryDataSet = cache(async (): Promise<BakeryDataSet> => {
  const client = createSupabasePublicClient();
  if (!client) {
    throw new BakeryRepositoryUnavailableError();
  }

  const [
    locations,
    hours,
    categories,
    locationCategories,
    menus,
    sources,
    verifications,
    schedules,
    fameEvidence,
  ] = await Promise.all([
    client.from("bakery_locations").select("*").order("name"),
    client.from("business_hours").select("*"),
    client.from("bread_categories").select("*").order("name"),
    client.from("location_bread_categories").select("*"),
    client.from("menu_items").select("*").eq("status", "active"),
    client
      .from("sources")
      .select("id,type,url,publisher")
      .eq("status", "accessible"),
    client
      .from("verification_records")
      .select(
        "id,location_id,menu_item_id,field,source_id,grade,result,verified_at,next_review_at,normalized_value",
      )
      .order("verified_at", { ascending: false }),
    client.from("special_schedules").select("*").eq("status", "confirmed"),
    client.from("fame_evidence").select("*").eq("status", "active"),
  ]);

  const failed = [
    locations,
    hours,
    categories,
    locationCategories,
    menus,
    sources,
    verifications,
    schedules,
    fameEvidence,
  ].find((result) => result.error);

  if (failed?.error) {
    throw new BakeryRepositoryUnavailableError(
      `Supabase 빵집 조회 실패: ${failed.error.message}`,
    );
  }

  return {
    locations: locations.data ?? [],
    hours: hours.data ?? [],
    categories: categories.data ?? [],
    locationCategories: locationCategories.data ?? [],
    menus: menus.data ?? [],
    sources: sources.data ?? [],
    verifications: verifications.data ?? [],
    schedules: schedules.data ?? [],
    fameEvidence: fameEvidence.data ?? [],
  };
});

function mapBakery(location: LocationRow, data: BakeryDataSet): Bakery {
  const categoriesById = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  const sourceById = new Map(data.sources.map((source) => [source.id, source]));
  const categories = data.locationCategories
    .filter((item) => item.location_id === location.id)
    .map((item) => categoriesById.get(item.category_id))
    .filter((category): category is CategoryRow => Boolean(category));
  const hours = getTodayHours(
    data.hours.filter((hour) => hour.location_id === location.id),
  );
  const verification =
    selectDisplayVerification(
      data.verifications
        .filter(
          (item) =>
            item.location_id === location.id &&
            item.field === "business_hours",
        )
        .map(toVerificationCandidate),
    ) ??
    selectDisplayVerification(
      data.verifications
        .filter((item) => item.location_id === location.id)
        .map(toVerificationCandidate),
    );
  const verificationSource = verification
    ? sourceById.get(verification.source_id)
    : undefined;
  const verificationState = verification
    ? getVerificationState(verification)
    : "unverified";
  const effectiveGrade = verification
    ? getEffectiveVerificationGrade(verification)
    : "D";
  const fame = data.fameEvidence.find(
    (item) => item.location_id === location.id,
  );
  const fameSource = fame?.source_id
    ? sourceById.get(fame.source_id)
    : undefined;
  const presentation = getPresentation(categories.map((item) => item.slug));
  // "이곳이 알려진 이유" 카드: fame_evidence 우선, 없으면 정밀검증 rationale로 채운다.
  const fameResolved = resolveFame({
    fameDescription: fame?.description,
    fameTitle: fame?.title,
    fameSourceLabel: fameSource?.publisher ?? fameSource?.url ?? null,
    verificationRationale: extractRationale(verification?.normalized_value),
    verificationSourceLabel:
      verificationSource?.publisher ?? verificationSource?.url ?? null,
  });

  return {
    id: location.id,
    slug: location.slug,
    name: location.name,
    searchAliases: location.search_aliases,
    region: formatRegionLabel(
      location.region_level_1,
      location.region_level_2,
      location.region_level_3,
    ),
    roadAddress: location.road_address,
    latitude: location.latitude,
    longitude: location.longitude,
    phone: location.phone ?? undefined,
    categories: categories.map((category) => category.name),
    categorySlugs: categories.map((category) => category.slug),
    imageTone: presentation.imageTone,
    heroEmoji: presentation.heroEmoji,
    categoryImage: presentation.categoryImage,
    todayHours: hours.label,
    opensAt: hours.opensAt,
    closesAt: hours.closesAt,
    specialSchedules: data.schedules
      .filter((schedule) => schedule.location_id === location.id)
      .map((schedule) => mapSchedule(schedule, sourceById)),
    scheduleNote: getScheduleNote(location.status),
    facilities: mapFacilities(location),
    fameReason: fameResolved.reason,
    fameSource: fameResolved.source,
    verification: {
      grade: effectiveGrade as VerificationGrade,
      checkedAt:
        verification?.verifiedAt ?? location.updated_at ?? location.created_at,
      nextReviewAt:
        verification?.nextReviewAt ??
        location.updated_at ??
        location.created_at,
      state: verificationState,
      sourceLabel:
        verificationState === "conflict"
          ? `출처 충돌 · ${
              verificationSource?.publisher ??
              verificationSource?.type ??
              "재확인 필요"
            }`
          : (verificationSource?.publisher ??
            verificationSource?.type ??
            "출처 확인 필요"),
      sourceUrl: verificationSource?.url ?? undefined,
    },
    menus: data.menus
      .filter((menu) => menu.location_id === location.id)
      .map(mapMenu),
  };
}

function toVerificationCandidate(record: VerificationRow) {
  return {
    ...record,
    verifiedAt: record.verified_at,
    nextReviewAt: record.next_review_at,
  };
}

function getTodayHours(hours: BusinessHourRow[]) {
  const dayOfWeek = getKoreanDayOfWeek();
  const candidates = hours
    .filter((hour) => hour.day_of_week === dayOfWeek)
    .sort((left, right) => left.sequence - right.sequence);
  const first = candidates[0];

  if (!first || first.is_closed || !first.opens_at || !first.closes_at) {
    return { label: "오늘 영업시간 확인 필요", opensAt: "", closesAt: "" };
  }

  const opensAt = first.opens_at.slice(0, 5);
  const closesAt = first.closes_at.slice(0, 5);
  return { label: `${opensAt}–${closesAt}`, opensAt, closesAt };
}

function getKoreanDayOfWeek() {
  const shortDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date());
  return (
    {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    }[shortDay] ?? 1
  );
}

function mapMenu(menu: MenuRow): MenuItem {
  return {
    id: menu.id,
    name: menu.name,
    price: menu.price ?? undefined,
    emoji: getMenuEmoji(menu.name),
    checkedAt: menu.checked_at ?? undefined,
  };
}

function mapSchedule(
  schedule: ScheduleRow,
  sourceById: Map<string, SourceRow>,
): SpecialSchedule {
  const source = sourceById.get(schedule.source_id);
  return {
    id: schedule.id,
    date: formatDateInKorea(schedule.starts_at),
    type:
      schedule.type === "temporary_closed"
        ? "temporary-closed"
        : schedule.type === "special_open"
          ? "special-open"
          : "changed-hours",
    opensAt: schedule.opens_at?.slice(0, 5),
    closesAt: schedule.closes_at?.slice(0, 5),
    note: schedule.note ?? "공식 일정 변경",
    confirmed: schedule.status === "confirmed",
    sourceLabel: source?.publisher ?? source?.type ?? "출처 확인 필요",
  };
}

function formatDateInKorea(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function mapFacilities(location: LocationRow) {
  return [
    mapFacility("포장", location.takeout),
    mapFacility("좌석", location.seating),
    mapFacility("주차", location.parking),
    mapFacility("택배", location.shipping),
  ];
}

function mapFacility(
  label: string,
  state: Database["public"]["Enums"]["facility_state"],
) {
  const suffix = {
    yes: "가능",
    no: "없음",
    limited: "제한적",
    unknown: "확인 필요",
  }[state];
  return `${label} ${suffix}`;
}

function getPresentation(categorySlugs: string[]): {
  imageTone: ImageTone;
  heroEmoji: string;
  categoryImage: string;
} {
  const primary = categorySlugs[0];
  const categoryImage = getCategoryImage(primary);
  if (primary === "bagel") {
    return { imageTone: "sage", heroEmoji: "🥯", categoryImage };
  }
  if (primary === "meal-bread") {
    return { imageTone: "berry", heroEmoji: "🍞", categoryImage };
  }
  return {
    imageTone: "gold",
    heroEmoji: getCategoryEmoji(primary),
    categoryImage,
  };
}

function getCategoryEmoji(slug?: string) {
  return (
    {
      "salt-bread": "🥐",
      bagel: "🥯",
      croissant: "🌙",
      "meal-bread": "🍞",
      cake: "🍰",
      "baked-sweets": "🧁",
    }[slug ?? ""] ?? "🥖"
  );
}

function getMenuEmoji(name: string) {
  if (name.includes("베이글")) return "🥯";
  if (name.includes("크루아상")) return "🌙";
  if (name.includes("식빵")) return "🍞";
  if (name.includes("크림치즈")) return "🌿";
  if (name.includes("팥")) return "🫘";
  return "🥐";
}

function getScheduleNote(
  status: Database["public"]["Enums"]["location_status"],
) {
  if (status === "verification_needed") {
    return "정보 확인일이 지나 방문 전 공식 채널 확인이 필요해요.";
  }
  return "재료 소진이나 임시 일정은 공식 채널에서 다시 확인해 주세요.";
}

function getSearchKeywords(query?: string) {
  if (!query?.trim()) {
    return [];
  }

  return query
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeSearchValue)
    .filter(Boolean);
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
