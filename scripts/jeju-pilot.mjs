// 제주 빵집 검증 파일럿 (원격 라이브 DB)
// 모드:
//   node scripts/jeju-pilot.mjs                      # 1단계: 제주 draft 목록 추출(읽기) → output/jeju-draft.json
//   node scripts/jeju-pilot.mjs --verify             # 4단계: 후보(output/jeju-candidates.json) 정밀검증(유료) → output/jeju-verify.json
//
// 규칙:
// - 자격증명은 .env.remote.local(DB) / .env.local·.env.remote.local(ANTHROPIC_API_KEY)에서만 읽음.
// - 등급/카테고리는 웹 근거 있는 것만(applySafety: 출처 0 → 보류). 동명 다른 가게 방지(주소 대조).
// - 좌표·주소는 카카오값만. quest_ 미사용. DB 쓰기 없음(검증은 판정만).
// - 검증 로직은 lib/verification-research-core.ts 와 동일(프롬프트·등급기준·파싱·비용계산 포팅).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── 공통: 원격 DB ─────────────────────────────────────────────
function loadRemoteEnv() {
  const env = {};
  const text = readFileSync(new URL("../.env.remote.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim();
  }
  return env;
}
const env = loadRemoteEnv();
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY || !/^https:\/\/.+\.supabase\.co/.test(SB_URL)) {
  console.error("[jeju-pilot] .env.remote.local 의 원격 URL/SECRET 키를 확인하세요.");
  process.exit(1);
}
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

async function fetchAllLocations(columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("bakery_locations").select(columns).range(from, from + 999);
    if (error) throw new Error(`bakery_locations 읽기 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// ── 지역 파라미터(재사용) ─────────────────────────────────────
// --areas "연남동,성수동,..." 로 지역 지정, --prefix 로 출력 파일 접두어.
// 미지정 시 기본 = 제주(하위호환), prefix=jeju.
function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const PREFIX = getArg("--prefix") || "jeju";
const REGION2 = getArg("--region2"); // 선택: 단일 구/시 제약(예: 강남구) — 동명 도로명 false-positive 방지
// 다구역 선택자: "시도:구,시도:구" (시도는 부분일치, 구는 정확일치). 예) "부산:해운대구,대구:중구"
// → 별칭(서면·동성로·한옥마을)이 주소에 없을 때 구(region_level_2) 단위로 정확 선별. 중구 동명 구분 위해 시도 지정.
const DISTRICTS = (getArg("--districts") || "").split(",").map((s) => s.trim()).filter(Boolean)
  .map((s) => { const [a, b] = s.split(":"); return b ? { r1: a, r2: b } : { r1: null, r2: a }; });
const AREAS = (getArg("--areas") || "").split(",").map((s) => s.trim()).filter(Boolean);
const AREA_KEYS = AREAS.map((a) => a.replace(/(동|읍|면|리)$/, "")); // 어간(예: 연남동→연남)
function matchArea(l) {
  if (REGION2 && (l.region_level_2 || "") !== REGION2) return false; // 단일 구/시 한정
  if (DISTRICTS.length > 0) {
    return DISTRICTS.some((d) =>
      (!d.r1 || (l.region_level_1 || "").includes(d.r1)) && (l.region_level_2 || "") === d.r2);
  }
  if (AREA_KEYS.length === 0) {
    return /제주/.test(l.region_level_1 || "") || /제주/.test(l.road_address || "");
  }
  const hay = `${l.region_level_3 || ""} ${l.road_address || ""}`;
  return AREA_KEYS.some((k) => hay.includes(k));
}
const AREA_LABEL = AREAS.length ? AREAS.join("·") : DISTRICTS.length ? DISTRICTS.map((d) => d.r2).join("·") : "제주";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1단계: 제주 draft 목록 ────────────────────────────────────
async function runList() {
  const locs = await fetchAllLocations(
    "id,slug,name,status,road_address,region_level_1,region_level_2,region_level_3",
  );
  const draft = locs
    .filter((l) => matchArea(l) && l.status === "draft")
    .sort((a, b) => (a.region_level_3 || a.region_level_2 || "").localeCompare(b.region_level_3 || b.region_level_2 || ""));
  const all = locs.filter(matchArea);
  console.log(`\n=== ${AREA_LABEL} 빵집 현황 ===`);
  console.log(`대상 전체: ${all.length} | 공개(비draft): ${all.length - draft.length} | draft(숨김): ${draft.length}\n`);
  draft.forEach((l, i) => {
    const region = [l.region_level_2, l.region_level_3].filter(Boolean).join(" ");
    console.log(`${String(i + 1).padStart(3)}. ${l.name}  [${region}]\n     ${l.road_address || "(주소 없음)"}  · ${l.slug}`);
  });
  mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
  const rows = draft.map((l) => ({
    slug: l.slug, name: l.name, road_address: l.road_address,
    region_level_1: l.region_level_1, region_level_2: l.region_level_2, region_level_3: l.region_level_3,
  }));
  writeFileSync(new URL(`../output/${PREFIX}-draft.json`, import.meta.url),
    JSON.stringify({ generated_at: new Date().toISOString(), areas: AREAS, count: rows.length, rows }, null, 2), "utf8");
  console.log(`\nJSON 저장: output/${PREFIX}-draft.json (${rows.length}곳)`);
}

// ── 4단계: 정밀검증 (lib/verification-research-core.ts 포팅) ───
const VERIFY_MODEL = "claude-haiku-4-5";
const MAX_SEARCHES = 2;
const MAX_TOKENS = 1500;
const PRICING = { "claude-haiku-4-5": { input: 1, output: 5 }, "claude-sonnet-4-6": { input: 3, output: 15 } };
const WEB_SEARCH_USD = 0.01;
const USD_TO_KRW = 1450;
const CATEGORY_SLUGS = ["salt-bread", "bagel", "baked-sweets", "meal-bread", "cake", "croissant"];
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `당신은 한국 빵집 정보의 신뢰도 검증 담당입니다. 주어진 빵집이 "실재하고 사람들이 언급하는 빵집"인지 한국어 웹(네이버 블로그, 뉴스, 맛집/푸드 매체)에서 검색해 교차확인하고 신뢰등급을 제안합니다.

규칙:
- 같은 이름의 다른 지점·동명 업체와 혼동하지 마세요. 반드시 같은 "구/동·도로명주소"의 그 가게인지 확인하세요.
- 추측 금지. 근거(출처)를 못 찾으면 등급을 제안하지 말고 proposedGrade를 null 로 두세요.
- 등급 기준:
  - "A": 공식 출처(공식 홈페이지/공식 SNS) 또는 공신력 있는 매체·방송에서 확인.
  - "B": 서로 독립적인 출처 2곳 이상(블로그·뉴스 등)에서 교차확인.
  - "C": 약한 단서 1곳만 확인.
  - null: 근거 없음/불확실/동일 가게 확신 불가.
- 웹검색은 최대 ${MAX_SEARCHES}회만 사용하세요.

추가로, **같은 검색 결과만으로(추가 검색 금지)** 이 빵집의 "대표 메뉴/유명한 빵"에 해당하는 빵 카테고리를 제안하세요.
- 카테고리 slug: salt-bread(소금빵), bagel(베이글), baked-sweets(구움과자), meal-bread(식사빵), cake(케이크), croissant(크루아상).
- 블로그·맛집DB 후기/대표메뉴에 **실제 근거가 있는 카테고리만** 넣으세요. 가게 이름만 보고 추측하지 마세요. 근거 없으면 빈 배열([]).
- 각 카테고리에는 한국어 근거(evidence) 1문장(어느 출처에서 무엇으로 언급됐는지)을 넣으세요.

반드시 마지막에 아래 JSON만 코드블록으로 출력하세요(설명은 그 앞에):
\`\`\`json
{"proposedGrade":"A|B|C|null","confidence":"high|medium|low","rationale":"한국어 2~3문장 근거","sources":[{"title":"제목","url":"https://...","summary":"한줄 요약","kind":"official|news|blog|other"}],"categories":[{"slug":"salt-bread","evidence":"○○블로그에서 소금빵 맛집으로 언급"}]}
\`\`\``;

function loadAnthropicKey() {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  for (const f of [".env.local", ".env.remote.local"]) {
    try {
      const text = readFileSync(path.join(process.cwd(), f), "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*#/.test(line)) continue;
        const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);
        if (m) return m[1].replace(/^"(.*)"$/, "$1").trim();
      }
    } catch { /* 다음 후보 */ }
  }
  return "";
}

function buildUserPrompt(input) {
  return [
    "다음 빵집을 검증해 주세요.",
    `이름: ${input.name}`,
    input.region ? `지역: ${input.region}` : null,
    input.roadAddress ? `도로명주소: ${input.roadAddress}` : null,
  ].filter(Boolean).join("\n");
}

function extractLastJsonObject(text) {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const body = fences[i][1].trim();
    if (body.startsWith("{")) return body;
  }
  const end = text.lastIndexOf("}");
  if (end === -1) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    if (text[i] === "}") depth++;
    else if (text[i] === "{") { depth--; if (depth === 0) return text.slice(i, end + 1); }
  }
  return null;
}
const clampGrade = (v) => (v === "A" || v === "B" || v === "C" ? v : null);
const clampConfidence = (v) => (v === "high" || v === "low" ? v : "medium");
function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  const out = [], seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const kind = raw.kind === "official" || raw.kind === "news" || raw.kind === "blog" ? raw.kind : "other";
    out.push({ title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : url, url,
      summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : undefined, kind });
    if (out.length >= 5) break;
  }
  return out;
}
function normalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  const valid = new Set(CATEGORY_SLUGS), out = [], seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
    const evidence = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
    if (!valid.has(slug) || !evidence || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, evidence });
    if (out.length >= CATEGORY_SLUGS.length) break;
  }
  return out;
}
function applySafety(v) {
  if (v.sources.length === 0) return { ...v, categories: [], proposedGrade: null, confidence: "low",
    rationale: v.proposedGrade !== null ? v.rationale + " (출처를 제시하지 못해 등급 제안을 보류합니다.)" : v.rationale };
  return v;
}
function parseVerdict(text) {
  const json = extractLastJsonObject(text);
  let p = {};
  if (json) { try { p = JSON.parse(json); } catch { p = {}; } }
  return applySafety({
    proposedGrade: clampGrade(p.proposedGrade),
    confidence: clampConfidence(p.confidence),
    rationale: typeof p.rationale === "string" && p.rationale.trim() ? p.rationale.trim() : "근거를 충분히 확인하지 못했습니다.",
    sources: normalizeSources(p.sources),
    categories: normalizeCategories(p.categories),
  });
}
function collectFromResponse(data) {
  let text = ""; const realSources = [], seen = new Set();
  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) text += block.text + "\n";
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
          seen.add(r.url); realSources.push({ title: r.title ?? r.url, url: r.url, kind: "other" });
        }
      }
    }
  }
  const usage = data.usage ?? {};
  const stu = usage.server_tool_use ?? {};
  return { text, realSources, usage: {
    inputTokens: Number(usage.input_tokens ?? 0), outputTokens: Number(usage.output_tokens ?? 0),
    cacheReadTokens: Number(usage.cache_read_input_tokens ?? 0), cacheCreationTokens: Number(usage.cache_creation_input_tokens ?? 0),
  }, searchCount: Number(stu.web_search_requests ?? 0) };
}
function computeCostKrw(usage, searchCount, model) {
  const p = PRICING[model] ?? PRICING["claude-haiku-4-5"];
  const inputAll = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
  const usd = (inputAll / 1e6) * p.input + (usage.outputTokens / 1e6) * p.output + Math.max(0, searchCount) * WEB_SEARCH_USD;
  return Math.round(usd * USD_TO_KRW);
}

async function researchBakeryGrade(input, apiKey) {
  const body = {
    model: VERIFY_MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES, user_location: { type: "approximate", country: "KR" } }],
  };
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude HTTP ${res.status}${t ? `: ${t.slice(0, 160)}` : ""}`);
  }
  const data = await res.json();
  const c = collectFromResponse(data);
  const verdict = parseVerdict(c.text);
  const sources = verdict.sources.length > 0 ? verdict.sources : c.realSources.slice(0, 3);
  const fv = applySafety({ ...verdict, sources });
  return { ...fv, model: VERIFY_MODEL, searchCount: c.searchCount,
    usage: { inputTokens: c.usage.inputTokens, outputTokens: c.usage.outputTokens },
    costKrw: computeCostKrw(c.usage, c.searchCount, VERIFY_MODEL) };
}

async function runVerify() {
  const apiKey = loadAnthropicKey();
  if (!apiKey) { console.error("[jeju-pilot] ANTHROPIC_API_KEY 가 없습니다(.env.local 등)."); process.exit(1); }
  const cand = JSON.parse(readFileSync(new URL(`../output/${PREFIX}-candidates.json`, import.meta.url), "utf8"));
  const slugs = cand.slugs || [];
  const locs = await fetchAllLocations("slug,name,road_address,region_level_1,region_level_2,status");
  const bySlug = new Map(locs.map((l) => [l.slug, l]));

  console.log(`\n=== ${AREA_LABEL} 후보 정밀검증 (${slugs.length}곳, 모델 ${VERIFY_MODEL}, 검색 최대 ${MAX_SEARCHES}회/곳) ===\n`);
  const results = [];
  let totalCost = 0;
  for (let i = 0; i < slugs.length; i++) {
    const loc = bySlug.get(slugs[i]);
    if (!loc) { console.log(`${i + 1}. [${slugs[i]}] DB에 없음 — 건너뜀`); continue; }
    process.stdout.write(`${String(i + 1).padStart(2)}. ${loc.name} … `);
    try {
      const r = await researchBakeryGrade(
        { name: loc.name, region: [loc.region_level_1, loc.region_level_2].filter(Boolean).join(" "), roadAddress: loc.road_address },
        apiKey,
      );
      totalCost += r.costKrw;
      const cats = r.categories.map((c) => c.slug).join(",") || "(없음)";
      console.log(`등급 ${r.proposedGrade ?? "보류"} · 카테고리 [${cats}] · 검색 ${r.searchCount}회 · ${r.costKrw}원`);
      results.push({ slug: loc.slug, name: loc.name, road_address: loc.road_address,
        region: [loc.region_level_1, loc.region_level_2].filter(Boolean).join(" "), status: loc.status, ...r });
    } catch (e) {
      console.log(`오류: ${e.message}`);
      results.push({ slug: loc.slug, name: loc.name, error: e.message });
    }
    await sleep(800);
  }

  mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../output/${PREFIX}-verify.json`, import.meta.url),
    JSON.stringify({ generated_at: new Date().toISOString(), model: VERIFY_MODEL, total_cost_krw: totalCost, results }, null, 2), "utf8");

  console.log(`\n총 실측 비용: 약 ${totalCost}원 / ${results.length}곳`);
  console.log(`JSON 저장: output/${PREFIX}-verify.json (저장 단계 입력용, DB 쓰기 없음)`);
}

// ── 5단계: 저장 (A·B + 카테고리 → status=active + 카테고리 + 등급기록) ──
const GRADE_REVIEW_DAYS = { A: 30, B: 90, C: 60, D: 30 };

async function runSave() {
  const CONFIRM = process.argv.includes("--confirm");
  const verify = JSON.parse(readFileSync(new URL(`../output/${PREFIX}-verify.json`, import.meta.url), "utf8"));
  // 저장 대상: 등급 A/B + 카테고리 근거 있는 것만. (보류/C/null 제외)
  const targets = (verify.results || []).filter(
    (r) => (r.proposedGrade === "A" || r.proposedGrade === "B") && (r.categories?.length ?? 0) > 0,
  );

  const locs = await fetchAllLocations("id,slug,name,status,published_at,road_address,region_level_2");
  const bySlug = new Map(locs.map((l) => [l.slug, l]));
  const { data: cats, error: cErr } = await sb.from("bread_categories").select("id,slug");
  if (cErr) { console.error(`bread_categories 조회 실패: ${cErr.message}`); process.exit(1); }
  const slugToId = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  console.log(`\n=== 5단계 저장 대상 (A·B + 카테고리): ${targets.length}곳 ===\n`);
  const plan = [];
  for (const t of targets) {
    const loc = bySlug.get(t.slug);
    if (!loc) { console.log(`  ⚠️ [${t.slug}] DB에 없음 — 건너뜀`); continue; }
    const catSlugs = t.categories.map((c) => c.slug).filter((s) => slugToId.has(s));
    plan.push({ loc, grade: t.proposedGrade, catSlugs, verdict: t });
    console.log(`  ${loc.name} [${loc.region_level_2}] · 현재 ${loc.status} → active · 등급 ${t.proposedGrade} · 카테고리 [${catSlugs.join(",")}]`);
  }

  if (!CONFIRM) {
    console.log(`\n드라이런(쓰기 없음). 실제 저장: node scripts/jeju-pilot.mjs --save --confirm`);
    return;
  }

  // 백업(변경 직전 status/published_at)
  mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `output/${PREFIX}-save-backup-${stamp}.json`;
  writeFileSync(new URL(`../${backupPath}`, import.meta.url),
    JSON.stringify({ generated_at: new Date().toISOString(),
      rows: plan.map((p) => ({ slug: p.loc.slug, name: p.loc.name, status: p.loc.status, published_at: p.loc.published_at })) }, null, 2), "utf8");
  console.log(`\n💾 백업 저장: ${backupPath}\n`);

  let okStatus = 0, okCat = 0, okGrade = 0, skipGrade = 0, fail = 0;
  for (const p of plan) {
    const { loc, grade, catSlugs, verdict } = p;
    try {
      // 1) 공개 전환 (published_at 보존; 혹시 null이면 now로 보강해 제약 충족)
      if (loc.status !== "active") {
        const pub = loc.published_at ?? new Date().toISOString();
        const { error } = await sb.from("bakery_locations").update({ status: "active", published_at: pub }).eq("id", loc.id);
        if (error) throw new Error(`status 변경 실패: ${error.message}`);
      }
      okStatus++;

      // 2) 카테고리 추가 (기존 연결만큼만, 멱등)
      const { data: existing } = await sb.from("location_bread_categories").select("category_id").eq("location_id", loc.id);
      const existingIds = new Set((existing ?? []).map((r) => r.category_id));
      for (const s of catSlugs) {
        const cid = slugToId.get(s);
        if (!cid || existingIds.has(cid)) continue;
        const { error } = await sb.from("location_bread_categories").insert({ location_id: loc.id, category_id: cid });
        if (error && !/duplicate key|unique/i.test(error.message)) throw new Error(`카테고리(${s}) 실패: ${error.message}`);
      }
      okCat++;

      // 3) 등급 기록 (멱등: 이미 등급 기록 있으면 skip) — 뺑드미/작업대와 동일 구조
      const { data: vrows } = await sb.from("verification_records").select("id,grade").eq("location_id", loc.id).not("grade", "is", null).limit(1);
      if ((vrows ?? []).length > 0) { skipGrade++; }
      else {
        const verifiedAt = new Date().toISOString();
        const nextReviewAt = new Date(Date.now() + (GRADE_REVIEW_DAYS[grade] ?? 30) * 86400000).toISOString();
        const topUrl = (verdict.sources ?? []).find((s) => s.url)?.url?.trim() || null;
        const { data: src, error: sErr } = await sb.from("sources").insert({
          type: "other", publisher: "정밀 검증 (웹검색)", url: topUrl, retrieved_at: verifiedAt, status: "accessible",
        }).select("id").single();
        if (sErr) throw new Error(`출처 생성 실패: ${sErr.message}`);
        const { error: vErr } = await sb.from("verification_records").insert({
          location_id: loc.id, field: "business_hours",
          normalized_value: {
            autoGrade: grade, by: "jeju-pilot-research", confidence: verdict.confidence ?? null,
            rationale: (verdict.rationale ?? "").trim() || null,
            sources: (verdict.sources ?? []).filter((s) => s.url).slice(0, 5).map((s) => ({ title: s.title ?? null, url: s.url, kind: s.kind ?? null })),
            categories: (verdict.categories ?? []).map((c) => ({ slug: c.slug, evidence: c.evidence })),
          },
          source_id: src.id, source_authority: grade === "A" ? "official" : "secondary",
          result: "confirmed", grade, verified_at: verifiedAt, next_review_at: nextReviewAt,
          note: `제주 파일럿 정밀검증(웹) 등급 — ${(verdict.rationale ?? "교차확인").slice(0, 160)}`,
        });
        if (vErr) throw new Error(`검증기록 생성 실패: ${vErr.message}`);
        okGrade++;
      }
      console.log(`  ✅ ${loc.name} — active · 카테고리 ${catSlugs.length} · 등급 ${grade}${(vrows ?? []).length > 0 ? "(기존 등급 유지)" : ""}`);
    } catch (e) {
      fail++;
      console.log(`  ❌ ${loc.name} — ${e.message}`);
    }
  }
  console.log(`\n요약: 공개전환 ${okStatus} · 카테고리 ${okCat} · 등급기록 ${okGrade}(기존유지 ${skipGrade}) · 실패 ${fail}`);
}

// ── 디스패치 ──────────────────────────────────────────────────
const mode = process.argv.includes("--verify")
  ? "verify"
  : process.argv.includes("--save")
    ? "save"
    : "list";
if (mode === "verify") await runVerify();
else if (mode === "save") await runSave();
else await runList();
