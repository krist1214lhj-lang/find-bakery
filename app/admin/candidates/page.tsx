import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPlaceCandidateQueue } from "@/components/admin-place-candidate-queue";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { getAdminPlaceCandidateQueue } from "@/lib/place-candidate-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "장소 후보 검수",
};

export default async function AdminCandidatesPage() {
  if (!isDemoAdminEnabled()) {
    notFound();
  }

  const queue = await getAdminPlaceCandidateQueue();
  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">PLACE CANDIDATE REVIEW</span>
        <h1>외부 빵집 후보 검수</h1>
        <p>
          카카오 장소 후보를 기존 지점과 비교하고 승인·반려·중복 처리합니다.
          승인된 후보만 확인 필요 상태로 공개됩니다.
        </p>
        <nav className="admin-page-links" aria-label="관리자 화면">
          <Link href="/admin/reverification">재검증 대기열</Link>
          <Link href="/admin/reports">사용자 제보</Link>
          <Link href="/admin/verifications">공식 출처 확인</Link>
        </nav>
      </div>
      <AdminPlaceCandidateQueue initialQueue={queue} />
    </section>
  );
}
