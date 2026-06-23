import Link from "next/link";
import type { AdminReverificationQueue } from "@/lib/reverification";
import { formatCheckedDate } from "@/lib/verification";

type Props = {
  queue: AdminReverificationQueue;
};

const fieldLabels = {
  address: "주소",
  coordinates: "좌표",
  phone: "전화번호",
  business_hours: "영업시간",
  closure: "영업·폐점 상태",
  menu: "메뉴 판매",
  price: "메뉴 가격",
  facility: "편의정보",
  official_account: "공식 계정",
  fame: "유명세 근거",
} as const;

const stateLabels = {
  conflict: "출처 충돌",
  expired: "재검토 기한 경과",
  "due-soon": "14일 이내 재검토",
} as const;

export function AdminReverificationQueue({ queue }: Props) {
  return (
    <div className="reverification-queue">
      <div className="reverification-summary" aria-label="재검증 현황">
        <div className="is-conflict">
          <strong>{queue.counts.conflict}</strong>
          <span>출처 충돌</span>
        </div>
        <div className="is-expired">
          <strong>{queue.counts.expired}</strong>
          <span>기한 경과</span>
        </div>
        <div className="is-due-soon">
          <strong>{queue.counts.dueSoon}</strong>
          <span>곧 재검토</span>
        </div>
      </div>

      {queue.items.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✓</span>
          <h2>현재 재검증할 항목이 없어요.</h2>
          <p>충돌하거나 14일 안에 재검토할 정보가 생기면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ol className="reverification-list">
          {queue.items.map((item) => (
            <li key={item.id}>
              <div className="reverification-item-heading">
                <div>
                  <span className={`review-status status-${item.state}`}>
                    {stateLabels[item.state]}
                  </span>
                  <h2>{item.bakeryName}</h2>
                </div>
                <span
                  className={`verification-grade grade-${item.effectiveGrade.toLowerCase()}`}
                >
                  {item.effectiveGrade}
                </span>
              </div>

              <dl className="report-facts">
                <div>
                  <dt>확인 항목</dt>
                  <dd>
                    {fieldLabels[item.field]}
                    {item.menuName ? ` · ${item.menuName}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>저장 등급</dt>
                  <dd>
                    {item.storedGrade} → 표시 {item.effectiveGrade}
                  </dd>
                </div>
                <div>
                  <dt>마지막 확인</dt>
                  <dd>{formatCheckedDate(item.verifiedAt)}</dd>
                </div>
                <div>
                  <dt>재검토 기한</dt>
                  <dd>{formatCheckedDate(item.nextReviewAt)}</dd>
                </div>
                <div className="wide">
                  <dt>출처</dt>
                  <dd>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.sourceLabel} ↗
                      </a>
                    ) : (
                      item.sourceLabel
                    )}
                  </dd>
                </div>
                {item.note ? (
                  <div className="wide">
                    <dt>기존 판단 메모</dt>
                    <dd>{item.note}</dd>
                  </div>
                ) : null}
              </dl>

              {item.canUseOfficialFlow ? (
                <Link
                  className="primary-link"
                  href={getVerificationHref(item)}
                >
                  공식 출처로 재확인 →
                </Link>
              ) : (
                <p className="muted-copy">
                  이 항목은 공식 확인 폼의 지원 범위 밖이라 별도 검수가
                  필요합니다.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function getVerificationHref(
  item: AdminReverificationQueue["items"][number],
) {
  const params = new URLSearchParams({
    location: item.locationId,
    field: item.field,
  });
  if (item.menuItemId) {
    params.set("menu", item.menuItemId);
  }
  return `/admin/verifications?${params.toString()}`;
}
