import type { VerificationGrade } from "@/lib/types";

type VerificationBadgeProps = {
  grade: VerificationGrade;
  checkedAt: string;
  sourceLabel: string;
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
}: VerificationBadgeProps) {
  return (
    <span
      className={`verification-badge grade-${grade.toLowerCase()}`}
      title={`${sourceLabel} · ${checkedAt}`}
    >
      <span aria-hidden="true">{grade === "D" ? "!" : "✓"}</span>
      {grade} {gradeLabels[grade]}
    </span>
  );
}
