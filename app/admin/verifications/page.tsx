import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOfficialVerification } from "@/components/admin-official-verification";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { getAdminOfficialVerificationQueue } from "@/lib/official-verification-repository";
import {
  officialVerificationFields,
  type OfficialVerificationField,
} from "@/lib/official-verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공식 출처 확인",
};

type Props = {
  searchParams: Promise<{
    location?: string | string[];
    field?: string | string[];
    menu?: string | string[];
  }>;
};

export default async function AdminVerificationsPage({ searchParams }: Props) {
  if (!isDemoAdminEnabled()) {
    notFound();
  }

  const [queue, query] = await Promise.all([
    getAdminOfficialVerificationQueue(),
    searchParams,
  ]);
  const locationId = getSingleValue(query.location);
  const fieldValue = getSingleValue(query.field);
  const menuItemId = getSingleValue(query.menu);
  const field = officialVerificationFields.includes(
    fieldValue as OfficialVerificationField,
  )
    ? (fieldValue as OfficialVerificationField)
    : undefined;

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">SOURCE VERIFICATION</span>
        <h1>공식 출처 확인</h1>
        <p>
          공식 홈페이지·SNS·전화·현장 확인을 현재 저장값에 연결하고 항목별
          A등급과 재검토 기한을 생성합니다.
        </p>
        <nav className="admin-page-links" aria-label="관리자 화면">
          <Link href="/admin/reverification">재검증 대기열</Link>
          <Link href="/admin/candidates">외부 후보</Link>
          <Link href="/admin/reports">사용자 제보</Link>
        </nav>
      </div>
      <AdminOfficialVerification
        initialQueue={queue}
        initialSelection={{ locationId, field, menuItemId }}
      />
    </section>
  );
}

function getSingleValue(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}
