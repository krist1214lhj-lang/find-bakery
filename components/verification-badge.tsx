import type {
  VerificationGrade,
  VerificationState,
} from "@/lib/types";

type VerificationBadgeProps = {
  grade: VerificationGrade;
  checkedAt: string;
  sourceLabel: string;
  state: VerificationState;
};

const gradeLabels: Record<VerificationGrade, string> = {
  A: "공식 확인",
  B: "교차 확인",
  C: "확인일 경과",
  D: "재확인 필요",
};

export function VerificationBadge({
  grade,
  checkedAt,
  sourceLabel,
  state,
}: VerificationBadgeProps) {
  const label =
    {
      current: gradeLabels[grade],
      "due-soon": "재검토 임박",
      expired: "확인일 경과",
      conflict: "출처 충돌",
      unverified: "재확인 필요",
    }[state] ?? gradeLabels[grade];

  return (
    <span
      className={`verification-badge grade-${grade.toLowerCase()} state-${state}`}
      title={`${sourceLabel} · ${checkedAt}`}
    >
      <span aria-hidden="true">
        {state === "conflict" || state === "unverified" ? "!" : "✓"}
      </span>
      {grade} {label}
    </span>
  );
}
