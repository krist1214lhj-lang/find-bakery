"use client";

import { useState } from "react";
import type {
  PlaceCandidateRegistryEvidence,
  PlaceCandidateReviewAction,
  StoredPlaceCandidate,
  StoredPlaceCandidateReviewAction,
  StoredPlaceCandidateStatus,
} from "@/lib/place-provider";
import type { StoreRegistryMatch } from "@/lib/store-registry-provider";

type CandidateQueue = {
  candidates: StoredPlaceCandidate[];
  actions: StoredPlaceCandidateReviewAction[];
};

type Props = {
  initialQueue: CandidateQueue;
};

const statusLabels: Record<StoredPlaceCandidateStatus, string> = {
  discovered: "접수",
  "in-review": "확인 중",
  approved: "승인",
  rejected: "반려",
  duplicate: "중복",
};

export function AdminPlaceCandidateQueue({ initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState(
    initialQueue.candidates[0]?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [duplicateLocationId, setDuplicateLocationId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [crossChecking, setCrossChecking] = useState(false);
  const [registryMatches, setRegistryMatches] = useState<
    PlaceCandidateRegistryEvidence[]
  >(initialQueue.candidates[0]?.registryEvidence ?? []);

  const candidate =
    queue.candidates.find((item) => item.id === selectedId) ??
    queue.candidates[0];
  const history = candidate
    ? queue.actions.filter((action) => action.candidateId === candidate.id)
    : [];

  async function review(action: PlaceCandidateReviewAction) {
    if (!candidate || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
          matchedLocationId:
            action === "mark-duplicate" ? duplicateLocationId : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (CandidateQueue & { message?: string })
        | { message?: string }
        | null;
      if (
        !response.ok ||
        !payload ||
        !("candidates" in payload) ||
        !("actions" in payload)
      ) {
        throw new Error(payload?.message ?? "후보를 처리하지 못했어요.");
      }

      setQueue(payload);
      setReason("");
      setDuplicateLocationId("");
      const updated = payload.candidates.find(
        (item) => item.id === candidate.id,
      );
      setMessage(
        `후보를 '${statusLabels[updated?.status ?? candidate.status]}' 상태로 변경했어요.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "후보를 처리하지 못했어요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function crossCheck() {
    if (!candidate || crossChecking) {
      return;
    }

    setCrossChecking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/candidates/${candidate.id}/cross-check`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        matches?: StoreRegistryMatch[];
        message?: string;
      } | null;
      if (!response.ok || !payload?.matches) {
        throw new Error(
          payload?.message ?? "공공데이터 교차 확인에 실패했어요.",
        );
      }

      setRegistryMatches(
        payload.matches.map((match) => ({
          id: `${match.provider}:${match.externalId}`,
          provider: match.provider,
          externalId: match.externalId,
          name: match.name,
          roadAddress: match.roadAddress,
          lotAddress: match.lotAddress,
          score: match.score,
          reasons: match.reasons,
          retrievedAt: match.retrievedAt,
        })),
      );
      setMessage(
        payload.matches.length > 0
          ? `공공 상가정보에서 일치 후보 ${payload.matches.length}건을 찾았어요.`
          : "공공 상가정보에서 강한 일치 후보를 찾지 못했어요.",
      );
    } catch (cause) {
      setRegistryMatches([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "공공데이터 교차 확인에 실패했어요.",
      );
    } finally {
      setCrossChecking(false);
    }
  }

  if (!candidate) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">✓</span>
        <h2>검수할 장소 후보가 없어요.</h2>
        <p>탐색 화면에서 `검수 요청`한 장소가 이곳에 표시됩니다.</p>
      </div>
    );
  }

  const resolved = ["approved", "rejected", "duplicate"].includes(
    candidate.status,
  );

  return (
    <div className="admin-review-layout">
      <aside className="admin-report-list" aria-label="장소 후보 목록">
        <div className="admin-list-heading">
          <strong>전체 {queue.candidates.length}건</strong>
          <span>
            처리 중{" "}
            {
              queue.candidates.filter((item) =>
                ["discovered", "in-review"].includes(item.status),
              ).length
            }
            건
          </span>
        </div>
        {queue.candidates.map((item) => (
          <button
            className={item.id === candidate.id ? "is-selected" : ""}
            key={item.id}
            onClick={() => {
              setSelectedId(item.id);
              setReason("");
              setDuplicateLocationId("");
              setMessage("");
              setError("");
              setRegistryMatches(item.registryEvidence);
            }}
            type="button"
          >
            <span>
              {item.regionLevel1} {item.regionLevel2}
            </span>
            <strong>{item.name}</strong>
            <small>
              {statusLabels[item.status]} ·{" "}
              {new Date(item.createdAt).toLocaleDateString("ko-KR")}
            </small>
          </button>
        ))}
      </aside>

      <section className="admin-report-detail">
        <div className="admin-detail-heading">
          <div>
            <span className="eyebrow">KAKAO CANDIDATE</span>
            <h2>{candidate.name}</h2>
          </div>
          <span className={`review-status status-${candidate.status}`}>
            {statusLabels[candidate.status]}
          </span>
        </div>

        <dl className="report-facts">
          <div className="wide">
            <dt>주소</dt>
            <dd>{candidate.roadAddress ?? candidate.address}</dd>
          </div>
          <div>
            <dt>전화</dt>
            <dd>{candidate.phone ?? "확인 필요"}</dd>
          </div>
          <div>
            <dt>카테고리</dt>
            <dd>{candidate.category}</dd>
          </div>
          <div>
            <dt>좌표</dt>
            <dd>
              {candidate.latitude}, {candidate.longitude}
            </dd>
          </div>
          <div>
            <dt>마지막 조회</dt>
            <dd>{new Date(candidate.retrievedAt).toLocaleString("ko-KR")}</dd>
          </div>
          <div className="wide">
            <dt>원문</dt>
            <dd>
              <a href={candidate.placeUrl} rel="noreferrer" target="_blank">
                카카오맵에서 확인 ↗
              </a>
            </dd>
          </div>
        </dl>

        <div className="candidate-duplicate-panel">
          <h3>기존 지점 중복 후보</h3>
          {candidate.possibleDuplicates.length > 0 ? (
            <label>
              병합할 기존 지점
              <select
                disabled={resolved}
                onChange={(event) => setDuplicateLocationId(event.target.value)}
                value={duplicateLocationId}
              >
                <option value="">선택하지 않음</option>
                {candidate.possibleDuplicates.map((duplicate) => (
                  <option
                    key={duplicate.locationId}
                    value={duplicate.locationId}
                  >
                    {duplicate.name} · {duplicate.score}점 ·{" "}
                    {duplicate.reasons.join(", ")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>상호·주소·전화·좌표 기준으로 강한 중복 후보가 없습니다.</p>
          )}
        </div>

        <div className="candidate-duplicate-panel">
          <div className="candidate-panel-heading">
            <div>
              <h3>소상공인 상가정보 교차 확인</h3>
              <p>상호·주소·좌표와 제과·제빵 업종을 독립 출처에서 비교합니다.</p>
            </div>
            <button disabled={crossChecking} onClick={crossCheck} type="button">
              {crossChecking ? "확인 중…" : "공공데이터 확인"}
            </button>
          </div>
          {registryMatches.length > 0 ? (
            <ol className="candidate-match-list">
              {registryMatches.map((match) => (
                <li key={match.externalId}>
                  <strong>
                    {match.name} · {match.score}점
                  </strong>
                  <span>{match.roadAddress ?? match.lotAddress}</span>
                  <small>{match.reasons.join(" · ")}</small>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {resolved ? (
          <p className="review-complete-note">
            이 후보는 처리가 끝났습니다. 승인된 장소는 확인 필요 상태로
            공개되고, 추가 출처 검증 대상이 됩니다.
          </p>
        ) : (
          <div className="review-controls">
            <label htmlFor="candidate-review-reason">검수 사유</label>
            <textarea
              id="candidate-review-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="판단 근거를 5자 이상 기록하세요."
              rows={4}
              value={reason}
            />
            <div className="review-actions">
              <button
                disabled={submitting}
                onClick={() => review("hold")}
                type="button"
              >
                보류
              </button>
              <button
                disabled={submitting || !duplicateLocationId}
                onClick={() => review("mark-duplicate")}
                type="button"
              >
                기존 지점과 병합
              </button>
              <button
                className="danger"
                disabled={submitting}
                onClick={() => review("reject")}
                type="button"
              >
                반려
              </button>
              <button
                className="approve"
                disabled={submitting}
                onClick={() => review("approve")}
                type="button"
              >
                {submitting ? "처리 중…" : "승인·정식 등록"}
              </button>
            </div>
          </div>
        )}

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

        <div className="review-history">
          <h3>검수 이력</h3>
          {history.length > 0 ? (
            <ol>
              {history.map((action) => (
                <li key={action.id}>
                  <strong>
                    {statusLabels[action.previousStatus]} →{" "}
                    {statusLabels[action.nextStatus]}
                  </strong>
                  <span>{action.reason}</span>
                  <small>
                    {new Date(action.createdAt).toLocaleString("ko-KR")}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p>아직 기록된 검수 작업이 없어요.</p>
          )}
        </div>
      </section>
    </div>
  );
}
