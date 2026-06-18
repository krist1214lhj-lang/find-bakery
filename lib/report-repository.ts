import type {
  CorrectionDraft,
  StoredCorrectionReport,
} from "@/lib/types";
import {
  createCorrectionReport,
  type KeyValueStorage,
  validateCorrectionDraft,
} from "@/lib/storage";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CorrectionSubmission = {
  report: StoredCorrectionReport;
  persistence: "server" | "local";
};

export async function submitCorrectionDraft(
  draft: CorrectionDraft,
  storage: KeyValueStorage,
  fetcher: Fetcher = fetch,
): Promise<CorrectionSubmission> {
  const validation = validateCorrectionDraft(draft);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  let response: Response;
  try {
    response = await fetcher("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
  } catch {
    return {
      report: createCorrectionReport(storage, draft),
      persistence: "local",
    };
  }

  if (response.ok) {
    const payload = (await response.json()) as
      | { report: StoredCorrectionReport }
      | { mode: "local-only" };
    if ("report" in payload) {
      return { report: payload.report, persistence: "server" };
    }

    return {
      report: createCorrectionReport(storage, draft),
      persistence: "local",
    };
  }

  if (response.status < 500) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "제보 내용을 확인해 주세요.");
  }

  return {
    report: createCorrectionReport(storage, draft),
    persistence: "local",
  };
}
