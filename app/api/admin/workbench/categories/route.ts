import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { setLocationCategories } from "@/lib/workbench-write";

// 로컬 전용: 저장된 빵집의 빵 카테고리 연결을 선택값으로 동기화(추가/삭제).
export async function POST(request: Request) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  let body: { locationId?: string; categorySlugs?: unknown };
  try {
    body = (await request.json()) as { locationId?: string; categorySlugs?: unknown };
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!body?.locationId) {
    return NextResponse.json({ message: "locationId가 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(body.categorySlugs)) {
    return NextResponse.json({ message: "categorySlugs 배열이 필요합니다." }, { status: 400 });
  }

  try {
    const categorySlugs = await setLocationCategories(
      body.locationId,
      (body.categorySlugs as unknown[]).map(String),
    );
    return NextResponse.json({ categorySlugs });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "카테고리 저장 실패" },
      { status: 400 },
    );
  }
}
