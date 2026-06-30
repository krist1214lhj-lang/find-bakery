import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveButton } from "@/components/save-button";
import { VerificationBadge } from "@/components/verification-badge";
import { getBakeryBySlug } from "@/lib/bakery-repository";
import type { VerificationSummary } from "@/lib/types";
import { formatCheckedDate, getOperatingStatus } from "@/lib/verification";

type BakeryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: BakeryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bakery = await getBakeryBySlug(slug);

  return {
    title: bakery?.name ?? "빵집을 찾을 수 없음",
    description: bakery
      ? `${bakery.region} ${bakery.name}의 영업 정보와 대표 메뉴`
      : undefined,
  };
}

export default async function BakeryDetailPage({
  params,
}: BakeryDetailPageProps) {
  const { slug } = await params;
  const bakery = await getBakeryBySlug(slug);

  if (!bakery) {
    notFound();
  }

  const operatingStatus = getOperatingStatus(bakery);

  return (
    <article className="detail-page">
      <div className={`detail-hero tone-${bakery.imageTone}`}>
        {/* 정적 카테고리 예시 이미지 — 이미지 최적화기 비용 회피 위해 일반 img 사용 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="detail-hero-photo" src={bakery.categoryImage} alt="" />
        <div className="detail-hero-label">예시 이미지</div>
      </div>

      <div className="detail-content">
        <Link className="back-link" href="/explore">
          ← 탐색으로 돌아가기
        </Link>
        <div className="detail-title-row">
          <div>
            <span className="eyebrow">{bakery.region}</span>
            <h1>{bakery.name}</h1>
            <p>{bakery.roadAddress}</p>
          </div>
          <SaveButton bakeryId={bakery.id} bakeryName={bakery.name} />
        </div>

        <div className="status-line">
          <strong>{operatingStatus.label}</strong>
          <span>{operatingStatus.description}</span>
        </div>

        <section className="verification-panel" aria-labelledby="verify-title">
          <div>
            <span className="eyebrow">VERIFIED INFO</span>
            <h2 id="verify-title">핵심 방문 정보 확인 기록</h2>
          </div>
          <VerificationBadge
            checkedAt={bakery.verification.checkedAt}
            grade={bakery.verification.grade}
            sourceLabel={bakery.verification.sourceLabel}
            state={bakery.verification.state}
          />
          <p>{getVerificationCopy(bakery.verification)}</p>
          {bakery.verification.sourceUrl ? (
            <a
              href={bakery.verification.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              공식 원문 보기 ↗
            </a>
          ) : (
            <span className="muted-copy">공개 원문 링크 확인 중</span>
          )}
        </section>

        <div className="action-grid">
          <a
            href={`https://map.kakao.com/link/to/${encodeURIComponent(
              bakery.name,
            )},${bakery.latitude},${bakery.longitude}`}
            rel="noreferrer"
            target="_blank"
          >
            길찾기
          </a>
          {bakery.phone ? (
            <a href={`tel:${bakery.phone.replaceAll("-", "")}`}>전화</a>
          ) : (
            <span className="disabled-action">전화번호 확인 중</span>
          )}
          <SaveButton
            bakeryId={bakery.id}
            bakeryName={bakery.name}
            variant="action"
          />
        </div>

        <section className="detail-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SIGNATURE</span>
              <h2>꼭 먹어볼 빵</h2>
            </div>
          </div>
          {bakery.menus.length > 0 ? (
            <div className="menu-grid">
              {bakery.menus.map((menu) => (
                <div className="menu-card" key={menu.id}>
                  <span aria-hidden="true">{menu.emoji}</span>
                  <h3>{menu.name}</h3>
                  <strong>
                    {menu.price === undefined
                      ? "가격 확인 중"
                      : `${menu.price.toLocaleString("ko-KR")}원`}
                  </strong>
                  <small>
                    {menu.checkedAt
                      ? `${formatCheckedDate(menu.checkedAt)} 가격 확인`
                      : "가격 확인일 준비 중"}
                  </small>
                </div>
              ))}
            </div>
          ) : bakery.signatures.length > 0 ? (
            <div className="menu-grid">
              {bakery.signatures.map((signature) => (
                <div className="menu-card" key={signature.slug}>
                  <span aria-hidden="true">{signature.emoji}</span>
                  <h3>{signature.name}</h3>
                  <small className="signature-evidence">
                    {signature.evidence}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="menu-empty">
              <p>아직 정리된 대표 메뉴 정보가 없어요.</p>
              {bakery.categories.length > 0 ? (
                <small>대표 빵 종류: {bakery.categories.join(" · ")}</small>
              ) : null}
            </div>
          )}
        </section>

        <section className="detail-section info-grid">
          <div>
            <span className="eyebrow">TODAY</span>
            <h2>오늘의 영업 정보</h2>
            <p className="large-copy">{operatingStatus.hoursLabel}</p>
            <p>
              {operatingStatus.notice
                ? operatingStatus.notice
                : bakery.scheduleNote}
            </p>
          </div>
          <div>
            <span className="eyebrow">FACILITIES</span>
            <h2>편의 정보</h2>
            <ul className="plain-list">
              {bakery.facilities.map((facility) => (
                <li key={facility}>{facility}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="detail-section fame-panel">
          <span className="eyebrow">WHY FAMOUS</span>
          <h2>이곳이 알려진 이유</h2>
          <p>{bakery.fameReason}</p>
          <small>편집 근거: {bakery.fameSource}</small>
        </section>

        <section className="correction-panel">
          <div>
            <h2>정보가 실제와 다른가요?</h2>
            <p>영업시간, 폐점, 메뉴 가격의 변경을 알려주세요.</p>
          </div>
          <Link href={`/bakery/${bakery.slug}/report`}>수정 제보</Link>
        </section>
      </div>
    </article>
  );
}

function getVerificationCopy(verification: VerificationSummary) {
  const checkedDate = formatCheckedDate(verification.checkedAt);
  if (verification.state === "conflict") {
    return `${checkedDate} 확인 정보가 다른 출처와 충돌해 재검토 중이에요.`;
  }
  if (verification.state === "expired") {
    return `${checkedDate} 확인 정보의 재검토 기한이 지났어요. 방문 전 원문을 다시 확인해 주세요.`;
  }
  if (verification.state === "due-soon") {
    return `${checkedDate}에 ${verification.sourceLabel}에서 확인했으며 곧 재검토할 예정이에요.`;
  }
  if (verification.state === "unverified") {
    return "현재 공개할 수 있는 검증 기록이 없어 확인이 필요해요.";
  }
  return `${checkedDate}에 ${verification.sourceLabel}에서 영업 정보를 확인했어요.`;
}
