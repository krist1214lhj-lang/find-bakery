// 원격 Supabase 관리 스크립트 (읽기 전용 연결 테스트)
// 사용법: node scripts/supabase-admin.mjs
//
// - 자격증명은 .env.remote.local 에서만 읽음 (코드에 하드코딩 금지).
// - service/secret key 로 접속해 RLS 우회 (관리 작업용).
// - 기본 동작: bakery_locations 에서 뺑드미(paindemie-achasan) 1행 조회만. 쓰기 없음.
// - quest_ 접두사 테이블은 다루지 않음.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadRemoteEnv() {
  const env = {};
  try {
    const text = readFileSync(new URL("../.env.remote.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^"(.*)"$/, "$1").trim();
    }
  } catch {
    // 파일이 없으면 아래 검증에서 안내
  }
  return env;
}

const env = loadRemoteEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.error(
    "[supabase-admin] .env.remote.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 를 채워주세요.",
  );
  process.exit(1);
}
if (!/^https:\/\/.+\.supabase\.co/.test(url)) {
  console.error(
    `[supabase-admin] 원격 https Supabase URL 이 아닙니다(로컬 주소 방지): ${url}`,
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 읽기 전용 테스트: 뺑드미 1행 조회
const { data, error } = await supabase
  .from("bakery_locations")
  .select("id, name, slug, road_address, latitude, longitude, status, updated_at")
  .eq("slug", "paindemie-achasan")
  .limit(1);

if (error) {
  console.error(`[supabase-admin] 조회 실패: ${error.message}`);
  process.exitCode = 1;
} else {
  console.log("[supabase-admin] 연결 OK · bakery_locations 조회 결과:");
  console.log(JSON.stringify(data, null, 2));
}
