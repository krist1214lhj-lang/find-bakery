import type {
  CorrectionDraft,
  CorrectionReviewAction,
  CorrectionReportStatus,
  StoredCorrectionReport,
  StoredReviewAction,
} from "@/lib/types";

export const SAVED_BAKERIES_KEY = "bbang-gil.saved-bakeries.v1";
export const CORRECTION_REPORTS_KEY = "bbang-gil.correction-reports.v1";
export const REVIEW_ACTIONS_KEY = "bbang-gil.review-actions.v1";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function readSavedBakeryIds(storage: KeyValueStorage): string[] {
  return parseStringArray(storage.getItem(SAVED_BAKERIES_KEY));
}

export function writeSavedBakeryIds(
  storage: KeyValueStorage,
  bakeryIds: string[],
) {
  const uniqueIds = [...new Set(bakeryIds.filter(Boolean))];
  storage.setItem(SAVED_BAKERIES_KEY, JSON.stringify(uniqueIds));
  return uniqueIds;
}

export function toggleSavedBakeryId(
  storage: KeyValueStorage,
  bakeryId: string,
) {
  const current = readSavedBakeryIds(storage);
  const next = current.includes(bakeryId)
    ? current.filter((id) => id !== bakeryId)
    : [...current, bakeryId];

  return writeSavedBakeryIds(storage, next);
}

export function readCorrectionReports(
  storage: KeyValueStorage,
): StoredCorrectionReport[] {
  return parseCorrectionReports(storage.getItem(CORRECTION_REPORTS_KEY));
}

export function parseCorrectionReports(
  raw: string | null,
): StoredCorrectionReport[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredCorrectionReport);
  } catch {
    return [];
  }
}

export function createCorrectionReport(
  storage: KeyValueStorage,
  draft: CorrectionDraft,
  options?: { id?: string; now?: Date },
) {
  const validation = validateCorrectionDraft(draft);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const report: StoredCorrectionReport = {
    ...draft,
    sourceUrl: draft.sourceUrl?.trim() || undefined,
    description: draft.description.trim(),
    id: options?.id ?? crypto.randomUUID(),
    status: "submitted",
    createdAt: (options?.now ?? new Date()).toISOString(),
  };
  const current = readCorrectionReports(storage);
  storage.setItem(CORRECTION_REPORTS_KEY, JSON.stringify([report, ...current]));

  return report;
}

export function readReviewActions(
  storage: KeyValueStorage,
): StoredReviewAction[] {
  return parseReviewActions(storage.getItem(REVIEW_ACTIONS_KEY));
}

export function parseReviewActions(raw: string | null): StoredReviewAction[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isStoredReviewAction)
      : [];
  } catch {
    return [];
  }
}

export function reviewCorrectionReport(
  storage: KeyValueStorage,
  reportId: string,
  action: CorrectionReviewAction,
  reason: string,
  options?: { id?: string; now?: Date },
) {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) {
    throw new Error("검수 사유를 5자 이상 입력해 주세요.");
  }

  const reports = readCorrectionReports(storage);
  const reportIndex = reports.findIndex((report) => report.id === reportId);
  if (reportIndex < 0) {
    throw new Error("검수할 제보를 찾을 수 없어요.");
  }

  const report = reports[reportIndex];
  if (isResolvedStatus(report.status)) {
    throw new Error("이미 처리가 끝난 제보예요.");
  }

  const nextStatus = getNextCorrectionStatus(action);
  const now = options?.now ?? new Date();
  const nextReport: StoredCorrectionReport = {
    ...report,
    status: nextStatus,
    resolvedAt: isResolvedStatus(nextStatus) ? now.toISOString() : undefined,
  };
  const nextReports = reports.map((candidate, index) =>
    index === reportIndex ? nextReport : candidate,
  );
  const reviewAction: StoredReviewAction = {
    id: options?.id ?? crypto.randomUUID(),
    reportId,
    action,
    reason: trimmedReason,
    previousStatus: report.status,
    nextStatus,
    createdAt: now.toISOString(),
  };

  storage.setItem(CORRECTION_REPORTS_KEY, JSON.stringify(nextReports));
  storage.setItem(
    REVIEW_ACTIONS_KEY,
    JSON.stringify([reviewAction, ...readReviewActions(storage)]),
  );

  return { report: nextReport, action: reviewAction };
}

export function validateCorrectionDraft(draft: CorrectionDraft):
  | { valid: true }
  | { valid: false; message: string } {
  if (!isCorrectionCategory(draft.category)) {
    return { valid: false, message: "다른 정보의 종류를 선택해 주세요." };
  }

  if (draft.description.trim().length < 10) {
    return {
      valid: false,
      message: "확인한 내용을 10자 이상 입력해 주세요.",
    };
  }

  if (draft.description.trim().length > 1000) {
    return {
      valid: false,
      message: "확인한 내용은 1,000자 이하로 입력해 주세요.",
    };
  }

  if (draft.sourceUrl?.trim()) {
    if (draft.sourceUrl.trim().length > 2048) {
      return {
        valid: false,
        message: "출처 링크는 2,048자 이하로 입력해 주세요.",
      };
    }

    try {
      const url = new URL(draft.sourceUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return {
          valid: false,
          message: "출처 링크는 http 또는 https 주소만 사용할 수 있어요.",
        };
      }
    } catch {
      return { valid: false, message: "출처 링크 형식을 확인해 주세요." };
    }
  }

  return { valid: true };
}

function isCorrectionCategory(
  value: unknown,
): value is CorrectionDraft["category"] {
  return (
    value === "hours" ||
    value === "closure" ||
    value === "relocation" ||
    value === "menu-price" ||
    value === "phone-address" ||
    value === "other"
  );
}

function parseStringArray(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function isStoredCorrectionReport(
  value: unknown,
): value is StoredCorrectionReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<StoredCorrectionReport>;
  return (
    typeof report.id === "string" &&
    typeof report.bakeryId === "string" &&
    typeof report.bakeryName === "string" &&
    typeof report.category === "string" &&
    typeof report.description === "string" &&
    isCorrectionStatus(report.status) &&
    typeof report.createdAt === "string"
  );
}

function isStoredReviewAction(value: unknown): value is StoredReviewAction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Partial<StoredReviewAction>;
  return (
    typeof action.id === "string" &&
    typeof action.reportId === "string" &&
    typeof action.action === "string" &&
    typeof action.reason === "string" &&
    isCorrectionStatus(action.previousStatus) &&
    isCorrectionStatus(action.nextStatus) &&
    typeof action.createdAt === "string"
  );
}

function isCorrectionStatus(
  value: unknown,
): value is CorrectionReportStatus {
  return (
    value === "submitted" ||
    value === "triaged" ||
    value === "in-review" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "duplicate"
  );
}

function isResolvedStatus(status: CorrectionReportStatus) {
  return (
    status === "accepted" ||
    status === "rejected" ||
    status === "duplicate"
  );
}

function getNextCorrectionStatus(
  action: CorrectionReviewAction,
): CorrectionReportStatus {
  switch (action) {
    case "triage":
      return "triaged";
    case "hold":
      return "in-review";
    case "approve":
      return "accepted";
    case "reject":
      return "rejected";
    case "mark-duplicate":
      return "duplicate";
  }
}
