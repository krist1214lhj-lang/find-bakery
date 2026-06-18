import type {
  Bakery,
  SpecialSchedule,
  VerificationGrade,
} from "@/lib/types";

export type OperatingStatus = {
  state:
    | "open"
    | "opens-later"
    | "closed"
    | "temporary-closed"
    | "unknown";
  label: string;
  description: string;
  hoursLabel: string;
  notice?: string;
  schedule?: SpecialSchedule;
};

const gradeMaxAgeDays: Record<VerificationGrade, number> = {
  A: 30,
  B: 90,
  C: 0,
  D: 0,
};

export function formatCheckedDate(isoDate: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

export function isVerificationFresh(
  grade: VerificationGrade,
  checkedAt: string,
  now = new Date(),
) {
  if (grade === "C" || grade === "D") {
    return false;
  }

  const ageMs = now.getTime() - new Date(checkedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays <= gradeMaxAgeDays[grade];
}

export function getOperatingStatus(
  bakery: Bakery,
  now = new Date(),
): OperatingStatus {
  if (
    !isVerificationFresh(
      bakery.verification.grade,
      bakery.verification.checkedAt,
      now,
    )
  ) {
    return {
      state: "unknown",
      label: "영업 여부 확인 필요",
      description: "정보 확인일이 지났어요",
      hoursLabel: bakery.todayHours,
    };
  }

  const currentDate = getDateInTimeZone(now);
  const currentTime = getTimeInTimeZone(now);
  const schedule = bakery.specialSchedules.find(
    (candidate) => candidate.confirmed && candidate.date === currentDate,
  );

  if (schedule?.type === "temporary-closed") {
    return {
      state: "temporary-closed",
      label: "오늘 임시휴무",
      description: schedule.note,
      hoursLabel: "임시휴무",
      notice: `${schedule.sourceLabel}에서 확인했어요.`,
      schedule,
    };
  }

  const opensAt =
    schedule?.type === "changed-hours" ||
    schedule?.type === "special-open"
      ? schedule.opensAt
      : bakery.opensAt;
  const closesAt =
    schedule?.type === "changed-hours" ||
    schedule?.type === "special-open"
      ? schedule.closesAt
      : bakery.closesAt;

  if (!opensAt || !closesAt) {
    return {
      state: "unknown",
      label: "영업 여부 확인 필요",
      description: "오늘 영업시간을 확인해 주세요",
      hoursLabel: bakery.todayHours,
      schedule,
    };
  }

  const hoursLabel = `${opensAt}–${closesAt}`;
  const notice = schedule
    ? `${schedule.note} · ${schedule.sourceLabel}`
    : undefined;

  if (currentTime < opensAt) {
    return {
      state: "opens-later",
      label: "오늘 영업 예정",
      description: `${opensAt} 시작`,
      hoursLabel,
      notice,
      schedule,
    };
  }

  if (currentTime >= closesAt) {
    return {
      state: "closed",
      label: "오늘 영업 종료",
      description: `${closesAt} 종료`,
      hoursLabel,
      notice,
      schedule,
    };
  }

  return {
    state: "open",
    label: "영업 중",
    description: `${closesAt} 종료`,
    hoursLabel,
    notice,
    schedule,
  };
}

function getDateInTimeZone(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getTimeInTimeZone(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
