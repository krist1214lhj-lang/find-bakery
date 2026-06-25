import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// 관리자 작업대는 파이프라인 스크립트(approve-and-save.mjs)와 동일하게
// 원격(라이브) Supabase 자격증명(.env.remote.local)을 사용한다.
// (앱의 나머지 부분은 .env.local = 로컬 dev DB 를 그대로 사용)
// .env.remote.local 은 gitignored 로컬 파일이고, 이 페이지/엔드포인트는 로컬 전용
// (미들웨어+가드로 배포 차단)이라 외부에 노출되지 않는다.
let cachedRemoteClient: SupabaseClient<Database> | null | undefined;

export function createWorkbenchClient(): SupabaseClient<Database> | null {
  if (cachedRemoteClient !== undefined) return cachedRemoteClient;
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(path.join(process.cwd(), ".env.remote.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim();
    }
  } catch {
    cachedRemoteClient = null;
    return null;
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\/.+\.supabase\.co/.test(url)) {
    cachedRemoteClient = null;
    return null;
  }
  cachedRemoteClient = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedRemoteClient;
}

// 관리자 작업대 쓰기 로직 (서버 전용).
// approve-and-save.mjs 의 저장 규칙을 그대로 재사용한다.
// - 좌표·주소는 카카오값만(추측 금지), slug/seed_key = kakao-<placeId> (재실행 안전).
// - 등급 기록은 뺑드미와 동일 구조: sources 1행 → verification_records (field=business_hours).
// - quest_ 테이블 미사용. 쓰기는 service_role(admin) 클라이언트로만.

export const BREAD_CATEGORY_SLUGS = [
  "salt-bread",
  "bagel",
  "baked-sweets",
  "meal-bread",
  "cake",
  "croissant",
] as const;

const FRANCHISE_SLUG: Record<string, string> = {
  파리바게뜨: "paris-baguette",
  파리바게트: "paris-baguette",
  뚜레쥬르: "tous-les-jours",
  뚜레주르: "tous-les-jours",
  아티제: "artisee",
  던킨: "dunkin",
  파리크라상: "paris-croissant",
  신라명과: "shilla-myungkwa",
  브레댄코: "bredenco",
};

const STRONG_DUP_M = 50;
// 등급별 재검토 기간(일). 모두 dueSoonDays(14) 보다 커서 state=current → 표시 등급이 선택값 그대로.
const GRADE_REVIEW_DAYS: Record<string, number> = { A: 30, B: 90, C: 60, D: 30 };
const VALID_GRADES = ["A", "B", "C", "D"] as const;
export type ManualGrade = (typeof VALID_GRADES)[number];

export const norm = (s?: string | null) => (s ?? "").replace(/\s+/g, "").toLowerCase();

export function kakaoIdFrom(url?: string | null): string | null {
  const m = (url ?? "").match(/\/(\d+)\s*$/);
  return m ? m[1] : null;
}

export function distanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseRegion(road?: string | null, lot?: string | null) {
  const src = (road || lot || "").split(/\s+/).filter(Boolean);
  const region_level_1 = src[0] || null;
  const region_level_2 = src[1] || null;
  let region_level_3: string | null = null;
  for (const t of (lot || "").split(/\s+/).filter(Boolean)) {
    if (/[동읍면]$/.test(t) || /\d+가$/.test(t)) {
      region_level_3 = t;
      break;
    }
  }
  return { region_level_1, region_level_2, region_level_3 };
}

export type ApproveInput = {
  name: string;
  category?: string | null;
  roadAddress?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  placeUrl?: string | null;
  isFranchise?: boolean;
  franchiseBrand?: string | null;
};

export type ApproveResult = {
  saved: boolean;
  alreadyExisted: boolean;
  locationId: string;
  slug: string;
};

export async function saveApprovedBakery(
  input: ApproveInput,
): Promise<ApproveResult> {
  const sb = createWorkbenchClient();
  if (!sb) throw new Error("원격 Supabase(.env.remote.local) 설정이 필요합니다.");

  const id = kakaoIdFrom(input.placeUrl);
  if (!id) throw new Error("place_url에서 kakao id를 찾지 못해 slug를 만들 수 없습니다.");
  if (!input.roadAddress) throw new Error("도로명주소가 없어 저장할 수 없습니다.");
  const lat = input.latitude;
  const lon = input.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("좌표가 없어 저장할 수 없습니다.");
  }
  const slug = `kakao-${id}`;
  const region = parseRegion(input.roadAddress, input.address);
  if (!region.region_level_1 || !region.region_level_2) {
    throw new Error("주소에서 지역(시/구)을 파싱하지 못했습니다.");
  }

  // 저장 직전 중복 재확인 (slug / seed_key / 도로명 / 좌표50m+이름)
  const { data: existing, error: exErr } = await sb
    .from("bakery_locations")
    .select("id, slug, seed_key, road_address, latitude, longitude, name");
  if (exErr) throw new Error(`기존 빵집 조회 실패: ${exErr.message}`);

  const dup = (existing ?? []).find((e) => {
    if (e.slug === slug || e.seed_key === slug) return true;
    if (e.road_address && norm(e.road_address) === norm(input.roadAddress)) return true;
    const d = distanceM(lat as number, lon as number, Number(e.latitude), Number(e.longitude));
    const nameEq = norm(e.name).includes(norm(input.name)) || norm(input.name).includes(norm(e.name));
    return Number.isFinite(d) && d <= STRONG_DUP_M && nameEq;
  });
  if (dup) {
    return { saved: false, alreadyExisted: true, locationId: dup.id, slug: dup.slug };
  }

  // 브랜드 find-or-create (매핑된 프랜차이즈는 공유, 그 외 위치별)
  const fr =
    input.isFranchise && input.franchiseBrand && FRANCHISE_SLUG[input.franchiseBrand];
  const brandSlug = fr ? FRANCHISE_SLUG[input.franchiseBrand as string] : slug;
  const brandName = fr ? (input.franchiseBrand as string) : input.name;

  let brandId: string;
  const { data: bEx, error: bSelErr } = await sb
    .from("bakery_brands")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle();
  if (bSelErr) throw new Error(`브랜드 조회 실패: ${bSelErr.message}`);
  if (bEx) {
    brandId = bEx.id;
  } else {
    const { data: bIns, error: bInsErr } = await sb
      .from("bakery_brands")
      .insert({ name: brandName, slug: brandSlug })
      .select("id")
      .single();
    if (bInsErr) throw new Error(`브랜드 생성 실패: ${bInsErr.message}`);
    brandId = bIns.id;
  }

  const { data: lIns, error: lErr } = await sb
    .from("bakery_locations")
    .insert({
      brand_id: brandId,
      seed_key: slug,
      name: input.name,
      search_aliases: [input.name],
      slug,
      status: "active",
      road_address: input.roadAddress,
      latitude: lat as number,
      longitude: lon as number,
      region_level_1: region.region_level_1,
      region_level_2: region.region_level_2,
      region_level_3: region.region_level_3,
      phone: input.phone || null,
      published_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (lErr) {
    if (/duplicate key|unique/i.test(lErr.message)) {
      const { data: again } = await sb
        .from("bakery_locations")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (again) {
        return { saved: false, alreadyExisted: true, locationId: again.id, slug: again.slug };
      }
    }
    throw new Error(`빵집 위치 생성 실패: ${lErr.message}`);
  }

  return { saved: true, alreadyExisted: false, locationId: lIns.id, slug: lIns.slug };
}

export async function setLocationCategories(
  locationId: string,
  categorySlugs: string[],
): Promise<string[]> {
  const sb = createWorkbenchClient();
  if (!sb) throw new Error("원격 Supabase(.env.remote.local) 설정이 필요합니다.");

  const { data: cats, error: cErr } = await sb
    .from("bread_categories")
    .select("id, slug");
  if (cErr) throw new Error(`카테고리 목록 조회 실패: ${cErr.message}`);
  const slugToId = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  const idToSlug = new Map((cats ?? []).map((c) => [c.id, c.slug]));

  const want = new Set(categorySlugs.filter((s) => slugToId.has(s)));

  const { data: existing, error: eErr } = await sb
    .from("location_bread_categories")
    .select("category_id")
    .eq("location_id", locationId);
  if (eErr) throw new Error(`기존 카테고리 조회 실패: ${eErr.message}`);
  const existingSlugs = new Set(
    (existing ?? [])
      .map((r) => idToSlug.get(r.category_id))
      .filter((s): s is string => Boolean(s)),
  );

  const toAdd = [...want].filter((s) => !existingSlugs.has(s));
  const toRemove = [...existingSlugs].filter((s) => !want.has(s));

  for (const s of toAdd) {
    const { error } = await sb
      .from("location_bread_categories")
      .insert({ location_id: locationId, category_id: slugToId.get(s) as string });
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw new Error(`카테고리 추가(${s}) 실패: ${error.message}`);
    }
  }
  for (const s of toRemove) {
    const { error } = await sb
      .from("location_bread_categories")
      .delete()
      .eq("location_id", locationId)
      .eq("category_id", slugToId.get(s) as string);
    if (error) throw new Error(`카테고리 제거(${s}) 실패: ${error.message}`);
  }

  return [...want];
}

export async function setManualGrade(
  locationId: string,
  grade: string,
): Promise<{ grade: ManualGrade; checkedAt: string }> {
  const sb = createWorkbenchClient();
  if (!sb) throw new Error("원격 Supabase(.env.remote.local) 설정이 필요합니다.");
  if (!VALID_GRADES.includes(grade as ManualGrade)) {
    throw new Error("등급은 A/B/C/D 중 하나여야 합니다.");
  }
  const g = grade as ManualGrade;

  const now = new Date();
  const verifiedAt = now.toISOString();
  const nextReviewAt = new Date(
    now.getTime() + (GRADE_REVIEW_DAYS[g] ?? 30) * 86_400_000,
  ).toISOString();

  // 뺑드미와 동일 구조: 출처(sources) 1행 → 검증기록(verification_records)
  const { data: src, error: sErr } = await sb
    .from("sources")
    .insert({
      type: "other",
      publisher: "관리자 수동 등급 부여",
      retrieved_at: verifiedAt,
      status: "accessible",
    })
    .select("id")
    .single();
  if (sErr) throw new Error(`출처 생성 실패: ${sErr.message}`);

  const { error: vErr } = await sb.from("verification_records").insert({
    location_id: locationId,
    field: "business_hours",
    normalized_value: { manualGrade: g, by: "admin-workbench" },
    source_id: src.id,
    source_authority: "secondary",
    result: "confirmed",
    grade: g,
    verified_at: verifiedAt,
    next_review_at: nextReviewAt,
    note: "관리자 수동 등급 부여 (작업대)",
  });
  if (vErr) throw new Error(`검증기록 생성 실패: ${vErr.message}`);

  return { grade: g, checkedAt: verifiedAt };
}
