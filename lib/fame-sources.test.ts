import { describe, expect, it } from "vitest";
import { extractFameSources } from "@/lib/fame-sources";

const nv = (sources: unknown) => ({ rationale: "x", sources });

describe("extractFameSources", () => {
  it("maps known domains to media names", () => {
    const out = extractFameSources(
      nv([
        { url: "https://www.diningcode.com/profile.php?rid=1", kind: "blog" },
        { url: "https://www.siksinhot.com/P/1", kind: "other" },
        { url: "https://polle.com/place/x", kind: "blog" },
      ]),
    );
    expect(out.map((s) => s.label)).toEqual(["다이닝코드", "식신", "뽈레"]);
    expect(out.every((s) => !s.official)).toBe(true);
  });

  it("flags official sources and puts them first with a friendly/official label", () => {
    const out = extractFameSources(
      nv([
        { url: "https://www.diningcode.com/profile.php?rid=2", kind: "blog" },
        { url: "https://www.instagram.com/saltbread", kind: "official" },
        { url: "https://turkishbakery.co.kr/", kind: "official" },
      ]),
    );
    // official 먼저
    expect(out[0].official).toBe(true);
    expect(out[1].official).toBe(true);
    expect(out[2].official).toBe(false);
    // 알려진 도메인은 매체명, 미매핑 공식은 "공식 홈페이지"
    const inst = out.find((s) => s.url.includes("instagram"));
    expect(inst?.label).toBe("인스타그램");
    const turk = out.find((s) => s.url.includes("turkishbakery"));
    expect(turk?.label).toBe("공식 홈페이지");
  });

  it("uses the bare hostname for unknown non-official domains", () => {
    const out = extractFameSources(
      nv([{ url: "https://www.lovely-days.co.kr/3986", kind: "blog" }]),
    );
    expect(out[0].label).toBe("lovely-days.co.kr");
  });

  it("dedupes by host (one chip per media) and skips invalid urls", () => {
    const out = extractFameSources(
      nv([
        { url: "https://www.diningcode.com/a", kind: "blog" },
        { url: "https://www.diningcode.com/b", kind: "news" },
        { url: "not-a-url", kind: "blog" },
        { url: "https://m.siksinhot.com/P/2", kind: "other" },
      ]),
    );
    expect(out.map((s) => s.label)).toEqual(["다이닝코드", "식신"]);
  });

  it("returns [] for missing/non-array sources", () => {
    expect(extractFameSources(nv(undefined))).toEqual([]);
    expect(extractFameSources(nv("x"))).toEqual([]);
    expect(extractFameSources(null)).toEqual([]);
  });
});
