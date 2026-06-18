import { describe, expect, it } from "vitest";
import {
  CORRECTION_REPORTS_KEY,
  createCorrectionReport,
  readCorrectionReports,
  readReviewActions,
  readSavedBakeryIds,
  reviewCorrectionReport,
  toggleSavedBakeryId,
  validateCorrectionDraft,
} from "@/lib/storage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("saved bakery storage", () => {
  it("adds and removes a bakery without duplicates", () => {
    const storage = new MemoryStorage();

    expect(toggleSavedBakeryId(storage, "bakery-1")).toEqual(["bakery-1"]);
    expect(toggleSavedBakeryId(storage, "bakery-2")).toEqual([
      "bakery-1",
      "bakery-2",
    ]);
    expect(toggleSavedBakeryId(storage, "bakery-1")).toEqual(["bakery-2"]);
    expect(readSavedBakeryIds(storage)).toEqual(["bakery-2"]);
  });

  it("recovers safely from invalid stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem("bbang-gil.saved-bakeries.v1", "{broken");

    expect(readSavedBakeryIds(storage)).toEqual([]);
  });
});

describe("correction report validation", () => {
  const validDraft = {
    bakeryId: "bakery-1",
    bakeryName: "테스트 빵집",
    category: "hours" as const,
    description: "공식 계정에서 오늘 임시휴무 공지를 확인했습니다.",
    sourceUrl: "https://example.com/notice",
  };

  it("requires a useful description and a safe URL", () => {
    expect(validateCorrectionDraft(validDraft)).toEqual({ valid: true });
    expect(
      validateCorrectionDraft({ ...validDraft, description: "짧음" }),
    ).toEqual({
      valid: false,
      message: "확인한 내용을 10자 이상 입력해 주세요.",
    });
    expect(
      validateCorrectionDraft({ ...validDraft, sourceUrl: "javascript:x" }),
    ).toEqual({
      valid: false,
      message: "출처 링크는 http 또는 https 주소만 사용할 수 있어요.",
    });
    expect(
      validateCorrectionDraft({
        ...validDraft,
        category: "unknown" as typeof validDraft.category,
      }),
    ).toEqual({
      valid: false,
      message: "다른 정보의 종류를 선택해 주세요.",
    });
  });

  it("stores a validated report with an immutable receipt", () => {
    const storage = new MemoryStorage();
    const report = createCorrectionReport(storage, validDraft, {
      id: "report-001",
      now: new Date("2026-06-18T03:00:00Z"),
    });

    expect(report.id).toBe("report-001");
    expect(report.status).toBe("submitted");
    expect(readCorrectionReports(storage)).toEqual([report]);
    expect(storage.getItem(CORRECTION_REPORTS_KEY)).toContain("report-001");
  });

  it("ignores malformed reports already in storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CORRECTION_REPORTS_KEY,
      JSON.stringify([{ id: 123 }, { ...validDraft, id: "missing-status" }]),
    );

    expect(readCorrectionReports(storage)).toEqual([]);
  });

  it("records review transitions and prevents a second resolution", () => {
    const storage = new MemoryStorage();
    const report = createCorrectionReport(storage, validDraft, {
      id: "report-review",
      now: new Date("2026-06-18T03:00:00Z"),
    });
    const result = reviewCorrectionReport(
      storage,
      report.id,
      "approve",
      "공식 원문과 내용이 일치합니다.",
      {
        id: "review-001",
        now: new Date("2026-06-18T04:00:00Z"),
      },
    );

    expect(result.report.status).toBe("accepted");
    expect(result.report.resolvedAt).toBe("2026-06-18T04:00:00.000Z");
    expect(readReviewActions(storage)[0]).toMatchObject({
      id: "review-001",
      previousStatus: "submitted",
      nextStatus: "accepted",
    });
    expect(() =>
      reviewCorrectionReport(
        storage,
        report.id,
        "reject",
        "이미 처리된 건을 다시 반려합니다.",
      ),
    ).toThrow("이미 처리가 끝난 제보예요.");
  });

  it("requires a review reason before changing state", () => {
    const storage = new MemoryStorage();
    const report = createCorrectionReport(storage, validDraft, {
      id: "report-no-reason",
    });

    expect(() =>
      reviewCorrectionReport(storage, report.id, "hold", "짧음"),
    ).toThrow("검수 사유를 5자 이상 입력해 주세요.");
  });
});
