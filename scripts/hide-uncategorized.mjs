// 카테고리 미연결 빵집 숨김 스크립트 (bakery_locations)
// 사용법:
//   1) 드라이런(쓰기 없음, 목록 미리보기):  node scripts/hide-uncategorized.mjs
//   2) 실제 숨김(백업 후 status='draft'):    node scripts/hide-uncategorized.mjs --confirm
//   3) 되돌리기(백업 JSON으로 원복):         node scripts/hide-uncategorized.mjs --restore output/hide-backup-<...>.json
//
// 규칙(이 프로젝트):
// - 숨김 대상 = location_bread_categories 에 연결이 0개인 location 중 현재 draft 가 아닌 것.
//   ('hidden' 은 location_status enum 에 없음 → 공개 노출을 끄는 단일 수단은 status='draft'.
//    공개 RLS = status<>'draft' AND published_at IS NOT NULL 이므로 draft 로 바꾸면 비공개.)
// - status 만 'draft' 로 변경, published_at 은 보존 → 되돌릴 때 status 만 원복하면 즉시 재노출(제약 통과).
// - 카테고리 ≥1 인 location 은 절대 건드리지 않음.
// - --confirm 없으면 절대 쓰기 없음. 변경 직전 현재 상태를 output/ 에 백업(JSON).
// - 멱등: 이미 draft 인 건 대상에서 제외. quest_ 테이블 미사용. 구조 변경 없음.
// - 자격증명은 .env.remote.local 에서만 읽음(하드코딩 금지).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirm");
const restoreIdx = args.indexOf("--restore");
const RESTORE_PATH = restoreIdx >= 0 ? args[restoreIdx + 1] : null;

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey) {
  console.error("[hide] .env.remote.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다.");
  process.exit(1);
}
if (!/^https:\/\/.+\.supabase\.co/.test(url)) {
  console.error(`[hide] 원격 https Supabase URL 이 아닙니다(로컬 주소 방지): ${url}`);
  process.exit(1);
}
const sb = createClient(url, secretKey, { auth: { persistSession: false } });

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// ── 되돌리기 모드 ─────────────────────────────────────────────
if (RESTORE_PATH) {
  const backup = JSON.parse(readFileSync(RESTORE_PATH, "utf8"));
  const rows = backup.rows || [];
  console.log(`\n=== 되돌리기: ${RESTORE_PATH} (${rows.length}행) ===`);
  if (!CONFIRM) {
    console.log("드라이런입니다. 실제 원복하려면 --confirm 추가:");
    console.log(`  node scripts/hide-uncategorized.mjs --restore ${RESTORE_PATH} --confirm`);
    rows.slice(0, 5).forEach((r) => console.log(`   ${r.name} → status='${r.status}'`));
    process.exit(0);
  }
  let ok = 0, fail = 0;
  for (const r of rows) {
    const { error } = await sb
      .from("bakery_locations")
      .update({ status: r.status, published_at: r.published_at })
      .eq("id", r.id);
    if (error) { fail++; console.error(`   ❌ ${r.name}: ${error.message}`); } else { ok++; }
  }
  console.log(`✅ 원복: ${ok}건 / ❌ 실패: ${fail}건`);
  process.exit(fail ? 1 : 0);
}

// ── 숨김 모드 (드라이런 / --confirm) ──────────────────────────
const locs = await fetchAll("bakery_locations", "id,slug,name,status,published_at");
const cats = await fetchAll("location_bread_categories", "location_id");
const withCat = new Set(cats.map((c) => c.location_id));

const targets = locs.filter((l) => !withCat.has(l.id) && l.status !== "draft");
const keep = locs.filter((l) => withCat.has(l.id));

console.log("\n=== 카테고리 미연결 빵집 숨김 ===");
console.log(`총 location: ${locs.length}`);
console.log(`카테고리 ≥1 (유지, 건드리지 않음): ${keep.length}`);
console.log(`카테고리 0 & 현재 비draft (숨김 대상): ${targets.length}`);
console.log("");
targets.slice(0, 10).forEach((t, i) =>
  console.log(`   ${String(i + 1).padStart(3)}. ${t.name}  [${t.status} → draft]  (${t.slug})`),
);
if (targets.length > 10) console.log(`   … 외 ${targets.length - 10}곳`);

if (targets.length === 0) {
  console.log("\n대상이 없습니다(이미 모두 숨김이거나 전부 카테고리 보유).");
  process.exit(0);
}

if (!CONFIRM) {
  console.log("\n드라이런입니다(쓰기 없음). 실제 숨기려면 --confirm 추가:");
  console.log("  node scripts/hide-uncategorized.mjs --confirm");
  process.exit(0);
}

// 백업(변경 직전 스냅샷)
mkdirSync(new URL("../output/", import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `output/hide-backup-${stamp}.json`;
writeFileSync(
  new URL(`../${backupPath}`, import.meta.url),
  JSON.stringify(
    { generated_at: new Date().toISOString(), reason: "hide-uncategorized", count: targets.length, rows: targets },
    null,
    2,
  ),
  "utf8",
);
console.log(`\n💾 백업 저장: ${backupPath} (되돌리기: --restore ${backupPath} --confirm)`);

// 배치 UPDATE (status='draft', published_at 보존)
let ok = 0, fail = 0;
for (const batch of chunk(targets.map((t) => t.id), 50)) {
  const { error, count } = await sb
    .from("bakery_locations")
    .update({ status: "draft" }, { count: "exact" })
    .in("id", batch);
  if (error) { fail += batch.length; console.error(`   ❌ 배치 실패: ${error.message}`); }
  else { ok += count ?? batch.length; }
}
console.log(`\n✅ 숨김(draft) 처리: ${ok}건 / ❌ 실패: ${fail}건`);
process.exit(fail ? 1 : 0);
