import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminReverificationQueue } from "@/components/admin-reverification-queue";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { getAdminReverificationQueue } from "@/lib/reverification-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "재검증 대기열",
};

export default async function AdminReverificationPage() {
  if (!isDemoAdminEnabled()) {
    notFound();
  }

  const queue = await getAdminReverificationQueue();
  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">REVERIFICATION QUEUE</span>
        <h1>정보 재검증 대기열</h1>
        <p>
          출처가 충돌하거나 재검토 기한이 지났거나 14일 안에 도래하는 항목을
          우선순위대로 확인합니다.
        </p>
        <nav className="admin-page-links" aria-label="관리자 화면">
          <Link href="/admin/verifications">공식 출처 확인</Link>
          <Link href="/admin/candidates">외부 후보</Link>
          <Link href="/admin/reports">사용자 제보</Link>
        </nav>
      </div>
      <AdminReverificationQueue queue={queue} />
    </section>
  );
}
