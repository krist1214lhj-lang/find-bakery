// "이곳이 알려진 이유" 카드 내용 결정. 서버 의존성 없는 순수 함수(테스트 용이).
// 우선순위: fame_evidence(description→title) → 없으면 정밀검증 rationale
// (verification_records.normalized_value.rationale) → 둘 다 없으면 폴백 문구.

const FALLBACK_REASON = "이 빵집이 알려진 이유를 확인하고 있어요.";
const FALLBACK_SOURCE = "검증된 출처 준비 중";

const clean = (value?: string | null): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export type FameInput = {
  fameDescription?: string | null;
  fameTitle?: string | null;
  fameSourceLabel?: string | null;
  verificationRationale?: string | null;
  verificationSourceLabel?: string | null;
};

export function resolveFame(input: FameInput): { reason: string; source: string } {
  const fameText = clean(input.fameDescription) ?? clean(input.fameTitle);
  if (fameText) {
    return { reason: fameText, source: clean(input.fameSourceLabel) ?? FALLBACK_SOURCE };
  }
  const rationale = clean(input.verificationRationale);
  if (rationale) {
    return {
      reason: rationale,
      source: clean(input.verificationSourceLabel) ?? FALLBACK_SOURCE,
    };
  }
  return { reason: FALLBACK_REASON, source: clean(input.fameSourceLabel) ?? FALLBACK_SOURCE };
}

// verification_records.normalized_value(jsonb)에서 rationale 문자열을 안전하게 꺼낸다.
export function extractRationale(normalizedValue: unknown): string | undefined {
  if (
    normalizedValue &&
    typeof normalizedValue === "object" &&
    "rationale" in normalizedValue
  ) {
    return clean((normalizedValue as { rationale?: unknown }).rationale as string);
  }
  return undefined;
}
