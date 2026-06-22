import { NextResponse } from "next/server";
import {
  isDemoAdminEnabled,
  reviewAdminReport,
} from "@/lib/admin-report-repository";
import type { CorrectionReviewAction } from "@/lib/types";

type AdminReportRouteProps = {
  params: Promise<{ id: string }>;
};

const allowedActions = new Set<CorrectionReviewAction>([
  "triage",
  "approve",
  "reject",
  "hold",
  "mark-duplicate",
  "request-more-info",
]);

export async function PATCH(
  request: Request,
  { params }: AdminReportRouteProps,
) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const { id } = await params;
  const payload = await readPayload(request);
  if (!payload) {
    return NextResponse.json(
      { message: "검수 요청 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (payload.reason.trim().length < 5) {
    return NextResponse.json(
      { message: "검수 사유를 5자 이상 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const queue = await reviewAdminReport(id, payload.action, payload.reason);
    return NextResponse.json(queue, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Admin report review failed", {
      message: cause instanceof Error ? cause.message : "unknown error",
    });
    return NextResponse.json(
      { message: "검수 상태를 변경하지 못했어요." },
      { status: 500 },
    );
  }
}

async function readPayload(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object") {
      return null;
    }

    const payload = value as { action?: unknown; reason?: unknown };
    if (
      typeof payload.action !== "string" ||
      !allowedActions.has(payload.action as CorrectionReviewAction) ||
      typeof payload.reason !== "string"
    ) {
      return null;
    }

    return {
      action: payload.action as CorrectionReviewAction,
      reason: payload.reason,
    };
  } catch {
    return null;
  }
}
