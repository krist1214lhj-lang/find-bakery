import Link from "next/link";
import type { Bakery } from "@/lib/types";
import { formatCheckedDate, getOperatingStatus } from "@/lib/verification";
import { SaveButton } from "./save-button";
import { VerificationBadge } from "./verification-badge";

type BakeryCardProps = {
  bakery: Bakery;
};

export function BakeryCard({ bakery }: BakeryCardProps) {
  const status = getOperatingStatus(bakery);

  return (
    <article className="bakery-card">
      <Link
        className={`bakery-image tone-${bakery.imageTone}`}
        href={`/bakery/${bakery.slug}`}
        aria-label={`${bakery.name} 상세 보기`}
      >
        {/* 정적 카테고리 예시 이미지(7장 고정, 이미 최적 크기) — 이미지 최적화기 비용 회피 위해 일반 img 사용 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="bakery-photo"
          src={bakery.categoryImage}
          alt=""
          loading="lazy"
        />
        <small>예시 이미지</small>
      </Link>
      <div className="bakery-card-content">
        <div className="card-title-row">
          <div>
            <span>{bakery.region}</span>
            <h3>
              <Link href={`/bakery/${bakery.slug}`}>{bakery.name}</Link>
            </h3>
          </div>
          <SaveButton bakeryId={bakery.id} bakeryName={bakery.name} />
        </div>
        <p>{bakery.categories.join(" · ")}</p>
        <div className="card-status">
          <strong>{status.label}</strong>
          <span>{status.description}</span>
        </div>
        <VerificationBadge
          checkedAt={bakery.verification.checkedAt}
          grade={bakery.verification.grade}
          sourceLabel={bakery.verification.sourceLabel}
          state={bakery.verification.state}
        />
        <small className="checked-copy">
          {formatCheckedDate(bakery.verification.checkedAt)} 확인
        </small>
      </div>
    </article>
  );
}
