import { describe, expect, it } from "vitest";
import { extractSignatureCategories } from "@/lib/signature";

describe("extractSignatureCategories", () => {
  it("reads valid {slug, evidence} pairs from normalized_value.categories", () => {
    const nv = {
      rationale: "...",
      categories: [
        { slug: "baked-sweets", evidence: "다이닝코드에서 '앙버터 호두과자' 언급" },
        { slug: "cake", evidence: "무스 케이크 대표메뉴" },
      ],
    };
    expect(extractSignatureCategories(nv)).toEqual([
      { slug: "baked-sweets", evidence: "다이닝코드에서 '앙버터 호두과자' 언급" },
      { slug: "cake", evidence: "무스 케이크 대표메뉴" },
    ]);
  });

  it("skips invalid slugs, empty/whitespace evidence, and duplicate slugs", () => {
    const nv = {
      categories: [
        { slug: "not-a-cat", evidence: "x" },
        { slug: "salt-bread", evidence: "   " },
        { slug: "bagel", evidence: "베이글 맛집" },
        { slug: "bagel", evidence: "중복" },
      ],
    };
    expect(extractSignatureCategories(nv)).toEqual([
      { slug: "bagel", evidence: "베이글 맛집" },
    ]);
  });

  it("returns [] for missing/non-array/non-object values", () => {
    expect(extractSignatureCategories(null)).toEqual([]);
    expect(extractSignatureCategories("x")).toEqual([]);
    expect(extractSignatureCategories({})).toEqual([]);
    expect(extractSignatureCategories({ categories: "no" })).toEqual([]);
  });
});
