import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 로컬 전용 관리자 보호 (이중 잠금).
// 페이지/라우트마다 isDemoAdminEnabled() + notFound() 가드가 이미 있지만,
// 미들웨어로 한 번 더 막아 배포(production)에서는 /admin/* 와 /api/admin/* 를
// 요청 단계에서 즉시 진짜 404 로 차단한다. (본문·제목 등 아무것도 노출 안 됨)
//
// 허용 조건은 isDemoAdminEnabled() 와 동일:
//   개발(NODE_ENV !== "production") 이거나 ENABLE_DEMO_ADMIN === "true" 일 때만 통과.
export function middleware(_request: NextRequest) {
  const adminAllowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEMO_ADMIN === "true";

  if (!adminAllowed) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
