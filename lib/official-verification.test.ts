import { describe, expect, it } from "vitest";
import { parseOfficialVerificationDraft } from "@/lib/official-verification";

const baseDraft = {
  locationId: "20000000-0000-4000-8000-000000000001",
  field: "business_hours",
  sourceType: "official_sns",
  publisher: "멜로우 오븐 공식 인스타그램",
  sourceUrl: "https://www.instagram.com/mellow",
  accountPlatform: "instagram",
  officialityEvidence: "공식 홈페이지에서 연결된 계정",
  note: "현재 저장된 영업시간과 공식 공지가 일치함",
};

describe("parseOfficialVerificationDraft", () => {
  it("accepts an official SNS verification", () => {
    const result = parseOfficialVerificationDraft(baseDraft);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.field).toBe("business_hours");
      expect(result.value.sourceType).toBe("official_sns");
    }
  });

  it("requires a menu item for menu and price verification", () => {
    const result = parseOfficialVerificationDraft({
      ...baseDraft,
      field: "price",
    });

    expect(result).toEqual({
      ok: false,
      message: "메뉴 또는 가격 확인에는 메뉴를 선택해 주세요.",
    });
  });

  it("requires evidence for an official web account", () => {
    const result = parseOfficialVerificationDraft({
      ...baseDraft,
      officialityEvidence: "짧음",
    });

    expect(result).toEqual({
      ok: false,
      message: "공식 계정이라고 판단한 근거를 5자 이상 입력해 주세요.",
    });
  });

  it("accepts phone verification without account fields", () => {
    const result = parseOfficialVerificationDraft({
      locationId: baseDraft.locationId,
      field: "phone",
      sourceType: "phone",
      publisher: "매장 전화 확인",
      note: "매장에 직접 전화해 번호와 지점명을 확인함",
    });

    expect(result.ok).toBe(true);
  });

  it("requires a web source for official account verification", () => {
    const result = parseOfficialVerificationDraft({
      locationId: baseDraft.locationId,
      field: "official_account",
      sourceType: "phone",
      publisher: "매장 전화 확인",
      note: "전화로 공식 계정 주소를 전달받아 확인함",
    });

    expect(result).toEqual({
      ok: false,
      message: "공식 계정 확인은 공식 홈페이지나 SNS로 등록해 주세요.",
    });
  });

  it("rejects an inverted effective date range", () => {
    const result = parseOfficialVerificationDraft({
      ...baseDraft,
      effectiveFrom: "2026-06-24T10:00",
      effectiveUntil: "2026-06-23T10:00",
    });

    expect(result).toEqual({
      ok: false,
      message: "적용 종료 시각은 시작 시각보다 빠를 수 없습니다.",
    });
  });
});
