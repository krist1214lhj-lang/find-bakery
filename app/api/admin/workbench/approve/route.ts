import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { saveApprovedBakery, type ApproveInput } from "@/lib/workbench-write";

// 로컬 전용: 승인후보 1곳을 DB 저장(active). 미들웨어 + 이 가드로 배포 차단.
export async function POST(request: Request) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  let body: { item?: ApproveInput };
  try {
    body = (await request.json()) as { item?: ApproveInput };
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!body?.item?.name) {
    return NextResponse.json({ message: "item 정보가 필요합니다." }, { status: 400 });
  }

  try {
    const result = await saveApprovedBakery(body.item);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "저장에 실패했습니다." },
      { status: 400 },
    );
  }
}
