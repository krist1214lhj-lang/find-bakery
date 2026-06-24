// 빵집 자동화 2단계: Claude 2차 검증 (하이브리드)
// 사용법: node scripts/verify-stage2-claude.mjs
//
// 입력: output/stage1-kakao.json (1차 카카오 검증 결과)
// 판정 3축:
//   ① 카테고리 적합성 : category_name 에 제과|베이커리|빵 포함 여부
//   ② 중복           : 원격 bakery_locations 와 비교 (도로명주소 → 좌표 50m → 이름)  [읽기 전용]
//   ③ 이름 정합성     : 후보 이름 vs 카카오 상호명 (광역검색이면 N/A)
// 프랜차이즈: is_franchise=true 로 표시만 하고 통과(제외하지 않음).
// 출력: 사람이 읽는 표 + output/stage2-verified.json
//   - 명확한 규칙은 자동 판정, 애매한 건 needs_claude_review=true 로 표시(=Claude가 검토할 목록).
// 안전: DB 읽기 전용, quest_ 미사용, 키/자격증명 하드코딩 없음(.env.remote.local 에서만 읽음).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BAKERY_CATEGORY = /빵|베이커리|제과/;
const FRANCHISE =
  /파리바게|뚜레쥬|뚜레주|뜨레쥬|아티제|던킨|파리크라상|브레댄코|신라명과|뽀모도르/;
const GENERIC_NAME = /^(빵집|베이커리|제과|제과점|카페|빵)$/;
const DUP_RADIUS_M = 50;

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

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── 입력 읽기 ──────────────────────────────────────────────
let stage1;
try {
  stage1 = JSON.parse(
    readFileSync(new URL("../output/stage1-kakao.json", import.meta.url), "utf8"),
  );
} catch {
  console.error(
    "output/stage1-kakao.json 이 없습니다. 먼저 node scripts/verify-stage1-kakao.mjs 를 실행하세요.",
  );
  process.exit(1);
}

const bakeries = (stage1.results ?? []).flatMap((r) =>
  (r.matches ?? []).map((m) => ({ ...m, _candidate: r.candidate, _query: r.query })),
);
if (bakeries.length === 0) {
  console.error("1차 결과에 검증할 빵집이 없습니다.");
  process.exit(1);
}

// ── 원격 DB 연결 (읽기 전용) ───────────────────────────────
const env = loadRemoteEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https:\/\/.+\.supabase\.co/.test(url || "") || !secret) {
  console.error(".env.remote.local 의 원격 URL/secret 이 올바르지 않습니다.");
  process.exit(1);
}
const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: existing, error } = await supabase
  .from("bakery_locations")
  .select("id, name, slug, road_address, latitude, longitude");
if (error) {
  console.error(`기존 빵집 조회 실패: ${error.message}`);
  process.exit(1);
}

// ── 판정 ───────────────────────────────────────────────────
function findDuplicate(b) {
  for (const e of existing) {
    if (b.road_address && e.road_address && norm(b.road_address) === norm(e.road_address)) {
      return { found: true, existing_slug: e.slug, match_by: "road_address" };
    }
  }
  for (const e of existing) {
    if (e.latitude != null && e.longitude != null) {
      const d = haversineMeters(b.latitude, b.longitude, Number(e.latitude), Number(e.longitude));
      if (d <= DUP_RADIUS_M) {
        return { found: true, existing_slug: e.slug, match_by: `coords(${Math.round(d)}m)` };
      }
    }
  }
  for (const e of existing) {
    if (b.name && e.name && (norm(e.name).includes(norm(b.name)) || norm(b.name).includes(norm(e.name)))) {
      return { found: true, existing_slug: e.slug, match_by: "name" };
    }
  }
  return { found: false, existing_slug: null, match_by: null };
}

function checkNameConsistency(b) {
  const cand = b._candidate?.name || "";
  if (GENERIC_NAME.test(norm(cand))) return { consistent: true, note: "광역검색(N/A)" };
  const consistent = norm(b.name).includes(norm(cand)) || norm(cand).includes(norm(b.name));
  return { consistent, note: consistent ? null : `후보 '${cand}' ≠ 카카오 '${b.name}'` };
}

const verified = bakeries.map((b) => {
  const category_ok = BAKERY_CATEGORY.test(b.category || "");
  const is_franchise = FRANCHISE.test(b.name || "") || FRANCHISE.test(b.category || "");
  const duplicate = findDuplicate(b);
  const name = checkNameConsistency(b);

  const reasons = [];
  let recommendation;
  let needs_claude_review = false;

  if (duplicate.found) {
    recommendation = "제외(중복)";
    reasons.push(`이미 DB에 있음 (slug=${duplicate.existing_slug}, 근거=${duplicate.match_by})`);
  } else if (!category_ok) {
    recommendation = "제외(빵집아님)";
    reasons.push(`카테고리에 제과/베이커리/빵 없음: ${b.category}`);
  } else if (!name.consistent) {
    recommendation = "보류(사람확인)";
    needs_claude_review = true;
    reasons.push(`이름 불일치: ${name.note}`);
  } else {
    recommendation = "승인후보";
    reasons.push("신규 · 카테고리 적합 · 이름 일치");
  }
  if (is_franchise) reasons.push("프랜차이즈(표시만, 제외 안 함)");

  return {
    name: b.name,
    road_address: b.road_address,
    address: b.address,
    latitude: b.latitude,
    longitude: b.longitude,
    category: b.category,
    place_url: b.place_url,
    checks: {
      category_ok,
      is_franchise,
      duplicate,
      name_consistent: name.consistent,
    },
    recommendation,
    needs_claude_review,
    reasons,
  };
});

// ── 사람이 읽는 표 ─────────────────────────────────────────
console.log("\n=== 2차 검증 결과 ===\n");
for (const v of verified) {
  const fr = v.checks.is_franchise ? " [프랜차이즈]" : "";
  const rv = v.needs_claude_review ? "  ← Claude 검토 필요" : "";
  console.log(`• ${v.recommendation}${fr} : ${v.name}${rv}`);
  console.log(`    ${v.reasons.join(" / ")}`);
}
const tally = verified.reduce((acc, v) => {
  acc[v.recommendation] = (acc[v.recommendation] || 0) + 1;
  return acc;
}, {});
console.log("\n요약:", JSON.stringify(tally));
const reviewList = verified.filter((v) => v.needs_claude_review).map((v) => v.name);
console.log("Claude 검토 필요:", reviewList.length ? reviewList.join(", ") : "없음", "\n");

// ── JSON 출력 ──────────────────────────────────────────────
mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../output/stage2-verified.json", import.meta.url),
  JSON.stringify(
    { generated_at: new Date().toISOString(), stage: "2-claude", summary: tally, results: verified },
    null,
    2,
  ),
  "utf8",
);
console.log("JSON 저장: output/stage2-verified.json");
