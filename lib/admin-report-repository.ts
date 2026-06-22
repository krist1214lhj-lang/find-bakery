import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CorrectionCategory,
  CorrectionReportStatus,
  CorrectionReviewAction,
  StoredCorrectionReport,
  StoredReviewAction,
} from "@/lib/types";

export type AdminReportQueue = {
  reports: StoredCorrectionReport[];
  actions: StoredReviewAction[];
};

export function isDemoAdminEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEMO_ADMIN === "true"
  );
}

export async function getAdminReportQueue(): Promise<AdminReportQueue> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const [reportsResult, locationsResult, actionsResult] = await Promise.all([
    supabase
      .from("correction_reports")
      .select(
        "id,location_id,category,description,source_url,status,created_at,resolved_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("bakery_locations").select("id,name"),
    supabase
      .from("review_actions")
      .select(
        "id,report_id,action,reason,previous_status,next_status,created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const failed = [reportsResult, locationsResult, actionsResult].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`관리자 큐 조회 실패: ${failed.error.message}`);
  }

  const bakeryNameById = new Map(
    (locationsResult.data ?? []).map((location) => [
      location.id,
      location.name,
    ]),
  );

  return {
    reports: (reportsResult.data ?? []).map((report) => ({
      id: report.id,
      bakeryId: report.location_id,
      bakeryName: bakeryNameById.get(report.location_id) ?? "알 수 없는 빵집",
      category: fromDatabaseCategory(report.category),
      description: report.description,
      sourceUrl: report.source_url ?? undefined,
      status: fromDatabaseStatus(report.status),
      createdAt: report.created_at,
      resolvedAt: report.resolved_at ?? undefined,
    })),
    actions: (actionsResult.data ?? []).map((action) => ({
      id: action.id,
      reportId: action.report_id,
      action: fromDatabaseAction(action.action),
      reason: action.reason,
      previousStatus: fromDatabaseStatus(action.previous_status),
      nextStatus: fromDatabaseStatus(action.next_status),
      createdAt: action.created_at,
    })),
  };
}

export async function reviewAdminReport(
  reportId: string,
  action: CorrectionReviewAction,
  reason: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const { error } = await supabase.rpc("review_correction_report", {
    report_id: reportId,
    review_action: toDatabaseAction(action),
    review_reason: reason.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return getAdminReportQueue();
}

function fromDatabaseCategory(
  value:
    | "hours"
    | "closure"
    | "relocation"
    | "menu_price"
    | "phone_address"
    | "other",
): CorrectionCategory {
  return {
    hours: "hours",
    closure: "closure",
    relocation: "relocation",
    menu_price: "menu-price",
    phone_address: "phone-address",
    other: "other",
  }[value] as CorrectionCategory;
}

function fromDatabaseStatus(
  value:
    | "submitted"
    | "triaged"
    | "in_review"
    | "accepted"
    | "rejected"
    | "duplicate",
): CorrectionReportStatus {
  return value === "in_review" ? "in-review" : value;
}

function fromDatabaseAction(
  value:
    | "triage"
    | "approve"
    | "reject"
    | "hold"
    | "mark_duplicate"
    | "request_more_info",
): CorrectionReviewAction {
  if (value === "mark_duplicate") {
    return "mark-duplicate";
  }
  if (value === "request_more_info") {
    return "request-more-info";
  }
  return value;
}

function toDatabaseAction(action: CorrectionReviewAction) {
  if (action === "mark-duplicate") {
    return "mark_duplicate" as const;
  }
  if (action === "request-more-info") {
    return "request_more_info" as const;
  }
  return action;
}
