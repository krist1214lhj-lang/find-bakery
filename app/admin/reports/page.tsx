import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminReviewQueue } from "@/components/admin-review-queue";
import {
  getAdminReportQueue,
  isDemoAdminEnabled,
} from "@/lib/admin-report-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "제보 검수",
};

export default async function AdminReportsPage() {
  if (!isDemoAdminEnabled()) {
    notFound();
  }

  const queue = await getAdminReportQueue();

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">ADMIN PREVIEW</span>
        <h1>정보 제보 검수</h1>
        <p>
          Supabase에 접수된 제보를 확인하고 검수 RPC로 상태와 감사 이력을 함께
          변경합니다.
        </p>
        <nav className="admin-page-links" aria-label="관리자 화면">
          <Link href="/admin/reverification">재검증 대기열</Link>
          <Link href="/admin/candidates">외부 후보</Link>
          <Link href="/admin/verifications">공식 출처 확인</Link>
        </nav>
      </div>
      <AdminReviewQueue initialQueue={queue} />
    </section>
  );
}
