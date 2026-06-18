"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type {
  CorrectionReviewAction,
  CorrectionReportStatus,
} from "@/lib/types";
import {
  CORRECTION_REPORTS_KEY,
  REVIEW_ACTIONS_KEY,
  parseCorrectionReports,
  parseReviewActions,
  reviewCorrectionReport,
} from "@/lib/storage";

export const CORRECTION_CHANGE_EVENT = "bbang-gil:correction-change";
const EMPTY_QUEUE_SNAPSHOT = '["[]","[]"]';

const statusLabels: Record<CorrectionReportStatus, string> = {
  submitted: "접수",
  triaged: "분류 완료",
  "in-review": "확인 중",
  accepted: "승인",
  rejected: "반려",
  duplicate: "중복",
};

const categoryLabels = {
  hours: "영업시간·휴무",
  closure: "폐점",
  relocation: "이전",
  "menu-price": "메뉴·가격",
  "phone-address": "주소·전화번호",
  other: "기타",
} as const;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CORRECTION_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CORRECTION_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    const reports =
      window.localStorage.getItem(CORRECTION_REPORTS_KEY) ?? "[]";
    const actions = window.localStorage.getItem(REVIEW_ACTIONS_KEY) ?? "[]";
    return JSON.stringify([reports, actions]);
  } catch {
    return EMPTY_QUEUE_SNAPSHOT;
  }
}

function getServerSnapshot() {
  return EMPTY_QUEUE_SNAPSHOT;
}

export function AdminReviewQueue() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const reports = useMemo(() => {
    const [reportsRaw] = parseQueueSnapshot(snapshot);
    return parseCorrectionReports(reportsRaw);
  }, [snapshot]);
  const actions = useMemo(() => {
    const [, actionsRaw] = parseQueueSnapshot(snapshot);
    return parseReviewActions(actionsRaw);
  }, [snapshot]);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedReport =
    reports.find((report) => report.id === selectedId) ?? reports[0];
  const selectedActions = selectedReport
    ? actions.filter((action) => action.reportId === selectedReport.id)
    : [];
  const pendingCount = reports.filter(
    (report) =>
      report.status === "submitted" ||
      report.status === "triaged" ||
      report.status === "in-review",
  ).length;

  function review(action: CorrectionReviewAction) {
    if (!selectedReport) {
      return;
    }

    setError("");
    setMessage("");
    try {
      const result = reviewCorrectionReport(
        window.localStorage,
        selectedReport.id,
        action,
        reason,
      );
      window.dispatchEvent(new Event(CORRECTION_CHANGE_EVENT));
      setReason("");
      setMessage(
        `제보를 '${statusLabels[result.report.status]}' 상태로 변경했어요.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "검수 상태를 변경하지 못했어요.",
      );
    }
  }

  if (reports.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">✓</span>
        <h2>검수할 로컬 제보가 없어요.</h2>
        <p>제보 화면에서 접수한 내용이 이곳에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="admin-review-layout">
      <aside className="admin-report-list" aria-label="제보 목록">
        <div className="admin-list-heading">
          <strong>전체 {reports.length}건</strong>
          <span>처리 중 {pendingCount}건</span>
        </div>
        {reports.map((report) => (
          <button
            className={report.id === selectedReport?.id ? "is-selected" : ""}
            key={report.id}
            onClick={() => {
              setSelectedId(report.id);
              setReason("");
              setError("");
              setMessage("");
            }}
            type="button"
          >
            <span>{report.bakeryName}</span>
            <strong>{categoryLabels[report.category]}</strong>
            <small>
              {statusLabels[report.status]} ·{" "}
              {new Date(report.createdAt).toLocaleDateString("ko-KR")}
            </small>
          </button>
        ))}
      </aside>

      {selectedReport ? (
        <section
          className="admin-report-detail"
          aria-labelledby="admin-report-title"
        >
          <div className="admin-detail-heading">
            <div>
              <span className="eyebrow">LOCAL REVIEW QUEUE</span>
              <h2 id="admin-report-title">{selectedReport.bakeryName}</h2>
            </div>
            <span className={`review-status status-${selectedReport.status}`}>
              {statusLabels[selectedReport.status]}
            </span>
          </div>

          <dl className="report-facts">
            <div>
              <dt>제보 유형</dt>
              <dd>{categoryLabels[selectedReport.category]}</dd>
            </div>
            <div>
              <dt>접수 시각</dt>
              <dd>{new Date(selectedReport.createdAt).toLocaleString("ko-KR")}</dd>
            </div>
            <div className="wide">
              <dt>제보 내용</dt>
              <dd>{selectedReport.description}</dd>
            </div>
            <div className="wide">
              <dt>출처</dt>
              <dd>
                {selectedReport.sourceUrl ? (
                  <a
                    href={selectedReport.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    원문 열기 ↗
                  </a>
                ) : (
                  "입력된 링크 없음"
                )}
              </dd>
            </div>
          </dl>

          {selectedReport.status === "accepted" ||
          selectedReport.status === "rejected" ||
          selectedReport.status === "duplicate" ? (
            <p className="review-complete-note">
              이 제보는 처리가 끝났습니다. 변경 이력은 아래에 보존됩니다.
            </p>
          ) : (
            <div className="review-controls">
              <label htmlFor="review-reason">검수 사유</label>
              <textarea
                id="review-reason"
                onChange={(event) => setReason(event.target.value)}
                placeholder="판단 근거를 5자 이상 기록하세요."
                rows={4}
                value={reason}
              />
              <div className="review-actions">
                <button onClick={() => review("hold")} type="button">
                  보류
                </button>
                <button onClick={() => review("mark-duplicate")} type="button">
                  중복
                </button>
                <button
                  className="danger"
                  onClick={() => review("reject")}
                  type="button"
                >
                  반려
                </button>
                <button
                  className="approve"
                  onClick={() => review("approve")}
                  type="button"
                >
                  승인
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
            {selectedActions.length > 0 ? (
              <ol>
                {selectedActions.map((action) => (
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
      ) : null}
    </div>
  );
}

function parseQueueSnapshot(snapshot: string): [string, string] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Invalid browser storage is treated as an empty queue.
  }

  return ["[]", "[]"];
}
