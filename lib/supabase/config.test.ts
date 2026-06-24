import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  getSupabaseServerConfig,
} from "@/lib/supabase/config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Supabase server configuration", () => {
  it("reports missing server configuration", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getSupabaseServerConfig()).toEqual({ configured: false });
  });

  it("reads the public RLS client configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-publishable-key";

    expect(getSupabasePublicConfig()).toEqual({
      configured: true,
      value: {
        url: "http://127.0.0.1:54321",
        anonKey: "local-publishable-key",
      },
    });
  });

  it("requires both public URL and anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getSupabasePublicConfig()).toEqual({ configured: false });
  });

  it("prefers the current secret key over the legacy service role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_current";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy";

    expect(getSupabaseServerConfig()).toEqual({
      configured: true,
      value: {
        url: "https://example.supabase.co",
        secretKey: "sb_secret_current",
      },
    });
  });

  it("rejects insecure remote URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "secret";

    expect(() => getSupabaseServerConfig()).toThrow(
      "Supabase URL must use HTTPS outside localhost.",
    );
  });

  it("rejects loopback Supabase URLs when running on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = "secret";

    expect(() => getSupabaseServerConfig()).toThrow(
      "Supabase URL이 localhost를 가리킵니다",
    );
  });
});
