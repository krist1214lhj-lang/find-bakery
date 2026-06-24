// Vercel 빌드(VERCEL=1)에서는 플래그 없이도 배포 검증을 강제한다.
// 그래야 잘못된 env(예: URL 칸에 secret key)가 빌드 단계에서 차단된다.
const deployMode =
  process.argv.includes("--deploy") || process.env.VERCEL === "1";

const requiredForDeploy = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "KAKAO_REST_API_KEY",
  "NEXT_PUBLIC_KAKAO_MAP_JS_KEY",
  "DATA_GO_KR_SERVICE_KEY",
];
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const errors = [];

if (deployMode) {
  for (const name of requiredForDeploy) {
    if (!process.env[name]?.trim()) {
      errors.push(`Missing required deployment environment variable: ${name}`);
    }
  }

  if (!secretKey?.trim()) {
    errors.push(
      "Missing server secret: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  validateHttpsUrl("NEXT_PUBLIC_APP_URL");
  validateHttpsUrl("NEXT_PUBLIC_SUPABASE_URL");

  if (process.env.ENABLE_DEMO_ADMIN === "true") {
    errors.push("ENABLE_DEMO_ADMIN must not be true for a public deployment");
  }
}

if (errors.length > 0) {
  console.error("[env] verification failed");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  deployMode
    ? "[env] deployment environment contract passed"
    : "[env] local environment contract passed",
);

function validateHttpsUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    return;
  }

  // 흔한 실수: URL 칸에 Supabase key(sb_publishable_/sb_secret_/JWT)를 붙여넣음.
  if (/^(sb_|eyJ)/.test(value)) {
    errors.push(
      `${name} looks like a Supabase key, not a URL. Set it to https://<project-ref>.supabase.co`,
    );
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use HTTPS for deployment`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}
