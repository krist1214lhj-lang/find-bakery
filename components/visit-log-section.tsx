"use client";

import { useState } from "react";
import { VisitForm } from "@/components/visit-form";
import { useVisitLog } from "@/components/visit-log-provider";
import { VisitStars } from "@/components/visit-stars";
import {
  formatVisitDate,
  visitsForBakery,
  type VisitDraft,
  type VisitEntry,
} from "@/lib/visit-log";

type VisitLogSectionProps = {
  bakeryId: string;
  bakeryName: string;
  bakeryRegion: string;
  breadOptions: string[];
};

type Mode = { kind: "idle" } | { kind: "new" } | { kind: "edit"; id: string };

export function VisitLogSection({
  bakeryId,
  bakeryName,
  bakeryRegion,
  breadOptions,
}: VisitLogSectionProps) {
  const { visits, ready, add, update, remove } = useVisitLog();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [status, setStatus] = useState("");
  const myVisits = visitsForBakery(visits, bakeryId);
  const bakery = { bakeryId, bakeryName, bakeryRegion };

  function handleAdd(draft: VisitDraft) {
    const result = add(draft);
    if (!result.ok) return result;
    setMode({ kind: "idle" });
    setStatus("방문 기록을 남겼어요.");
    return { ok: true as const };
  }

  function handleUpdate(visitId: string, draft: VisitDraft) {
    const result = update(visitId, draft);
    if (!result.ok) return result;
    setMode({ kind: "idle" });
    setStatus("방문 기록을 고쳤어요.");
    return { ok: true as const };
  }

  function handleDelete(visit: VisitEntry) {
    if (!window.confirm("이 방문 기록을 정말 지울까요?")) return;
    const result = remove(visit.id);
    setStatus(result.ok ? "방문 기록을 지웠어요." : result.message);
    if (mode.kind === "edit" && mode.id === visit.id) {
      setMode({ kind: "idle" });
    }
  }

  return (
    <section
      aria-labelledby="my-visits-title"
      className="detail-section visit-panel"
      id="my-visits"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">MY VISITS</span>
          <h2 id="my-visits-title">내 방문 기록</h2>
        </div>
        {ready && mode.kind === "idle" ? (
          <button
            className="visit-primary-button"
            onClick={() => {
              setStatus("");
              setMode({ kind: "new" });
            }}
            type="button"
          >
            기록 남기기
          </button>
        ) : null}
      </div>
      <p className="visit-privacy">
        이 기기에만 저장되고 다른 사람에게는 보이지 않아요.
      </p>

      {!ready ? <p className="visit-empty">기록을 불러오고 있어요…</p> : null}

      {mode.kind === "new" ? (
        <VisitForm
          bakery={bakery}
          breadOptions={breadOptions}
          onCancel={() => setMode({ kind: "idle" })}
          onSubmit={handleAdd}
          submitLabel="기록 저장"
        />
      ) : null}

      {ready && myVisits.length === 0 && mode.kind !== "new" ? (
        <p className="visit-empty">
          아직 남긴 기록이 없어요. 다녀왔다면 별점과 한 줄평을 남겨 보세요.
        </p>
      ) : null}

      {myVisits.length > 0 ? (
        <ol className="visit-list">
          {myVisits.map((visit) =>
            mode.kind === "edit" && mode.id === visit.id ? (
              <li key={visit.id}>
                <VisitForm
                  bakery={bakery}
                  breadOptions={breadOptions}
                  initial={visit}
                  onCancel={() => setMode({ kind: "idle" })}
                  onSubmit={(draft) => handleUpdate(visit.id, draft)}
                  submitLabel="고친 내용 저장"
                />
              </li>
            ) : (
              <li className="visit-item" key={visit.id}>
                <div className="visit-item-head">
                  <strong>{formatVisitDate(visit.visitedOn)} 방문</strong>
                  <VisitStars rating={visit.rating} />
                </div>
                {visit.breads.length > 0 ? (
                  <ul aria-label="먹은 빵" className="visit-breads">
                    {visit.breads.map((bread) => (
                      <li key={bread}>{bread}</li>
                    ))}
                  </ul>
                ) : null}
                {visit.note ? <p className="visit-note">{visit.note}</p> : null}
                <div className="visit-item-actions">
                  <button
                    aria-label={`${formatVisitDate(visit.visitedOn)} 기록 수정`}
                    onClick={() => {
                      setStatus("");
                      setMode({ kind: "edit", id: visit.id });
                    }}
                    type="button"
                  >
                    수정
                  </button>
                  <button
                    aria-label={`${formatVisitDate(visit.visitedOn)} 기록 삭제`}
                    onClick={() => handleDelete(visit)}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      ) : null}

      <p aria-live="polite" className="form-success visit-status">
        {status}
      </p>
    </section>
  );
}
