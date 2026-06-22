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
  const allowsLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !allowsLocalHttp) {
    throw new Error("Supabase URL must use HTTPS outside localhost.");
  }
}
