import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CorrectionForm } from "@/components/correction-form";
import { getBakeryBySlug } from "@/lib/bakery-repository";

type CorrectionPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CorrectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bakery = await getBakeryBySlug(slug);

  return {
    title: bakery ? `${bakery.name} 정보 수정 제보` : "정보 수정 제보",
  };
}

export default async function CorrectionPage({ params }: CorrectionPageProps) {
  const { slug } = await params;
  const bakery = await getBakeryBySlug(slug);

  if (!bakery) {
    notFound();
  }

  return (
    <section className="page-section report-page">
      <Link className="back-link" href={`/bakery/${bakery.slug}`}>
        ← 빵집 상세로 돌아가기
      </Link>
      <span className="eyebrow">CORRECTION REPORT</span>
      <h1>정보 수정 제보</h1>
      <p className="page-intro">
        {bakery.name}의 실제 정보와 다른 내용을 알려주세요. 제출 즉시 확정
        정보로 반영하지 않고 출처를 확인한 뒤 검수합니다.
      </p>
      <CorrectionForm bakeryId={bakery.id} bakeryName={bakery.name} />
    </section>
  );
}
