export type SupabaseServerConfig = {
  url: string;
  secretKey: string;
};

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function getSupabasePublicConfig():
  | { configured: true; value: SupabasePublicConfig }
  | { configured: false } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return { configured: false };
  }

  assertValidHttpsUrl(url);

  return {
    configured: true,
    value: { url, anonKey },
  };
}

export function getSupabaseServerConfig():
  | { configured: true; value: SupabaseServerConfig }
  | { configured: false } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    return { configured: false };
  }

  assertValidHttpsUrl(url);

  return {
    configured: true,
    value: { url, secretKey },
  };
}

function assertValidHttpsUrl(value: string) {
  const url = new URL(value);
  const isLoopbackHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  // Vercel 등 배포 환경에서 로컬 Supabase 주소가 남아 있으면
  // 런타임에 모호한 "fetch failed" 대신 원인을 바로 알 수 있게 차단한다.
  if (process.env.VERCEL === "1" && isLoopbackHost) {
    throw new Error(
      "Supabase URL이 localhost를 가리킵니다. Vercel 환경변수에 원격 Supabase URL을 설정하세요.",
    );
  }

  const allowsLocalHttp = url.protocol === "http:" && isLoopbackHost;

  if (url.protocol !== "https:" && !allowsLocalHttp) {
    throw new Error("Supabase URL must use HTTPS outside localhost.");
  }
}
