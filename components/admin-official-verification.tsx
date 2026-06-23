"use client";

import { useMemo, useState } from "react";
import type {
  AdminOfficialVerificationQueue,
  OfficialAccountPlatform,
  OfficialSourceType,
  OfficialVerificationField,
  OfficialVerificationSelection,
} from "@/lib/official-verification";

type Props = {
  initialQueue: AdminOfficialVerificationQueue;
  initialSelection?: OfficialVerificationSelection;
};

const fieldLabels: Record<OfficialVerificationField, string> = {
  address: "주소",
  phone: "전화번호",
  business_hours: "영업시간",
  closure: "영업·폐점 상태",
  menu: "메뉴 판매",
  price: "메뉴 가격",
  facility: "편의정보",
  official_account: "공식 계정",
};

const sourceLabels: Record<OfficialSourceType, string> = {
  official_site: "공식 홈페이지",
  official_sns: "공식 SNS",
  phone: "전화 확인",
  onsite: "현장 확인",
};

const platformLabels: Record<OfficialAccountPlatform, string> = {
  website: "웹사이트",
  instagram: "인스타그램",
  naver_blog: "네이버 블로그",
  naver_place: "네이버 플레이스",
  kakao_channel: "카카오채널",
  youtube: "유튜브",
  other: "기타",
};

export function AdminOfficialVerification({
  initialQueue,
  initialSelection,
}: Props) {
  const initialLocation =
    initialQueue.locations.find(
      (item) => item.id === initialSelection?.locationId,
    ) ?? initialQueue.locations[0];
  const initialField = initialSelection?.field ?? "business_hours";
  const initialMenuId =
    initialField === "menu" || initialField === "price"
      ? initialLocation?.menus.find(
          (item) => item.id === initialSelection?.menuItemId,
        )?.id ?? ""
      : "";
  const [queue, setQueue] = useState(initialQueue);
  const [locationId, setLocationId] = useState(initialLocation?.id ?? "");
  const [field, setField] =
    useState<OfficialVerificationField>(initialField);
  const [menuItemId, setMenuItemId] = useState(initialMenuId);
  const [sourceType, setSourceType] =
    useState<OfficialSourceType>("official_sns");
  const [publisher, setPublisher] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [accountPlatform, setAccountPlatform] =
    useState<OfficialAccountPlatform>("instagram");
  const [accountHandle, setAccountHandle] = useState("");
  const [officialityEvidence, setOfficialityEvidence] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const location =
    queue.locations.find((item) => item.id === locationId) ??
    queue.locations[0];
  const selectedMenu = location?.menus.find((item) => item.id === menuItemId);
  const needsMenu = field === "menu" || field === "price";
  const isWebSource =
    sourceType === "official_site" || sourceType === "official_sns";
  const currentValue = useMemo(
    () => getCurrentValue(field, location, selectedMenu),
    [field, location, selectedMenu],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          field,
          menuItemId: needsMenu ? menuItemId : undefined,
          sourceType,
          publisher,
          sourceUrl: isWebSource ? sourceUrl : undefined,
          publishedAt: publishedAt || undefined,
          effectiveFrom: effectiveFrom || undefined,
          effectiveUntil: effectiveUntil || undefined,
          accountPlatform: isWebSource ? accountPlatform : undefined,
          accountHandle: isWebSource ? accountHandle : undefined,
          officialityEvidence: isWebSource
            ? officialityEvidence
            : undefined,
          note,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AdminOfficialVerificationQueue & { message?: string })
        | { message?: string }
        | null;
      if (
        !response.ok ||
        !payload ||
        !("locations" in payload) ||
        !("actions" in payload)
      ) {
        throw new Error(payload?.message ?? "공식 확인을 등록하지 못했어요.");
      }

      setQueue(payload);
      setNote("");
      setMessage(
        `${location?.name ?? "빵집"}의 ${fieldLabels[field]}을 A등급으로 확인했어요.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "공식 확인을 등록하지 못했어요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!location) {
    return (
      <div className="empty-state">
        <h2>확인할 빵집이 없어요.</h2>
        <p>먼저 외부 장소 후보를 승인해 지점을 등록해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="official-verification-layout">
      <form className="official-verification-form" onSubmit={submit}>
        <div className="admin-detail-heading">
          <div>
            <span className="eyebrow">OFFICIAL SOURCE</span>
            <h2>공식 확인 등록</h2>
          </div>
          <span className="verification-grade grade-a">A</span>
        </div>

        <div className="verification-form-grid">
          <label>
            빵집 지점
            <select
              onChange={(event) => {
                setLocationId(event.target.value);
                setMenuItemId("");
              }}
              value={location.id}
            >
              {queue.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            확인 항목
            <select
              onChange={(event) => {
                setField(event.target.value as OfficialVerificationField);
                setMenuItemId("");
              }}
              value={field}
            >
              {Object.entries(fieldLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {needsMenu ? (
            <label className="wide">
              확인할 메뉴
              <select
                onChange={(event) => setMenuItemId(event.target.value)}
                required
                value={menuItemId}
              >
                <option value="">메뉴 선택</option>
                {location.menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                    {menu.price !== undefined
                      ? ` · ${menu.price.toLocaleString("ko-KR")}원`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="current-verification-value wide">
            <strong>현재 저장값</strong>
            <p>{currentValue}</p>
            <small>
              이 화면은 출처를 등록하는 곳입니다. 값이 다르면 먼저 정보 수정
              제보·검수 흐름에서 값을 고쳐야 합니다.
            </small>
          </div>

          <label>
            확인 방식
            <select
              onChange={(event) => {
                const next = event.target.value as OfficialSourceType;
                setSourceType(next);
                if (next === "official_site") {
                  setAccountPlatform("website");
                } else if (next === "official_sns") {
                  setAccountPlatform("instagram");
                }
              }}
              value={sourceType}
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            발행·확인 주체
            <input
              onChange={(event) => setPublisher(event.target.value)}
              placeholder="예: 멜로우 오븐 공식 인스타그램"
              required
              value={publisher}
            />
          </label>

          {isWebSource ? (
            <>
              <label className="wide">
                원문 URL
                <input
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://..."
                  required
                  type="url"
                  value={sourceUrl}
                />
              </label>
              <label>
                플랫폼
                <select
                  onChange={(event) =>
                    setAccountPlatform(
                      event.target.value as OfficialAccountPlatform,
                    )
                  }
                  value={accountPlatform}
                >
                  {Object.entries(platformLabels).map(([value, label]) => (
                    <option
                      disabled={
                        (sourceType === "official_site" &&
                          value !== "website") ||
                        (sourceType === "official_sns" && value === "website")
                      }
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                계정명
                <input
                  onChange={(event) => setAccountHandle(event.target.value)}
                  placeholder="@bakery"
                  value={accountHandle}
                />
              </label>
              <label className="wide">
                공식 계정 판단 근거
                <textarea
                  onChange={(event) =>
                    setOfficialityEvidence(event.target.value)
                  }
                  placeholder="공식 홈페이지에서 연결된 계정임을 확인"
                  required
                  rows={3}
                  value={officialityEvidence}
                />
              </label>
            </>
          ) : null}

          <label>
            게시 시각
            <input
              onChange={(event) => setPublishedAt(event.target.value)}
              type="datetime-local"
              value={publishedAt}
            />
          </label>
          <label>
            적용 시작
            <input
              onChange={(event) => setEffectiveFrom(event.target.value)}
              type="datetime-local"
              value={effectiveFrom}
            />
          </label>
          <label>
            적용 종료
            <input
              onChange={(event) => setEffectiveUntil(event.target.value)}
              type="datetime-local"
              value={effectiveUntil}
            />
          </label>
          <label className="wide">
            판단 근거
            <textarea
              onChange={(event) => setNote(event.target.value)}
              placeholder="현재 저장된 영업시간과 공식 공지 내용이 일치함"
              required
              rows={4}
              value={note}
            />
          </label>
        </div>

        <button className="primary-action" disabled={submitting} type="submit">
          {submitting ? "등록 중…" : "공식 확인 등록 및 A등급 승격"}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="form-success" role="status">
            {message}
          </p>
        ) : null}
      </form>

      <section className="official-verification-history">
        <div className="admin-list-heading">
          <strong>공식 확인 이력</strong>
          <span>{queue.actions.length}건</span>
        </div>
        {queue.actions.length > 0 ? (
          <ol>
            {queue.actions.map((action) => (
              <li key={action.id}>
                <div>
                  <span className="verification-grade grade-a">A</span>
                  <strong>
                    {action.bakeryName} · {fieldLabels[action.field]}
                  </strong>
                </div>
                {action.menuName ? <span>{action.menuName}</span> : null}
                <p>{action.note}</p>
                <small>
                  {sourceLabels[action.sourceType]} · {action.publisher}
                </small>
                <small>
                  확인{" "}
                  {new Date(action.verifiedAt).toLocaleString("ko-KR")} · 재검토{" "}
                  {new Date(action.nextReviewAt).toLocaleDateString("ko-KR")}
                </small>
                {action.sourceUrl ? (
                  <a href={action.sourceUrl} rel="noreferrer" target="_blank">
                    원문 열기 ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state compact">
            <p>아직 등록된 공식 확인 이력이 없어요.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function getCurrentValue(
  field: OfficialVerificationField,
  location: AdminOfficialVerificationQueue["locations"][number] | undefined,
  menu:
    | AdminOfficialVerificationQueue["locations"][number]["menus"][number]
    | undefined,
) {
  if (!location) {
    return "지점을 선택해 주세요.";
  }
  if (field === "address") return location.roadAddress;
  if (field === "phone") return location.phone ?? "저장된 전화번호 없음";
  if (field === "closure") return `현재 상태: ${location.status}`;
  if (field === "facility") return location.facilities;
  if (field === "menu") {
    return menu
      ? `${menu.name} · 판매 상태 ${menu.availability}`
      : "메뉴를 선택해 주세요.";
  }
  if (field === "price") {
    return menu
      ? `${menu.name} · ${menu.price?.toLocaleString("ko-KR") ?? "가격 미등록"}원`
      : "메뉴를 선택해 주세요.";
  }
  if (field === "official_account") {
    return "입력하는 공식 계정을 현재 지점의 공식 채널로 등록합니다.";
  }
  return "현재 저장된 요일별 영업시간 전체";
}
