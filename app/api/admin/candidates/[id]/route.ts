import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { reviewAdminPlaceCandidate } from "@/lib/place-candidate-repository";
import type { PlaceCandidateReviewAction } from "@/lib/place-provider";

type CandidateRouteProps = {
  params: Promise<{ id: string }>;
};

const actions = new Set<PlaceCandidateReviewAction>([
  "hold",
  "approve",
  "reject",
  "mark-duplicate",
]);

export async function PATCH(request: Request, { params }: CandidateRouteProps) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const payload = await readPayload(request);
  if (!payload || payload.reason.trim().length < 5) {
    return NextResponse.json(
      { message: "검수 사유를 5자 이상 입력해 주세요." },
      { status: 400 },
    );
  }
  if (payload.action === "mark-duplicate" && !payload.matchedLocationId) {
    return NextResponse.json(
      { message: "중복으로 연결할 기존 지점을 선택해 주세요." },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const queue = await reviewAdminPlaceCandidate(
      id,
      payload.action,
      payload.reason,
      payload.matchedLocationId,
    );
    return NextResponse.json(queue, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Place candidate review failed", {
      message: cause instanceof Error ? cause.message : "unknown error",
    });
    return NextResponse.json(
      { message: "장소 후보를 처리하지 못했어요." },
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
    const payload = value as {
      action?: unknown;
      reason?: unknown;
      matchedLocationId?: unknown;
    };
    if (
      typeof payload.action !== "string" ||
      !actions.has(payload.action as PlaceCandidateReviewAction) ||
      typeof payload.reason !== "string" ||
      (payload.matchedLocationId !== undefined &&
        typeof payload.matchedLocationId !== "string")
    ) {
      return null;
    }
    return {
      action: payload.action as PlaceCandidateReviewAction,
      reason: payload.reason,
      matchedLocationId: payload.matchedLocationId as string | undefined,
    };
  } catch {
    return null;
  }
}
