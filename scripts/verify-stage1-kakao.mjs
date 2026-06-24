// 빵집 자동화 1단계: 카카오 1차 검증 (존재 여부 + 주소·좌표·카테고리)
// 사용법:
//   node scripts/verify-stage1-kakao.mjs
//   node scripts/verify-stage1-kakao.mjs '[{"name":"성심당","area":"대전"},{"name":"이성당","area":"군산"}]'
//
// - 카카오 키워드 검색 API 사용 (KAKAO_REST_API_KEY 를 .env.local/환경변수에서만 읽음).
// - 좌표는 카카오 반환값(x=경도, y=위도)만 사용. 추측 없음.
// - DB 저장 없음. 사람이 읽는 표 + 다음 단계용 JSON 파일(output/stage1-kakao.json) 출력.
// - quest_ 테이블은 다루지 않음.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const BAKERY_CATEGORY = /빵|베이커리|제과|카페/;

// 기본 테스트 후보 (CLI JSON 인자로 교체 가능)
const DEFAULT_CANDIDATES = [{ name: "빵집", area: "광진구" }];

function loadKakaoRestKey() {
  const fromEnv = process.env.KAKAO_REST_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*KAKAO_REST_API_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].trim();
    }
  } catch {
    // .env.local 없으면 환경변수에 의존
  }
  return "";
}

function parseCandidates() {
  const arg = process.argv.slice(2).join(" ").trim();
  if (!arg) return DEFAULT_CANDIDATES;
  try {
    const parsed = JSON.parse(arg);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    console.error("입력 배열이 비어 있습니다.");
    process.exit(1);
  } catch {
    console.error(
      '입력 JSON 파싱 실패. 예: \'[{"name":"성심당","area":"대전"}]\'',
    );
    process.exit(1);
  }
}

const apiKey = loadKakaoRestKey();
if (!apiKey) {
  console.error("KAKAO_REST_API_KEY 를 찾지 못했습니다 (.env.local 또는 환경변수).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchKeyword(query) {
  const url = new URL(KAKAO_KEYWORD_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("size", "15");
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  if (!res.ok) throw new Error(`카카오 API HTTP ${res.status}`);
  const data = await res.json();
  return data.documents ?? [];
}

function toMatch(doc) {
  return {
    name: doc.place_name,
    category: doc.category_name,
    road_address: doc.road_address_name || null,
    address: doc.address_name || null,
    latitude: Number(doc.y),
    longitude: Number(doc.x),
    phone: doc.phone || null,
    place_url: doc.place_url || null,
  };
}

const candidates = parseCandidates();
const results = [];

for (const c of candidates) {
  const query = [c.area, c.name].filter(Boolean).join(" ").trim();
  let matches = [];
  let error = null;
  try {
    matches = (await searchKeyword(query)).map(toMatch);
  } catch (e) {
    error = e.message;
  }
  results.push({
    candidate: c,
    query,
    status: error ? "error" : matches.length > 0 ? "pass" : "fail",
    error,
    match_count: matches.length,
    matches,
  });
  await sleep(200);
}

// ── 사람이 읽는 표 ─────────────────────────────────────────────
console.log("\n=== 1차 카카오 검증 결과 ===\n");
for (const r of results) {
  const tag = r.status === "pass" ? "통과" : r.status === "fail" ? "탈락" : "오류";
  console.log(`[${tag}] "${r.query}" — ${r.match_count}건`);
  if (r.error) console.log(`   오류: ${r.error}`);
  r.matches.forEach((m, i) => {
    const warn = BAKERY_CATEGORY.test(m.category || "")
      ? ""
      : "   ⚠️ 카테고리 확인 필요";
    console.log(`   ${String(i + 1).padStart(2)}. ${m.name}${warn}`);
    console.log(`       카테고리 : ${m.category}`);
    console.log(`       주소     : ${m.road_address || m.address}`);
    console.log(`       좌표     : 위도 ${m.latitude}, 경도 ${m.longitude}`);
    console.log(`       place_url: ${m.place_url}`);
  });
  console.log("");
}
const passCount = results.filter((r) => r.status === "pass").length;
console.log(`요약: 통과 ${passCount} / 전체 ${results.length}\n`);

// ── 다음 단계용 JSON ──────────────────────────────────────────
mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
const outUrl = new URL("../output/stage1-kakao.json", import.meta.url);
writeFileSync(
  outUrl,
  JSON.stringify(
    { generated_at: new Date().toISOString(), stage: "1-kakao", results },
    null,
    2,
  ),
  "utf8",
);
console.log("JSON 저장: output/stage1-kakao.json");
