// 로컬 전용 관리자 "작업대" 데이터 로더 (서버 전용 — fs + DB 읽기).
// 입력: output/stage2-verified.json (2차 검증 산출물).
// 추가: DB(bakery_locations 등)를 읽어 각 항목에 저장 여부·기존 카테고리·현재 등급을 붙인다(읽기 전용).
// 좌표·주소·카테고리는 카카오값/DB값 그대로. quest_ 미사용.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getEffectiveVerificationGrade,
  selectDisplayVerification,
} from "@/lib/verification";
import {
  createWorkbenchClient,
  distanceM,
  kakaoIdFrom,
  norm,
} from "@/lib/workbench-write";

export type WorkbenchDecision = "승인후보" | "보류" | "제외";

export type WorkbenchItem = {
  id: string;
  decision: WorkbenchDecision;
  name: string;
  category: string;
  roadAddress: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  placeUrl: string | null;
  isFranchise: boolean;
  franchiseBrand: string | null;
  reason: string | null;
  decidedBy: string | null;
  // DB 상태(읽기 전용 첨부)
  saved: boolean;
  savedLocationId: string | null;
  savedSlug: string | null;
  existingCategorySlugs: string[];
  currentGrade: string | null;
};

export type WorkbenchData = {
  items: WorkbenchItem[];
  generatedAt: string | null;
  model: string | null;
  error?: string;
  dbConnected: boolean;
};

const DECISIONS: WorkbenchDecision[] = ["승인후보", "보류", "제외"];

function readStage2(): {
  rows: Record<string, unknown>[];
  generatedAt: string | null;
  model: string | null;
  error?: string;
} {
  const file = path.join(process.cwd(), "output", "stage2-verified.json");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {
      rows: [],
      generatedAt: null,
      model: null,
      error:
        "output/stage2-verified.json 이 없습니다. 먼저 1차·2차 검증 스크립트를 실행해 산출물을 만들어 주세요.",
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      results?: unknown[];
      generated_at?: string;
      model?: string;
    };
    return {
      rows: (parsed.results ?? []) as Record<string, unknown>[],
      generatedAt: parsed.generated_at ?? null,
      model: parsed.model ?? null,
    };
  } catch {
    return {
      rows: [],
      generatedAt: null,
      model: null,
      error: "stage2-verified.json 을 파싱하지 못했습니다(형식 오류).",
    };
  }
}

type SavedInfo = {
  locationId: string;
  slug: string;
  categories: string[];
  grade: string | null;
};

async function loadSavedIndex(): Promise<{
  connected: boolean;
  byLocation: {
    id: string;
    slug: string;
    seedKey: string | null;
    roadAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    name: string;
  }[];
  categoriesByLocation: Map<string, string[]>;
  gradeByLocation: Map<string, string>;
}> {
  const sb = createWorkbenchClient();
  if (!sb) {
    return {
      connected: false,
      byLocation: [],
      categoriesByLocation: new Map(),
      gradeByLocation: new Map(),
    };
  }

  const [locations, links, cats, verifications] = await Promise.all([
    sb
      .from("bakery_locations")
      .select("id, slug, seed_key, road_address, latitude, longitude, name"),
    sb.from("location_bread_categories").select("location_id, category_id"),
    sb.from("bread_categories").select("id, slug"),
    sb
      .from("verification_records")
      .select("location_id, field, grade, result, verified_at, next_review_at"),
  ]);

  const idToSlug = new Map((cats.data ?? []).map((c) => [c.id, c.slug]));
  const categoriesByLocation = new Map<string, string[]>();
  for (const link of links.data ?? []) {
    const slug = idToSlug.get(link.category_id);
    if (!slug) continue;
    const list = categoriesByLocation.get(link.location_id) ?? [];
    list.push(slug);
    categoriesByLocation.set(link.location_id, list);
  }

  // 위치별 현재 등급: business_hours 우선, 없으면 전체 → 최신 active 레코드 채택
  const byLoc = new Map<string, ReturnType<typeof toCandidate>[]>();
  for (const v of verifications.data ?? []) {
    const list = byLoc.get(v.location_id) ?? [];
    list.push(toCandidate(v));
    byLoc.set(v.location_id, list);
  }
  const gradeByLocation = new Map<string, string>();
  for (const [locId, records] of byLoc) {
    const hours = records.filter((r) => r.field === "business_hours");
    const chosen =
      selectDisplayVerification(hours) ?? selectDisplayVerification(records);
    if (chosen) gradeByLocation.set(locId, getEffectiveVerificationGrade(chosen));
  }

  return {
    connected: true,
    byLocation: (locations.data ?? []).map((l) => ({
      id: l.id,
      slug: l.slug,
      seedKey: l.seed_key,
      roadAddress: l.road_address,
      latitude: l.latitude,
      longitude: l.longitude,
      name: l.name,
    })),
    categoriesByLocation,
    gradeByLocation,
  };
}

function toCandidate(v: {
  field: string;
  grade: string;
  result: string;
  verified_at: string;
  next_review_at: string;
}) {
  return {
    field: v.field,
    grade: v.grade as "A" | "B" | "C" | "D",
    result: v.result as
      | "confirmed"
      | "supports"
      | "conflicts"
      | "superseded"
      | "rejected",
    verifiedAt: v.verified_at,
    nextReviewAt: v.next_review_at,
  };
}

export async function loadWorkbench(): Promise<WorkbenchData> {
  const stage2 = readStage2();
  if (stage2.error) {
    return {
      items: [],
      generatedAt: null,
      model: null,
      error: stage2.error,
      dbConnected: false,
    };
  }

  const saved = await loadSavedIndex();

  function findSaved(item: {
    slug: string | null;
    roadAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    name: string;
  }): SavedInfo | null {
    const match = saved.byLocation.find((e) => {
      if (item.slug && (e.slug === item.slug || e.seedKey === item.slug)) return true;
      if (e.roadAddress && item.roadAddress && norm(e.roadAddress) === norm(item.roadAddress))
        return true;
      if (
        item.latitude != null &&
        item.longitude != null &&
        e.latitude != null &&
        e.longitude != null
      ) {
        const d = distanceM(item.latitude, item.longitude, Number(e.latitude), Number(e.longitude));
        const nameEq =
          norm(e.name).includes(norm(item.name)) || norm(item.name).includes(norm(e.name));
        if (Number.isFinite(d) && d <= 50 && nameEq) return true;
      }
      return false;
    });
    if (!match) return null;
    return {
      locationId: match.id,
      slug: match.slug,
      categories: saved.categoriesByLocation.get(match.id) ?? [],
      grade: saved.gradeByLocation.get(match.id) ?? null,
    };
  }

  const items: WorkbenchItem[] = stage2.rows
    .map((r, index): WorkbenchItem | null => {
      const decision = r.decision as string;
      if (!DECISIONS.includes(decision as WorkbenchDecision)) return null;
      const placeUrl = (r.place_url as string) ?? null;
      const idFromUrl = kakaoIdFrom(placeUrl);
      const id = idFromUrl ? `kakao-${idFromUrl}` : `row-${index}`;
      const lat = typeof r.latitude === "number" ? r.latitude : null;
      const lon = typeof r.longitude === "number" ? r.longitude : null;
      const name = (r.name as string) ?? "(이름 없음)";
      const roadAddress = (r.road_address as string) ?? null;

      const savedInfo = findSaved({ slug: id.startsWith("kakao-") ? id : null, roadAddress, latitude: lat, longitude: lon, name });

      return {
        id,
        decision: decision as WorkbenchDecision,
        name,
        category: (r.category as string) ?? "",
        roadAddress,
        address: (r.address as string) ?? null,
        latitude: lat,
        longitude: lon,
        phone: (r.phone as string) ?? null,
        placeUrl,
        isFranchise: Boolean(r.is_franchise),
        franchiseBrand: (r.franchise_brand as string) ?? null,
        reason: (r.reason as string) ?? null,
        decidedBy: (r.decided_by as string) ?? null,
        saved: savedInfo != null,
        savedLocationId: savedInfo?.locationId ?? null,
        savedSlug: savedInfo?.slug ?? null,
        existingCategorySlugs: savedInfo?.categories ?? [],
        currentGrade: savedInfo?.grade ?? null,
      };
    })
    .filter((x): x is WorkbenchItem => x !== null);

  return {
    items,
    generatedAt: stage2.generatedAt,
    model: stage2.model,
    dbConnected: saved.connected,
  };
}
