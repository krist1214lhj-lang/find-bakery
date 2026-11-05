"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useVisitLog } from "@/components/visit-log-provider";
import { VisitStars } from "@/components/visit-stars";
import type { Bakery } from "@/lib/types";
import {
  exportVisits,
  formatVisitDate,
  summarizeVisitedBakeries,
  todayInSeoul,
  type ImportResult,
} from "@/lib/visit-log";

const IMPORT_FILE_LIMIT = 2_000_000;

export function VisitedBakeryList({ bakeries }: { bakeries: Bakery[] }) {
  const { visits, ready, importText } = useVisitLog();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const bakeryById = useMemo(
    () => new Map(bakeries.map((bakery) => [bakery.id, bakery])),
    [bakeries],
  );
  const summaries = useMemo(
    () => summarizeVisitedBakeries(visits, new Set(bakeryById.keys())),
    [bakeryById, visits],
  );

  function handleExport() {
    const blob = new Blob([exportVisits(visits)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `빵길-방문기록-${todayInSeoul()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setError("");
    setMessage(`방문 기록 ${visits.length}개를 파일로 내보냈어요.`);
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage("");
    if (file.size > IMPORT_FILE_LIMIT) {
      setError(
        "파일이 너무 커요. 빵길에서 내보낸 기록 파일인지 확인해 주세요.",
      );
      return;
    }

    const result = importText(await file.text());
    if (result.ok) {
      setError("");
      setMessage(describeImport(result.value));
    } else {
      setError(result.message);
    }
  }

  if (!ready) {
    return (
      <div className="empty-state compact-state" aria-live="polite">
        <span aria-hidden="true">…</span>
        <h2>방문 기록을 불러오고 있어요.</h2>
      </div>
    );
  }

  return (
    <>
      <div className="visit-backup">
        <p>
          방문 기록은 이 기기에만 저장돼요. 브라우저 데이터를 지우거나 기기를
          바꾸면 사라지니, 가끔 파일로 내보내 두세요.
        </p>
        <div className="visit-backup-actions">
          <button
            className="visit-primary-button"
            disabled={visits.length === 0}
            onClick={handleExport}
            type="button"
          >
            기록 파일로 내보내기
          </button>
          <button
            className="visit-secondary-button"
            onClick={() => fileInput.current?.click()}
            type="button"
          >
            불러오기
          </button>
          <input
            accept="application/json,.json"
            aria-hidden="true"
            className="sr-only"
            onChange={handleImport}
            ref={fileInput}
            tabIndex={-1}
            type="file"
          />
        </div>
        <p aria-live="polite" className="form-success">
          {message}
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {summaries.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✎</span>
          <h2>아직 다녀온 빵집 기록이 없어요.</h2>
          <p>
            빵집 상세 페이지의 &lsquo;내 방문 기록&rsquo;에서 남길 수 있어요.
          </p>
          <Link className="primary-link" href="/explore">
            빵집 둘러보기
          </Link>
        </div>
      ) : (
        <>
          <p className="saved-summary">{summaries.length}곳을 다녀왔어요.</p>
          <ul className="visited-list">
            {summaries.map((summary) => {
              const bakery = summary.isPublic
                ? bakeryById.get(summary.bakeryId)
                : undefined;
              const body = (
                <>
                  <span className="visited-region">
                    {bakery?.region ?? summary.bakeryRegion}
                  </span>
                  <strong>{bakery?.name ?? summary.bakeryName}</strong>
                  <span className="visited-meta">
                    <VisitStars rating={summary.latestRating} />
                    <span>
                      방문 {summary.visitCount}회 · 최근{" "}
                      {formatVisitDate(summary.latestVisitedOn)}
                    </span>
                  </span>
                  {bakery ? null : (
                    <span className="visited-hidden-badge">
                      현재 정보 비공개
                    </span>
                  )}
                </>
              );

              return (
                <li
                  className={bakery ? "visited-item" : "visited-item is-hidden"}
                  key={summary.bakeryId}
                >
                  {bakery ? (
                    <Link href={`/bakery/${bakery.slug}#my-visits`}>
                      {body}
                    </Link>
                  ) : (
                    <div>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function describeImport(result: ImportResult) {
  const loaded: string[] = [];
  if (result.added) loaded.push(`새 기록 ${result.added}개`);
  if (result.updated) loaded.push(`더 최근에 고친 기록 ${result.updated}개`);

  let text = loaded.length
    ? `${loaded.join(", ")}를 불러왔어요.`
    : "새로 불러올 기록이 없었어요.";
  if (result.unchanged)
    text += ` 이미 있는 ${result.unchanged}개는 그대로 뒀어요.`;
  if (result.invalid)
    text += ` 읽을 수 없는 ${result.invalid}개는 건너뛰었어요.`;
  return text;
}
