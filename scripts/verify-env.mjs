const deployMode = process.argv.includes("--deploy");

const requiredForDeploy = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "KAKAO_REST_API_KEY",
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

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use HTTPS for deployment`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}
