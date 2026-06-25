import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminWorkbench } from "@/components/admin-workbench";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { loadWorkbench } from "@/lib/workbench";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "빵집 작업대 (로컬 전용)",
  robots: { index: false, follow: false },
};

export default async function AdminWorkbenchPage() {
  // 로컬(dev)에서만 열림. 배포(production)에서는 404로 차단 — 기존 admin 페이지와 동일.
  if (!isDemoAdminEnabled()) {
    notFound();
  }

  const data = loadWorkbench();
  const mapApiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;

  return (
    <>
      <nav className="admin-page-links" aria-label="관리자 화면" style={{ marginBottom: 12 }}>
        <Link href="/admin/candidates">장소 후보 검수</Link>
        <Link href="/admin/reports">사용자 제보</Link>
        <Link href="/admin/verifications">공식 출처 확인</Link>
      </nav>
      <AdminWorkbench {...data} mapApiKey={mapApiKey} />
    </>
  );
}
