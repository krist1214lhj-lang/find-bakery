"use client";

import { useId, useState } from "react";
import {
  VISIT_BREAD_NAME_MAX,
  VISIT_NOTE_MAX,
  todayInSeoul,
  type VisitDraft,
} from "@/lib/visit-log";

type FormResult = { ok: true } | { ok: false; message: string };

type VisitFormProps = {
  bakery: Pick<VisitDraft, "bakeryId" | "bakeryName" | "bakeryRegion">;
  breadOptions: string[];
  initial?: Pick<VisitDraft, "rating" | "note" | "breads" | "visitedOn">;
  submitLabel: string;
  onSubmit: (draft: VisitDraft) => FormResult;
  onCancel: () => void;
};

export function VisitForm({
  bakery,
  breadOptions,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: VisitFormProps) {
  const formId = useId();
  const today = todayInSeoul();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [visitedOn, setVisitedOn] = useState(initial?.visitedOn ?? today);
  const [breads, setBreads] = useState<string[]>(initial?.breads ?? []);
  const [customBread, setCustomBread] = useState("");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const chipNames = [...new Set([...breadOptions, ...breads])];

  function toggleBread(name: string) {
    setBreads((current) =>
      current.includes(name)
        ? current.filter((bread) => bread !== name)
        : [...current, name],
    );
  }

  function addCustomBread() {
    const name = customBread.trim();
    if (!name) return;
    setBreads((current) =>
      current.includes(name) ? current : [...current, name],
    );
    setCustomBread("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSubmit({
      ...bakery,
      rating,
      note,
      breads,
      visitedOn,
    });
    setError(result.ok ? "" : result.message);
  }

  return (
    <form className="visit-form" noValidate onSubmit={handleSubmit}>
      <fieldset>
        <legend>별점</legend>
        <div className="star-input">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value}>
              <input
                checked={rating === value}
                name={`${formId}-rating`}
                onChange={() => setRating(value)}
                type="radio"
                value={value}
              />
              <span
                aria-hidden="true"
                className={value <= rating ? "is-on" : undefined}
              >
                ★
              </span>
              <span className="sr-only">{value}점</span>
            </label>
          ))}
          <span className="star-input-label" aria-hidden="true">
            {rating ? `${rating}점` : "눌러서 골라 주세요"}
          </span>
        </div>
      </fieldset>

      <label className="field-label" htmlFor={`${formId}-date`}>
        방문 날짜
      </label>
      <input
        id={`${formId}-date`}
        max={today}
        onChange={(event) => setVisitedOn(event.target.value)}
        type="date"
        value={visitedOn}
      />

      <fieldset>
        <legend>
          먹은 빵 <span className="field-optional">(선택)</span>
        </legend>
        {chipNames.length > 0 ? (
          <div className="bread-chips">
            {chipNames.map((name) => {
              const selected = breads.includes(name);
              return (
                <button
                  aria-pressed={selected}
                  className={selected ? "bread-chip is-selected" : "bread-chip"}
                  key={name}
                  onClick={() => toggleBread(name)}
                  type="button"
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="bread-custom">
          <label className="sr-only" htmlFor={`${formId}-bread`}>
            목록에 없는 빵 이름
          </label>
          <input
            id={`${formId}-bread`}
            maxLength={VISIT_BREAD_NAME_MAX}
            onChange={(event) => setCustomBread(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addCustomBread();
              }
            }}
            placeholder="목록에 없는 빵 이름"
            type="text"
            value={customBread}
          />
          <button onClick={addCustomBread} type="button">
            추가
          </button>
        </div>
      </fieldset>

      <label className="field-label" htmlFor={`${formId}-note`}>
        한 줄평 <span>(선택)</span>
      </label>
      <textarea
        id={`${formId}-note`}
        maxLength={VISIT_NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
        placeholder="예: 소금빵 겉이 바삭하고 버터 향이 진했어요."
        rows={3}
        value={note}
      />
      <small className="field-help">
        {note.length}/{VISIT_NOTE_MAX}자
      </small>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="visit-form-actions">
        <button
          className="visit-secondary-button"
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button className="submit-button" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
