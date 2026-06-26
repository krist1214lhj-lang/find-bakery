// .env.local 을 "원격(라이브) Supabase 읽기 전용"으로 안전하게 전환한다.
// - 기존 로컬값은 [LOCAL-BACKUP] 주석으로 보존(되돌리기 쉬움).
// - NEXT_PUBLIC_SUPABASE_URL=원격, ANON=원격키, SECRET/SERVICE_ROLE=비움(쓰기 차단).
// - 원격 URL/키 값은 코드에 하드코딩하지 않는다 → .env.remote.local 등에서 읽는다.
// - anon 키 값은 화면에 절대 출력하지 않는다(마스킹 요약만).
// - 재실행 안전(idempotent): 이전에 추가한 블록을 지우고 다시 만든다.
//
// 원격 URL 소스: .env.remote.local 의 NEXT_PUBLIC_SUPABASE_URL
// anon 키 소스(우선순위):
//   1) 환경변수 SUPABASE_REMOTE_ANON
//   2) scripts/_keys.tmp.json  (supabase CLI `projects api-keys --output json` 결과)
//   둘 다 없으면 플레이스홀더를 넣고 "직접 채우라" 안내.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const REMOTE_ENV_PATH = path.join(ROOT, ".env.remote.local");
const KEYS_TMP = path.join(ROOT, "scripts", "_keys.tmp.json");
const PLACEHOLDER = "__PASTE_REMOTE_ANON_KEY_HERE__";
const BEGIN = "# === [원격 읽기전용 전환] BEGIN (switch-env-remote) ===";
const END = "# === [원격 읽기전용 전환] END ===";
const TARGETS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function readEnvValue(file, key) {
  try {
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));
      if (m) return m[1].replace(/^"(.*)"$/, "$1").trim();
    }
  } catch {
    /* 파일 없음 */
  }
  return null;
}

function findAnonKey() {
  const fromEnv = process.env.SUPABASE_REMOTE_ANON?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(KEYS_TMP)) {
    try {
      const data = JSON.parse(readFileSync(KEYS_TMP, "utf8"));
      const arr = Array.isArray(data) ? data : [];
      const anon = arr.find((k) =>
        /anon|publishable/i.test(String(k.name ?? k.type ?? "")),
      );
      const key = anon?.api_key ?? anon?.apiKey ?? anon?.key;
      if (key) return String(key).trim();
    } catch {
      /* 형식 다르면 무시 */
    }
  }
  return null;
}

if (!existsSync(ENV_PATH)) {
  console.error("[switch] .env.local 없음 — 중단");
  process.exit(1);
}

const REMOTE_URL = readEnvValue(REMOTE_ENV_PATH, "NEXT_PUBLIC_SUPABASE_URL");
if (!REMOTE_URL || !/^https:\/\/.+\.supabase\.co/.test(REMOTE_URL)) {
  console.error(
    "[switch] .env.remote.local 에서 원격 NEXT_PUBLIC_SUPABASE_URL(https://*.supabase.co)을 못 읽음 — 중단",
  );
  process.exit(1);
}

let lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/);

// 1) 이전 원격 블록 제거(재실행 안전)
const b = lines.indexOf(BEGIN);
if (b !== -1) {
  const e = lines.indexOf(END);
  if (e !== -1 && e >= b) lines.splice(b, e - b + 1);
}

// 2) 활성(주석 아님) 대상 키 라인을 백업 주석 처리
lines = lines.map((line) => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
  if (m && TARGETS.includes(m[1]) && !/^\s*#/.test(line)) {
    return `# [LOCAL-BACKUP] ${line}`;
  }
  return line;
});

// 3) 원격 블록 추가
const anon = findAnonKey();
while (lines.length && lines[lines.length - 1] === "") lines.pop();
lines.push(
  "",
  BEGIN,
  "# 평소 개발용: 원격(라이브) Supabase 를 읽기 전용으로 사용.",
  "# 되돌리기: 아래 블록 삭제 + 위 [LOCAL-BACKUP] 줄들의 '# [LOCAL-BACKUP] ' 제거 → 로컬 복귀.",
  `NEXT_PUBLIC_SUPABASE_URL=${REMOTE_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon ?? PLACEHOLDER}`,
  "# 쓰기 차단: secret 비움 → 앱의 관리자/서버 쓰기 클라이언트 비활성(실데이터 보호).",
  "SUPABASE_SECRET_KEY=",
  "SUPABASE_SERVICE_ROLE_KEY=",
  END,
  "",
);

writeFileSync(ENV_PATH, lines.join("\n"));
if (existsSync(KEYS_TMP)) rmSync(KEYS_TMP);

console.log("[switch] .env.local 갱신 완료 (값은 출력 안 함)");
console.log("  NEXT_PUBLIC_SUPABASE_URL      = 원격(*.supabase.co, .env.remote.local에서 읽음)");
console.log(
  `  NEXT_PUBLIC_SUPABASE_ANON_KEY = ${anon ? "원격 anon 키 설정됨" : `미설정 → 플레이스홀더(${PLACEHOLDER}) 넣음, 직접 채워야 함`}`,
);
console.log("  SUPABASE_SECRET_KEY/SERVICE   = 비움(쓰기 차단)");
console.log("  로컬 원래값                    = [LOCAL-BACKUP] 주석으로 보존");
