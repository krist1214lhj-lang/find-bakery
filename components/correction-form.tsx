"use client";

import { useState } from "react";
import type {
  CorrectionCategory,
  CorrectionDraft,
} from "@/lib/types";
import {
  validateCorrectionDraft,
} from "@/lib/storage";
import { submitCorrectionDraft } from "@/lib/report-repository";

const categories: Array<{ value: CorrectionCategory; label: string }> = [
  { value: "hours", label: "영업시간·휴무" },
  { value: "closure", label: "폐점" },
  { value: "relocation", label: "이전" },
  { value: "menu-price", label: "메뉴·가격" },
  { value: "phone-address", label: "주소·전화번호" },
  { value: "other", label: "기타" },
];

export function CorrectionForm({
  bakeryId,
  bakeryName,
}: {
  bakeryId: string;
  bakeryName: string;
}) {
  const [category, setCategory] = useState<CorrectionCategory>("hours");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [persistence, setPersistence] = useState<"server" | "local">("local");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const draft: CorrectionDraft = {
      bakeryId,
      bakeryName,
      category,
      description,
      sourceUrl,
    };
    const validation = validateCorrectionDraft(draft);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      const submission = await submitCorrectionDraft(
        draft,
        window.localStorage,
      );
      if (submission.persistence === "local") {
        window.dispatchEvent(new Event("bbang-gil:correction-change"));
      }
      setReceiptId(submission.report.id);
      setPersistence(submission.persistence);
      setDescription("");
      setSourceUrl("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "제보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (receiptId) {
    return (
      <div className="report-success" role="status">
        <span aria-hidden="true">✓</span>
        <h2>제보를 접수했어요.</h2>
        <p>
          접수 번호 <strong>{receiptId.slice(0, 8)}</strong>
        </p>
        <p>
          {persistence === "server"
            ? "서버에 안전하게 저장했어요. 운영자가 출처를 확인한 뒤 검수합니다."
            : "서버 연결 전이라 이 기기에 안전하게 보관했어요. 연결이 준비되면 전송할 수 있습니다."}
        </p>
        <button type="button" onClick={() => setReceiptId("")}>
          다른 내용 제보하기
        </button>
      </div>
    );
  }

  return (
    <form className="correction-form" onSubmit={handleSubmit}>
      <fieldset>
        <legend>어떤 정보가 다른가요?</legend>
        <div className="radio-grid">
          {categories.map((item) => (
            <label key={item.value}>
              <input
                checked={category === item.value}
                name="category"
                onChange={() => setCategory(item.value)}
                type="radio"
                value={item.value}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field-label" htmlFor="correction-description">
        확인한 내용을 알려주세요
      </label>
      <textarea
        id="correction-description"
        maxLength={1000}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="예: 공식 인스타그램에서 오늘 임시휴무 공지를 확인했어요."
        rows={6}
        value={description}
      />
      <small className="field-help">{description.length}/1,000자</small>

      <label className="field-label" htmlFor="correction-source">
        출처 링크 <span>(선택)</span>
      </label>
      <input
        id="correction-source"
        inputMode="url"
        onChange={(event) => setSourceUrl(event.target.value)}
        placeholder="https://"
        type="url"
        value={sourceUrl}
      />

      <p className="privacy-note">
        이름, 전화번호 등 개인정보는 입력하지 마세요. 제출된 내용은 정보
        검수 목적으로만 사용합니다.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="submit-button" disabled={submitting} type="submit">
        {submitting ? "제보 저장 중…" : "제보 보내기"}
      </button>
    </form>
  );
}
