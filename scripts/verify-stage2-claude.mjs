// 빵집 자동화 2단계: Claude 2차 검증 (하이브리드 — 적합성·중복·이름 판정)
// 사용법:
//   node scripts/verify-stage2-claude.mjs
//   node scripts/verify-stage2-claude.mjs path/to/stage1.json
//
// - 입력: output/stage1-kakao.json (1차 카카오 검증 통과 목록)
// - 판정: 하이브리드 — 명확한 규칙은 코드가 자동, 애매한 경계만 Claude가 검토
// - 3축: ① 카테고리 적합성 ② DB 중복(읽기 전용) ③ 이름 정합성
// - 프랜차이즈(파리바게뜨·뚜레쥬르·아티제 등)는 is_franchise=true 로 표시만, 제외하지 않음
// - 결과 3갈래: 승인후보 / 보류(사람확인) / 제외
// - 출력: 사람이 읽는 표 + output/stage2-verified.json (다음 "승인" 단계 입력용)
//
// 규칙: 키는 .env*(gitignored)/환경변수에서만 읽음(하드코딩 금지).
//      DB 는 읽기 전용(중복 조회만, 쓰기 없음). 좌표·주소는 1차 카카오 값 그대로 사용.
//      quest_ 접두사 테이블은 다루지 않음.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── 설정 ──────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-sonnet-4-6"; // ← 모델 교체 지점
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const BAKERY_CATEGORY = /제과|베이커리|빵/; // 카테고리 적합성 키워드
// 1차에서 일반 키워드로 검색한 경우(특정 후보명이 없음) → 이름 정합성은 N/A
const GENERIC_NAMES = new Set(["빵집", "베이커리", "빵", "제과", "제과점", "카페", "빵지순례", "디저트"]);
// 이름으로 직접 잡는 보수적 프랜차이즈 목록(카카오 카테고리 브랜드 토큰도 함께 사용)
const FRANCHISE_NAMES = [
  "파리바게뜨", "파리바게트", "뚜레쥬르", "뚜레주르", "아티제",
  "던킨", "파리크라상", "신라명과", "브레댄코",
];

const STRONG_DUP_M = 50;   // 좌표가 이 이내 + 이름 일치 → 강한 중복
const FUZZY_NAME_M = 500;  // 이름은 같은데 거리가 이 이내 → 모호한 중복(Claude/사람 확인)

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

function loadKey(name, files) {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  for (const f of files) {
    try {
      const text = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
        if (m) return m[1].replace(/^"(.*)"$/, "$1").trim();
      }
    } catch {
      // 파일 없으면 다음 후보로
    }
  }
  return "";
}

// ── 입력 로드 ─────────────────────────────────────────────────
function loadCandidates() {
  const argPath = process.argv[2]?.trim();
  const url = argPath
    ? new URL(argPath, `file://${process.cwd()}/`)
    : new URL("../output/stage1-kakao.json", import.meta.url);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(url, "utf8"));
  } catch (e) {
    console.error(`[stage2] 입력 파일을 읽지 못했습니다: ${url}\n  ${e.message}`);
    console.error("  먼저 1차 검증(verify-stage1-kakao.mjs)을 돌려 stage1-kakao.json 을 만드세요.");
    process.exit(1);
  }
  const candidates = [];
  for (const r of parsed.results ?? []) {
    if (r.status !== "pass") continue;
    for (const m of r.matches ?? []) {
      candidates.push({
        query: r.query,
        srcCandidate: r.candidate ?? null,
        name: m.name,
        category: m.category ?? "",
        road_address: m.road_address ?? null,
        address: m.address ?? null,
        latitude: m.latitude,
        longitude: m.longitude,
        phone: m.phone ?? null,
        place_url: m.place_url ?? null,
      });
    }
  }
  if (candidates.length === 0) {
    console.error("[stage2] 검증할 후보가 없습니다 (1차 통과 매치 0건).");
    process.exit(1);
  }
  return candidates;
}

// ── DB 조회 (읽기 전용) ───────────────────────────────────────
async function loadDbRows() {
  const url = loadKey("NEXT_PUBLIC_SUPABASE_URL", [".env.remote.local"]);
  const secretKey =
    loadKey("SUPABASE_SECRET_KEY", [".env.remote.local"]) ||
    loadKey("SUPABASE_SERVICE_ROLE_KEY", [".env.remote.local"]);

  if (!url || !secretKey) {
    console.error(
      "[stage2] .env.remote.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다 (중복 조회용, 읽기 전용).",
    );
    process.exit(1);
  }
  if (!/^https:\/\/.+\.supabase\.co/.test(url)) {
    console.error(`[stage2] 원격 https Supabase URL 이 아닙니다: ${url}`);
    process.exit(1);
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("bakery_locations")
    .select("id, name, slug, road_address, latitude, longitude, region_level_2");
  if (error) {
    console.error(`[stage2] DB 조회 실패: ${error.message}`);
    process.exit(1);
  }
  return data ?? [];
}

// ── 3축 검사 ──────────────────────────────────────────────────
function detectFranchise(cand) {
  const segs = (cand.category || "").split(">").map((s) => s.trim()).filter(Boolean);
  const last = segs[segs.length - 1] || "";
  const n = norm(cand.name);
  for (const f of FRANCHISE_NAMES) {
    if (last.includes(f) || n.includes(norm(f))) return f;
  }
  // 카카오는 체인을 카테고리 4번째 세그먼트(브랜드)로 태깅함
  // 예: 음식점 > 간식 > 제과,베이커리 > 파리바게뜨
  if (segs.length >= 4 && /제과|베이커리/.test(segs[2])) return last;
  return null;
}

function checkDup(cand, dbRows) {
  let strong = null;
  let fuzzy = null;
  for (const r of dbRows) {
    const rlat = Number(r.latitude);
    const rlon = Number(r.longitude);
    const d =
      Number.isFinite(rlat) && Number.isFinite(rlon)
        ? distanceM(cand.latitude, cand.longitude, rlat, rlon)
        : Infinity;
    const addrEq =
      r.road_address && cand.road_address && norm(r.road_address) === norm(cand.road_address);
    const nName = norm(r.name);
    const cName = norm(cand.name);
    const nameEq =
      nName && cName && (nName === cName || nName.includes(cName) || cName.includes(nName));
    const match = {
      id: r.id,
      name: r.name,
      slug: r.slug,
      road_address: r.road_address,
      distance_m: Number.isFinite(d) ? Math.round(d) : null,
    };
    const dm = match.distance_m ?? Infinity;
    if (addrEq || (d <= STRONG_DUP_M && nameEq)) {
      if (!strong || dm < (strong.distance_m ?? Infinity)) strong = match;
    } else if ((d <= STRONG_DUP_M && !nameEq) || (nameEq && d <= FUZZY_NAME_M)) {
      if (!fuzzy || dm < (fuzzy.distance_m ?? Infinity)) fuzzy = match;
    }
  }
  if (strong) return { status: "duplicate", match: strong };
  if (fuzzy) return { status: "ambiguous", match: fuzzy };
  return { status: "none", match: null };
}

function nameConsistency(cand) {
  const src = cand.srcCandidate?.name || "";
  if (!src || GENERIC_NAMES.has(src.replace(/\s+/g, ""))) return "na"; // 키워드 검색 — 특정 후보명 없음
  const a = norm(src);
  const b = norm(cand.name);
  return a === b || a.includes(b) || b.includes(a) ? "ok" : "ambiguous";
}

// ── Claude 검토 (애매한 것만, 1회 호출) ───────────────────────
async function reviewWithClaude(items, apiKey) {
  const system =
    "너는 한국 빵집 데이터 검증 보조자다. 각 후보를 승인후보 / 보류 / 제외 중 하나로 분류한다.\n" +
    "판단 기준:\n" +
    "1) 실제 빵집·베이커리인지(카테고리 적합성). 카페로 분류됐어도 빵을 주력으로 파는 베이커리카페면 승인후보 가능. 음료·디저트 위주로 빵집이라 보기 어려우면 보류.\n" +
    "2) 이름이 일관되고 신뢰할 만한지(이름 정합성).\n" +
    "3) 기존 DB 항목과 중복인지. db_near_match 가 있고 같은 가게가 확실하면 제외, 같은 건물 다른 가게 가능성 등 애매하면 보류(함부로 제외 금지).\n" +
    "프랜차이즈(파리바게뜨·뚜레쥬르·아티제 등, is_franchise=true)는 제외하지 말 것 — 실제 빵집이면 승인후보로 통과시킨다.\n" +
    "확신이 서지 않으면 보류(사람확인)로 둔다.\n" +
    '출력은 오직 JSON 배열만. 각 원소는 {"index":number,"decision":"승인후보"|"보류"|"제외","reason":"간단한 한국어 사유"}. 다른 텍스트·코드펜스 금지.';

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: JSON.stringify(items, null, 2) }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const textBlock = (data.content ?? []).find((b) => b.type === "text")?.text ?? "";
  let txt = textBlock.trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) txt = fence[1].trim();
  const arr = JSON.parse(txt);
  const byIndex = new Map();
  for (const o of arr) byIndex.set(o.index, o);
  return byIndex;
}

// ── 메인 ──────────────────────────────────────────────────────
const candidates = loadCandidates();
const dbRows = await loadDbRows();

const results = candidates.map((cand) => {
  const franchise = detectFranchise(cand);
  const categoryOk = BAKERY_CATEGORY.test(cand.category || "");
  const dup = checkDup(cand, dbRows);
  const nameAxis = nameConsistency(cand);

  const axes = {
    category: categoryOk ? "ok" : "ambiguous",
    dedup: dup.status,
    name: nameAxis,
  };

  let decision = null;
  let decidedBy = null;
  let reason = null;

  if (dup.status === "duplicate") {
    decision = "제외";
    decidedBy = "rule";
    const dm = dup.match.distance_m;
    reason = `중복(이미 DB에 있음): ${dup.match.name}${dm != null ? ` · 약 ${dm}m` : ""}`;
  } else {
    const ambiguous =
      !categoryOk || dup.status === "ambiguous" || nameAxis === "ambiguous";
    if (!ambiguous) {
      decision = "승인후보";
      decidedBy = "rule";
      reason = "카테고리 적합 + 중복 없음 + 이름 정합";
    } // 애매한 건은 아래에서 Claude/폴백 처리
  }

  return {
    ...cand,
    is_franchise: franchise != null,
    franchise_brand: franchise,
    axes,
    dup_match: dup.match,
    decision, // null 이면 Claude 검토 대상
    decided_by: decidedBy,
    reason,
  };
});

// 애매한 것 모으기
const pending = results.filter((r) => r.decision === null);

if (pending.length > 0) {
  const apiKey = loadKey("ANTHROPIC_API_KEY", [".env.local", ".env.remote.local"]);
  const items = pending.map((r, i) => ({
    index: i,
    name: r.name,
    category: r.category,
    is_franchise: r.is_franchise,
    road_address: r.road_address,
    latitude: r.latitude,
    longitude: r.longitude,
    ambiguous_flags: r.axes,
    db_near_match: r.dup_match,
  }));

  if (!apiKey) {
    for (const r of pending) {
      r.decision = "보류";
      r.decided_by = "fallback";
      r.reason = "애매(규칙으로 확정 불가) — ANTHROPIC_API_KEY 없음 → 사람확인 필요";
    }
    console.error("[stage2] ANTHROPIC_API_KEY 를 찾지 못해 애매한 건을 모두 '보류'로 처리합니다.");
  } else {
    try {
      const byIndex = await reviewWithClaude(items, apiKey);
      pending.forEach((r, i) => {
        const o = byIndex.get(i);
        if (o && ["승인후보", "보류", "제외"].includes(o.decision)) {
          r.decision = o.decision;
          r.decided_by = "claude";
          r.reason = o.reason || "(Claude 판정)";
        } else {
          r.decision = "보류";
          r.decided_by = "fallback";
          r.reason = "Claude 응답 누락/형식오류 → 사람확인 필요";
        }
      });
    } catch (e) {
      for (const r of pending) {
        r.decision = "보류";
        r.decided_by = "fallback";
        r.reason = `Claude 호출 실패(${e.message.slice(0, 80)}) → 사람확인 필요`;
      }
      console.error(`[stage2] Claude 호출 실패 → 애매한 건 '보류' 처리: ${e.message}`);
    }
  }
}

// ── 사람이 읽는 표 ────────────────────────────────────────────
const ORDER = ["승인후보", "보류", "제외"];
const ICON = { 승인후보: "✅", 보류: "🟡", 제외: "❌" };

console.log(`\n=== 2차 검증 결과 (모델: ${CLAUDE_MODEL}, DB ${dbRows.length}행 대조) ===\n`);
for (const bucket of ORDER) {
  const rows = results.filter((r) => r.decision === bucket);
  console.log(`${ICON[bucket]} ${bucket} — ${rows.length}건`);
  rows.forEach((r, i) => {
    const fr = r.is_franchise ? ` [프랜차이즈:${r.franchise_brand}]` : "";
    const via = r.decided_by === "claude" ? "Claude" : r.decided_by === "rule" ? "규칙" : "폴백";
    console.log(`   ${String(i + 1).padStart(2)}. ${r.name}${fr}  (${via})`);
    console.log(`       카테고리 : ${r.category}`);
    console.log(`       주소     : ${r.road_address || r.address}`);
    console.log(`       축       : 카테고리=${r.axes.category} · 중복=${r.axes.dedup} · 이름=${r.axes.name}`);
    console.log(`       사유     : ${r.reason}`);
  });
  console.log("");
}

const counts = ORDER.map((b) => `${b} ${results.filter((r) => r.decision === b).length}`).join(" / ");
const claudeUsed = results.filter((r) => r.decided_by === "claude").length;
console.log(`요약: ${counts} (전체 ${results.length}) · Claude 검토 ${claudeUsed}건\n`);

// ── 다음 단계용 JSON ──────────────────────────────────────────
mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
const outUrl = new URL("../output/stage2-verified.json", import.meta.url);
writeFileSync(
  outUrl,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      stage: "2-claude",
      model: CLAUDE_MODEL,
      db_rows_checked: dbRows.length,
      summary: Object.fromEntries(
        ORDER.map((b) => [b, results.filter((r) => r.decision === b).length]),
      ),
      results,
    },
    null,
    2,
  ),
  "utf8",
);
console.log("JSON 저장: output/stage2-verified.json");
