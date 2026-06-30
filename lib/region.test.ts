import { describe, expect, it } from "vitest";
import { formatRegionLabel, matchesRegionFilter } from "@/lib/region";

describe("matchesRegionFilter", () => {
  it("matches a city filter against a province+city region (전주 버그)", () => {
    // region_level_1 이 '전북특별자치도'라 startsWith('전주')가 실패하던 버그.
    expect(matchesRegionFilter("전북특별자치도 전주시", "전주")).toBe(true);
  });

  it("matches province-level filters", () => {
    expect(matchesRegionFilter("서울 성동구", "서울")).toBe(true);
    expect(matchesRegionFilter("제주특별자치도 제주시", "제주")).toBe(true);
    expect(matchesRegionFilter("대전 서구", "대전")).toBe(true);
  });

  it("does not match a different region", () => {
    expect(matchesRegionFilter("부산 해운대구", "서울")).toBe(false);
    expect(matchesRegionFilter("전북특별자치도 전주시", "제주")).toBe(false);
  });

  it("treats an empty filter as 'match all'", () => {
    expect(matchesRegionFilter("부산 해운대구", "")).toBe(true);
  });
});

describe("formatRegionLabel", () => {
  it("uses the dong when level2 is a road name (세종 버그)", () => {
    // 세종은 구가 없어 카카오가 도로명을 region_level_2 로 반환 → 동으로 대체.
    expect(formatRegionLabel("세종특별자치시", "갈매로", "어진동")).toBe(
      "세종특별자치시 어진동",
    );
    expect(formatRegionLabel("세종특별자치시", "다솜1로", "어진동")).toBe(
      "세종특별자치시 어진동",
    );
    expect(formatRegionLabel("세종특별자치시", "나성북1로", "나성동")).toBe(
      "세종특별자치시 나성동",
    );
  });

  it("keeps a normal gu/si label as-is", () => {
    expect(formatRegionLabel("서울", "성동구", "성수동")).toBe("서울 성동구");
    expect(formatRegionLabel("전북특별자치도", "전주시", "풍남동")).toBe(
      "전북특별자치도 전주시",
    );
    expect(formatRegionLabel("부산", "해운대구", null)).toBe("부산 해운대구");
  });

  it("falls back gracefully when fields are missing", () => {
    // level2 가 도로명인데 동(level3)이 없으면 도로명을 떨군다.
    expect(formatRegionLabel("세종특별자치시", "갈매로", null)).toBe(
      "세종특별자치시",
    );
    expect(formatRegionLabel("서울", null, null)).toBe("서울");
  });
});
