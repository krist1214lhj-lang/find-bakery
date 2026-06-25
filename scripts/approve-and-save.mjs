// 빵집 자동화 3단계: 내 승인 → DB 저장
// 사용법(플래그 3단계):
//   1) 목록(저장 안 함):      node scripts/approve-and-save.mjs
//   2) 선택+미리보기(드라이런): node scripts/approve-and-save.mjs --approve 1,3,5
//   3) 실제 저장:             node scripts/approve-and-save.mjs --approve 1,3,5 --confirm
//   (입력 파일 바꾸려면 경로를 위치 인자로: ... output/stage2-verified.json)
//
// 입력: output/stage2-verified.json 중 decision==="승인후보" 만 대상.
// 동작: 승인한 번호만, --confirm 있을 때만 저장. 그 전엔 전부 드라이런.
//
// 안전 규칙:
// - 승인 안 한 건 절대 저장 안 함. --confirm 없으면 절대 쓰기 없음.
// - 저장 직전 DB 중복 재조회(slug/seed_key/도로명주소/좌표50m+이름) → 걸리면 건너뜀.
// - 재실행 안전(idempotent): 존재하면 skip + DB 유니크 제약 백스톱.
// - 좌표·주소는 카카오값만(추측 금지). 카테고리는 이름 키워드로만 보수적 추정(불확실하면 미정).
// - 키는 .env.remote.local 에서만 읽음(하드코딩 금지). quest_ 테이블 미사용.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── 설정 ──────────────────────────────────────────────────────
const DUP_RADIUS_M = 50;

// 알려진 프랜차이즈 → 공유 브랜드 slug (ASCII). 없으면 위치별 브랜드(kakao-id)로 폴백.
const FRANCHISE_SLUG = {
  "파리바게뜨": "paris-baguette", "파리바게트": "paris-baguette",
  "뚜레쥬르": "tous-les-jours", "뚜레주르": "tous-les-jours",
  "아티제": "artisee", "던킨": "dunkin", "파리크라상": "paris-croissant",
  "신라명과": "shilla-myungkwa", "브레댄코": "bredenco",
};

// 이름 키워드 → 빵 카테고리 slug (이름에 그 단어가 실제로 있을 때만 = 보수적 추정)
const CAT_KEYWORDS = [
  { slug: "bagel", kws: ["베이글"] },
  { slug: "croissant", kws: ["크루아상", "크로와상", "크라상", "크루아쌍"] },
  { slug: "salt-bread", kws: ["소금빵"] },
  { slug: "cake", kws: ["케이크", "케익"] },
  { slug: "baked-sweets", kws: ["쿠키", "구움과자", "휘낭시에", "마들렌", "스콘"] },
  { slug: "meal-bread", kws: ["식사빵", "바게트", "치아바타", "캄파뉴"] },
];

// ── 작은 유틸 ─────────────────────────────────────────────────
const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();

function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function loadRemoteEnv() {
  const env = {};
  try {
    const text = readFileSync(new URL("../.env.remote.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim();
    }
  } catch {
    // 없으면 아래 검증에서 안내
  }
  return env;
}

// ── 인자 파싱 ─────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let approve = null;
  let confirm = false;
  let inputPath = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--confirm") confirm = true;
    else if (a === "--approve") approve = args[++i] ?? "";
    else if (a.startsWith("--approve=")) approve = a.slice("--approve=".length);
    else if (!a.startsWith("--")) inputPath = a;
  }
  return { approve, confirm, inputPath };
}

function parseSelection(spec, max) {
  // "1,3,5" 또는 "1-4,7" 지원
  const picked = new Set();
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) picked.add(n);
    } else if (/^\d+$/.test(part)) {
      picked.add(Number(part));
    } else {
      throw new Error(`승인 번호 형식 오류: "${part}" (예: 1,3,5 또는 1-4)`);
    }
  }
  const nums = [...picked].sort((a, b) => a - b);
  const bad = nums.filter((n) => n < 1 || n > max);
  if (bad.length) throw new Error(`범위를 벗어난 번호: ${bad.join(", ")} (1~${max} 중에서 선택)`);
  return nums;
}

// ── 후보 가공 ─────────────────────────────────────────────────
function kakaoIdFrom(url) {
  const m = (url || "").match(/\/(\d+)\s*$/);
  return m ? m[1] : null;
}

function parseRegion(roadAddr, lotAddr) {
  const src = (roadAddr || lotAddr || "").split(/\s+/).filter(Boolean);
  const region_level_1 = src[0] || null;
  const region_level_2 = src[1] || null;
  let region_level_3 = null;
  for (const t of (lotAddr || "").split(/\s+/).filter(Boolean)) {
    if (/[동읍면]$/.test(t) || /\d+가$/.test(t)) { region_level_3 = t; break; }
  }
  return { region_level_1, region_level_2, region_level_3 };
}

function detectCategories(name) {
  const n = norm(name);
  const found = [];
  for (const c of CAT_KEYWORDS) {
    if (c.kws.some((k) => n.includes(norm(k)))) found.push(c.slug);
  }
  return found; // 이름 기반 추정 (없으면 빈 배열 = 미정)
}

function buildPlan(cand) {
  const kakaoId = kakaoIdFrom(cand.place_url);
  const slug = kakaoId ? `kakao-${kakaoId}` : null;
  const region = parseRegion(cand.road_address, cand.address);
  const isFr = cand.is_franchise && cand.franchise_brand && FRANCHISE_SLUG[cand.franchise_brand];
  const brand = isFr
    ? { slug: FRANCHISE_SLUG[cand.franchise_brand], name: cand.franchise_brand, shared: true }
    : { slug, name: cand.name, shared: false };
  const categories = detectCategories(cand.name);

  // 저장 불가 사유(있으면 skip)
  const blockers = [];
  if (!slug) blockers.push("slug 생성 불가(place_url 없음)");
  if (!cand.road_address) blockers.push("도로명주소 없음");
  if (!Number.isFinite(cand.latitude) || !Number.isFinite(cand.longitude)) blockers.push("좌표 없음");
  if (!region.region_level_1 || !region.region_level_2) blockers.push("지역 파싱 실패");

  return { cand, kakaoId, slug, seedKey: slug, brand, region, categories, blockers };
}

// ── DB ────────────────────────────────────────────────────────
function connectDb() {
  const env = loadRemoteEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!/^https:\/\/.+\.supabase\.co/.test(url || "") || !secret) {
    console.error("[approve] .env.remote.local 의 원격 URL/secret 이 올바르지 않습니다.");
    process.exit(1);
  }
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadExisting(sb) {
  const { data, error } = await sb
    .from("bakery_locations")
    .select("id, name, slug, seed_key, road_address, latitude, longitude");
  if (error) {
    console.error(`[approve] 기존 빵집 조회 실패: ${error.message}`);
    process.exit(1);
  }
  return data ?? [];
}

function findDuplicate(plan, existing) {
  for (const e of existing) {
    if (plan.slug && e.slug === plan.slug) return { by: "slug", e };
    if (plan.seedKey && e.seed_key === plan.seedKey) return { by: "seed_key", e };
    if (e.road_address && plan.cand.road_address && norm(e.road_address) === norm(plan.cand.road_address))
      return { by: "road_address", e };
    const elat = Number(e.latitude), elon = Number(e.longitude);
    if (Number.isFinite(elat) && Number.isFinite(elon)) {
      const d = distanceM(plan.cand.latitude, plan.cand.longitude, elat, elon);
      const nameEq = norm(e.name).includes(norm(plan.cand.name)) || norm(plan.cand.name).includes(norm(e.name));
      if (d <= DUP_RADIUS_M && nameEq) return { by: `좌표 ${Math.round(d)}m+이름`, e };
    }
  }
  return null;
}

// ── 메인 ──────────────────────────────────────────────────────
const { approve, confirm, inputPath } = parseArgs();

const inUrl = inputPath
  ? new URL(inputPath, `file://${process.cwd()}/`)
  : new URL("../output/stage2-verified.json", import.meta.url);
let stage2;
try {
  stage2 = JSON.parse(readFileSync(inUrl, "utf8"));
} catch (e) {
  console.error(`[approve] 입력을 읽지 못했습니다: ${inUrl}\n  ${e.message}`);
  process.exit(1);
}

const candidates = (stage2.results ?? []).filter((r) => r.decision === "승인후보");
if (candidates.length === 0) {
  console.error("[approve] 승인후보가 없습니다.");
  process.exit(1);
}
const plans = candidates.map(buildPlan);

// ── 모드 A: 목록 (저장 안 함) ─────────────────────────────────
if (!approve) {
  console.log(`\n=== 승인 대상(승인후보) ${plans.length}건 — 저장 안 함 ===\n`);
  plans.forEach((p, i) => {
    const fr = p.cand.is_franchise
      ? `예 (${p.cand.franchise_brand})${p.brand.shared ? " · 공유 브랜드" : " · 위치별 브랜드(매핑 없음)"}`
      : "아니오";
    const cats = p.categories.length ? `(추정) ${p.categories.join(", ")}` : "미정";
    const block = p.blockers.length ? `  ⚠️ 저장불가: ${p.blockers.join("; ")}` : "";
    console.log(`${String(i + 1).padStart(2)}. ${p.cand.name}${block}`);
    console.log(`     주소     : ${p.cand.road_address || p.cand.address}`);
    console.log(`     카테고리 : ${p.cand.category}`);
    console.log(`     프랜차이즈: ${fr}`);
    console.log(`     빵카테고리: ${cats}`);
    console.log(`     생성 slug: ${p.slug || "(불가)"}`);
  });
  console.log(`\n다음 단계: node scripts/approve-and-save.mjs --approve 1,3,5   (선택 후 미리보기)`);
  console.log(`         그 다음:  ... --approve 1,3,5 --confirm            (실제 저장)\n`);
  process.exit(0);
}

// ── 모드 B/C: 선택 ────────────────────────────────────────────
let picks;
try {
  picks = parseSelection(approve, plans.length);
} catch (e) {
  console.error(`[approve] ${e.message}`);
  process.exit(1);
}
const selected = picks.map((n) => plans[n - 1]);

// 저장 직전 DB 중복 재조회 (읽기 전용)
const sb = connectDb();
const existing = await loadExisting(sb);

const decided = selected.map((p) => {
  if (p.blockers.length) return { p, action: "skip", reason: p.blockers.join("; ") };
  const dup = findDuplicate(p, existing);
  if (dup) return { p, action: "skip", reason: `중복(${dup.by}: ${dup.e.name})` };
  return { p, action: "save", reason: null };
});

const toSave = decided.filter((d) => d.action === "save");
const toSkip = decided.filter((d) => d.action === "skip");

// 최종 미리보기 (B/C 공통)
console.log(`\n=== 저장 ${confirm ? "실행" : "미리보기(드라이런)"} — 선택 ${selected.length}건 ===\n`);
for (const d of decided) {
  const p = d.p;
  const mark = d.action === "save" ? "💾 저장" : "⏭️  건너뜀";
  const cats = p.categories.length ? `(추정) ${p.categories.join(", ")}` : "미정";
  const brandNote = p.brand.shared
    ? " · 프랜차이즈 공유 브랜드"
    : p.cand.is_franchise
      ? " · 체인이지만 매핑 없어 위치별 브랜드로 저장"
      : "";
  console.log(`${mark}  ${p.cand.name}`);
  console.log(`   brand    : ${p.brand.name} (slug=${p.brand.slug}${brandNote})`);
  console.log(`   location : slug=${p.slug}, status=active(즉시 노출), seed_key=${p.seedKey}`);
  console.log(`   지역     : ${[p.region.region_level_1, p.region.region_level_2, p.region.region_level_3].filter(Boolean).join(" / ")}`);
  console.log(`   좌표     : ${p.cand.latitude}, ${p.cand.longitude} (카카오값)`);
  console.log(`   전화     : ${p.cand.phone || "(없음)"}`);
  console.log(`   빵카테고리: ${cats}`);
  if (d.action === "skip") console.log(`   사유     : ${d.reason}`);
  console.log("");
}
console.log(`요약: 저장예정 ${toSave.length} / 건너뜀 ${toSkip.length} (선택 ${selected.length})`);

// 주의: DB 연결(connectDb) 이후에는 process.exit() 를 쓰지 않는다.
// (Windows libuv assertion 회피 — supabase 클라이언트 핸들이 열린 채 강제 종료하면 크래시)
// 드라이런이면 안내만, --confirm 이면 저장. 둘 다 자연 종료한다.
if (!confirm) {
  console.log(`\n드라이런입니다. 실제 저장하려면 동일 명령에 --confirm 을 추가하세요:`);
  console.log(`  node scripts/approve-and-save.mjs --approve ${approve} --confirm\n`);
} else if (toSave.length === 0) {
  console.log("\n저장할 항목이 없습니다(전부 건너뜀). 종료.\n");
} else {
  // ── 실제 저장 (--confirm) ───────────────────────────────────
  const report = { saved: [], skipped: toSkip.map((d) => ({ name: d.p.cand.name, reason: d.reason })), failed: [] };

  // 카테고리 slug → id 캐시
  const { data: catRows, error: catErr } = await sb.from("bread_categories").select("id, slug");
  const catId = new Map((catRows ?? []).map((c) => [c.slug, c.id]));
  if (catErr) console.error(`[approve] 카테고리 조회 실패(카테고리 연결은 건너뜀): ${catErr.message}`);

  for (const d of toSave) {
    const p = d.p;
    try {
      // 1) 브랜드 find-or-create
      let brandId;
      const { data: bExist, error: bSelErr } = await sb
        .from("bakery_brands").select("id").eq("slug", p.brand.slug).maybeSingle();
      if (bSelErr) throw new Error(`브랜드 조회: ${bSelErr.message}`);
      if (bExist) {
        brandId = bExist.id;
      } else {
        const { data: bIns, error: bInsErr } = await sb
          .from("bakery_brands")
          .insert({ name: p.brand.name, slug: p.brand.slug })
          .select("id").single();
        if (bInsErr) throw new Error(`브랜드 생성: ${bInsErr.message}`);
        brandId = bIns.id;
      }

      // 2) 위치 insert (존재하면 백스톱으로 skip)
      const { data: lIns, error: lInsErr } = await sb
        .from("bakery_locations")
        .insert({
          brand_id: brandId,
          seed_key: p.seedKey,
          name: p.cand.name,
          search_aliases: [p.cand.name],
          slug: p.slug,
          status: "active",
          road_address: p.cand.road_address,
          latitude: p.cand.latitude,
          longitude: p.cand.longitude,
          region_level_1: p.region.region_level_1,
          region_level_2: p.region.region_level_2,
          region_level_3: p.region.region_level_3,
          phone: p.cand.phone || null,
          published_at: new Date().toISOString(),
        })
        .select("id").single();
      if (lInsErr) {
        if (/duplicate key|unique/i.test(lInsErr.message)) {
          report.skipped.push({ name: p.cand.name, reason: `이미 존재(유니크 제약)` });
          continue;
        }
        throw new Error(`위치 생성: ${lInsErr.message}`);
      }

      // 3) 카테고리 연결 (추정된 것만, 중복 무시)
      const linked = [];
      for (const slug of p.categories) {
        const cid = catId.get(slug);
        if (!cid) continue;
        const { error: cInsErr } = await sb
          .from("location_bread_categories")
          .upsert({ location_id: lIns.id, category_id: cid }, { onConflict: "location_id,category_id", ignoreDuplicates: true });
        if (cInsErr) throw new Error(`카테고리 연결(${slug}): ${cInsErr.message}`);
        linked.push(slug);
      }

      report.saved.push({ name: p.cand.name, slug: p.slug, categories: linked });
    } catch (e) {
      report.failed.push({ name: p.cand.name, error: e.message });
    }
  }

  // ── 결과 리포트 ─────────────────────────────────────────────
  console.log(`\n=== 저장 결과 ===`);
  console.log(`✅ 저장: ${report.saved.length}건`);
  for (const s of report.saved) {
    console.log(`   - ${s.name} (slug=${s.slug}) 카테고리: ${s.categories.length ? s.categories.join(", ") : "미정"}`);
  }
  console.log(`⏭️  건너뜀: ${report.skipped.length}건`);
  for (const s of report.skipped) console.log(`   - ${s.name} — ${s.reason}`);
  console.log(`❌ 실패: ${report.failed.length}건`);
  for (const f of report.failed) console.log(`   - ${f.name} — ${f.error}`);
  console.log("");
}
