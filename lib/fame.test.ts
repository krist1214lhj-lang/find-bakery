import { describe, expect, it } from "vitest";
import { extractRationale, resolveFame } from "@/lib/fame";

describe("resolveFame", () => {
  it("uses fame_evidence description when present", () => {
    expect(
      resolveFame({ fameDescription: "유명한 이유", fameSourceLabel: "공식 SNS" }),
    ).toEqual({ reason: "유명한 이유", source: "공식 SNS" });
  });

  it("falls back to verification rationale when fame is absent", () => {
    expect(
      resolveFame({
        verificationRationale: "다이닝코드·식신에서 교차확인",
        verificationSourceLabel: "정밀 검증 (웹검색)",
      }),
    ).toEqual({
      reason: "다이닝코드·식신에서 교차확인",
      source: "정밀 검증 (웹검색)",
    });
  });

  it("ignores empty/whitespace fame and uses the rationale", () => {
    expect(
      resolveFame({
        fameDescription: "   ",
        verificationRationale: "웹 근거",
        verificationSourceLabel: "정밀 검증 (웹검색)",
      }),
    ).toEqual({ reason: "웹 근거", source: "정밀 검증 (웹검색)" });
  });

  it("prefers fame title over verification rationale", () => {
    expect(
      resolveFame({ fameTitle: "지역 유명점", verificationRationale: "근거" })
        .reason,
    ).toBe("지역 유명점");
  });

  it("returns the fallback strings when nothing is available", () => {
    expect(resolveFame({})).toEqual({
      reason: "이 빵집이 알려진 이유를 확인하고 있어요.",
      source: "검증된 출처 준비 중",
    });
  });
});

describe("extractRationale", () => {
  it("reads a non-empty rationale string from normalized_value", () => {
    expect(extractRationale({ rationale: "공식 홈페이지 확인", by: "x" })).toBe(
      "공식 홈페이지 확인",
    );
  });

  it("returns undefined for missing/empty/non-object values", () => {
    expect(extractRationale(null)).toBeUndefined();
    expect(extractRationale({ rationale: "   " })).toBeUndefined();
    expect(extractRationale({ other: 1 })).toBeUndefined();
    expect(extractRationale("string")).toBeUndefined();
  });
});
