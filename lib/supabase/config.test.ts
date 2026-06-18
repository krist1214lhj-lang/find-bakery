import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseServerConfig } from "@/lib/supabase/config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Supabase server configuration", () => {
  it("is optional during local prototype development", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getSupabaseServerConfig()).toEqual({ configured: false });
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
});
