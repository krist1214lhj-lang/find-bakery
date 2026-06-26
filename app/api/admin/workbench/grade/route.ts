import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { setManualGrade, type GradeEvidence } from "@/lib/workbench-write";

// 로컬 전용: 저장된 빵집에 등급(A/B/C/D) 부여 → 뺑드미와 동일 구조로 검증기록 작성.
// evidence 가 함께 오면(정밀 검증 "적용") 출처·근거까지 기록한다.
export async function POST(request: Request) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  let body: { locationId?: string; grade?: string; evidence?: GradeEvidence | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!body?.locationId || !body?.grade) {
    return NextResponse.json({ message: "locationId와 grade가 필요합니다." }, { status: 400 });
  }

  try {
    const result = await setManualGrade(body.locationId, body.grade, body.evidence ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "등급 부여 실패" },
      { status: 400 },
    );
  }
}
