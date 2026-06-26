import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { researchBakeryGrade } from "@/lib/verification-research";

// 로컬 전용: 저장된 빵집 "정밀 검증" — Claude 웹검색으로 등급을 제안만 한다(DB 쓰기 없음).
// 실제 등급 적용은 사용자가 결과를 보고 /api/admin/workbench/grade 로 별도 요청.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  let body: {
    name?: string;
    region?: string | null;
    roadAddress?: string | null;
    category?: string | null;
    placeUrl?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!body?.name?.trim()) {
    return NextResponse.json({ message: "빵집 이름(name)이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await researchBakeryGrade({
      name: body.name,
      region: body.region ?? null,
      roadAddress: body.roadAddress ?? null,
      category: body.category ?? null,
      placeUrl: body.placeUrl ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "정밀 검증 실패" },
      { status: 400 },
    );
  }
}
