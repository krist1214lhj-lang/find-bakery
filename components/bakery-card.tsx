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
        <span aria-hidden="true">{bakery.heroEmoji}</span>
        <small>사진 준비 중</small>
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
        />
        <small className="checked-copy">
          {formatCheckedDate(bakery.verification.checkedAt)} 확인
        </small>
      </div>
    </article>
  );
}
