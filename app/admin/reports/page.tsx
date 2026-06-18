import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminReviewQueue } from "@/components/admin-review-queue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "제보 검수",
};

export default function AdminReportsPage() {
  const demoAdminEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEMO_ADMIN === "true";

  if (!demoAdminEnabled) {
    notFound();
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">ADMIN PREVIEW</span>
        <h1>정보 제보 검수</h1>
        <p>
          현재는 이 브라우저에 접수된 로컬 제보만 표시합니다. 운영 배포에서는
          인증된 검수자와 Supabase RPC를 사용합니다.
        </p>
      </div>
      <AdminReviewQueue />
    </section>
  );
}
