// 방문 기록: 내 기기(localStorage)에만 남는 "나만 보는" 빵집 방문 기록.
// 공개 후기가 아니다. 코드의 `review`는 관리자 검수 뜻이라 이 기능은 `visit-log`로 부른다.
// 나중에 서버로 옮길 수 있게 지점은 바뀌지 않는 id로, 이름·지역은 사본으로 함께 남긴다.
// 서버 의존성 없는 순수 함수 모음 — 화면 쪽은 components/visit-log-provider.tsx 참고.

import type { KeyValueStorage } from "@/lib/storage";

export const VISIT_LOG_KEY = "bbang-gil.visit-log.v1";
export const VISIT_NOTE_MAX = 300;
export const VISIT_BREADS_MAX = 10;
export const VISIT_BREAD_NAME_MAX = 40;

const EXPORT_APP = "bbang-gil";
const EXPORT_KIND = "visit-log";
const EXPORT_VERSION = 1;

export type VisitEntry = {
  id: string;
  bakeryId: string;
  bakeryName: string;
  bakeryRegion: string;
  rating: number;
  note: string;
  breads: string[];
  visitedOn: string;
  createdAt: string;
  updatedAt: string;
};

export type VisitDraft = {
  bakeryId: string;
  bakeryName: string;
  bakeryRegion: string;
  rating: number;
  note: string;
  breads: string[];
  visitedOn: string;
};

export type VisitedBakerySummary = {
  bakeryId: string;
  bakeryName: string;
  bakeryRegion: string;
  visitCount: number;
  latestRating: number;
  latestVisitedOn: string;
  isPublic: boolean;
};

export type ImportResult = {
  added: number;
  updated: number;
  unchanged: number;
  invalid: number;
};

type ValidationResult = { valid: true } | { valid: false; message: string };

// 사용자에게 그대로 보여줄 수 있는 오류(검증 실패·없는 기록·다른 파일).
// 브라우저 저장 공간 부족 같은 오류와 구분하려고 따로 둔다.
export class VisitLogError extends Error {}

type WriteOptions = { today: string; now?: Date };

export function todayInSeoul(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function normalizeBreads(breads: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of breads) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function validateVisitDraft(
  draft: VisitDraft,
  today: string,
): ValidationResult {
  if (!draft.bakeryId.trim()) {
    return { valid: false, message: "방문한 빵집을 찾을 수 없어요." };
  }

  if (!isRating(draft.rating)) {
    return { valid: false, message: "별점을 골라 주세요." };
  }

  if (draft.note.trim().length > VISIT_NOTE_MAX) {
    return {
      valid: false,
      message: `한 줄평은 ${VISIT_NOTE_MAX}자 이하로 입력해 주세요.`,
    };
  }

  if (!isCalendarDate(draft.visitedOn)) {
    return { valid: false, message: "방문 날짜를 확인해 주세요." };
  }

  if (draft.visitedOn > today) {
    return { valid: false, message: "미래 날짜는 고를 수 없어요." };
  }

  const breads = normalizeBreads(draft.breads);
  if (breads.length > VISIT_BREADS_MAX) {
    return {
      valid: false,
      message: `먹은 빵은 ${VISIT_BREADS_MAX}개까지 적을 수 있어요.`,
    };
  }

  if (breads.some((name) => name.length > VISIT_BREAD_NAME_MAX)) {
    return {
      valid: false,
      message: `빵 이름은 ${VISIT_BREAD_NAME_MAX}자 이하로 입력해 주세요.`,
    };
  }

  return { valid: true };
}

export function readVisits(storage: KeyValueStorage): VisitEntry[] {
  return parseVisits(storage.getItem(VISIT_LOG_KEY));
}

export function parseVisits(raw: string | null): VisitEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isVisitEntry) : [];
  } catch {
    return [];
  }
}

export function addVisit(
  storage: KeyValueStorage,
  draft: VisitDraft,
  options: WriteOptions & { id?: string },
): VisitEntry {
  assertValid(draft, options.today);
  const timestamp = (options.now ?? new Date()).toISOString();
  const visit: VisitEntry = {
    id: options.id ?? crypto.randomUUID(),
    bakeryId: draft.bakeryId.trim(),
    bakeryName: draft.bakeryName.trim(),
    bakeryRegion: draft.bakeryRegion.trim(),
    rating: draft.rating,
    note: draft.note.trim(),
    breads: normalizeBreads(draft.breads),
    visitedOn: draft.visitedOn,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  writeVisits(storage, [...readVisits(storage), visit]);
  return visit;
}

export function updateVisit(
  storage: KeyValueStorage,
  visitId: string,
  draft: VisitDraft,
  options: WriteOptions,
): VisitEntry {
  const visits = readVisits(storage);
  const index = visits.findIndex((visit) => visit.id === visitId);
  if (index < 0) {
    throw new VisitLogError("고칠 방문 기록을 찾을 수 없어요.");
  }

  assertValid(draft, options.today);
  // 어느 빵집의 기록인지(id·이름·지역 사본)와 처음 쓴 시각은 바꾸지 않는다.
  const updated: VisitEntry = {
    ...visits[index],
    rating: draft.rating,
    note: draft.note.trim(),
    breads: normalizeBreads(draft.breads),
    visitedOn: draft.visitedOn,
    updatedAt: (options.now ?? new Date()).toISOString(),
  };

  writeVisits(
    storage,
    visits.map((visit, position) => (position === index ? updated : visit)),
  );
  return updated;
}

export function deleteVisit(storage: KeyValueStorage, visitId: string) {
  const visits = readVisits(storage);
  const next = visits.filter((visit) => visit.id !== visitId);
  if (next.length === visits.length) {
    return false;
  }

  writeVisits(storage, next);
  return true;
}

export function visitsForBakery(
  visits: VisitEntry[],
  bakeryId: string,
): VisitEntry[] {
  return visits
    .filter((visit) => visit.bakeryId === bakeryId)
    .sort(compareNewestFirst);
}

export function latestVisit(
  visits: VisitEntry[],
  bakeryId: string,
): VisitEntry | undefined {
  return visitsForBakery(visits, bakeryId)[0];
}

export function summarizeVisitedBakeries(
  visits: VisitEntry[],
  publicBakeryIds: ReadonlySet<string>,
): VisitedBakerySummary[] {
  const groups = new Map<string, VisitEntry[]>();
  for (const visit of [...visits].sort(compareNewestFirst)) {
    const group = groups.get(visit.bakeryId);
    if (group) {
      group.push(visit);
    } else {
      groups.set(visit.bakeryId, [visit]);
    }
  }

  // Map은 넣은 순서를 지키므로, 가장 최근 방문순으로 정렬한 뒤 묶으면 묶음도 최근순이 된다.
  return [...groups.values()].map((group) => {
    const latest = group[0];
    return {
      bakeryId: latest.bakeryId,
      bakeryName: latest.bakeryName,
      bakeryRegion: latest.bakeryRegion,
      visitCount: group.length,
      latestRating: latest.rating,
      latestVisitedOn: latest.visitedOn,
      isPublic: publicBakeryIds.has(latest.bakeryId),
    };
  });
}

export function exportVisits(
  visits: VisitEntry[],
  now: Date = new Date(),
): string {
  return JSON.stringify(
    {
      app: EXPORT_APP,
      kind: EXPORT_KIND,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      visits,
    },
    null,
    2,
  );
}

export function importVisits(
  storage: KeyValueStorage,
  text: string,
): ImportResult {
  const incoming = parseExportFile(text);
  const merged = readVisits(storage);
  const indexById = new Map(merged.map((visit, index) => [visit.id, index]));
  const result: ImportResult = {
    added: 0,
    updated: 0,
    unchanged: 0,
    invalid: 0,
  };

  for (const candidate of incoming) {
    if (!isVisitEntry(candidate)) {
      result.invalid += 1;
      continue;
    }

    const existingIndex = indexById.get(candidate.id);
    if (existingIndex === undefined) {
      indexById.set(candidate.id, merged.length);
      merged.push(candidate);
      result.added += 1;
    } else if (
      Date.parse(candidate.updatedAt) >
      Date.parse(merged[existingIndex].updatedAt)
    ) {
      merged[existingIndex] = candidate;
      result.updated += 1;
    } else {
      result.unchanged += 1;
    }
  }

  writeVisits(storage, merged);
  return result;
}

function parseExportFile(text: string): unknown[] {
  const notOurs = new VisitLogError("빵길 방문 기록 파일이 아니에요.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw notOurs;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as { app?: unknown }).app !== EXPORT_APP ||
    (parsed as { kind?: unknown }).kind !== EXPORT_KIND ||
    !Array.isArray((parsed as { visits?: unknown }).visits)
  ) {
    throw notOurs;
  }

  return (parsed as { visits: unknown[] }).visits;
}

function writeVisits(storage: KeyValueStorage, visits: VisitEntry[]) {
  storage.setItem(VISIT_LOG_KEY, JSON.stringify(visits));
}

function assertValid(draft: VisitDraft, today: string) {
  const validation = validateVisitDraft(draft, today);
  if (!validation.valid) {
    throw new VisitLogError(validation.message);
  }
}

// "2026-11-05" → "2026. 11. 5." (시간대 변환 없이 날짜 글자만 바꾼다)
export function formatVisitDate(visitedOn: string): string {
  if (!isCalendarDate(visitedOn)) {
    return visitedOn;
  }
  const [year, month, day] = visitedOn.split("-").map(Number);
  return `${year}. ${month}. ${day}.`;
}

function compareNewestFirst(a: VisitEntry, b: VisitEntry) {
  if (a.visitedOn !== b.visitedOn) {
    return a.visitedOn < b.visitedOn ? 1 : -1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return 0;
}

function isRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isVisitEntry(value: unknown): value is VisitEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const visit = value as Record<string, unknown>;
  return (
    isNonEmptyString(visit.id) &&
    isNonEmptyString(visit.bakeryId) &&
    typeof visit.bakeryName === "string" &&
    typeof visit.bakeryRegion === "string" &&
    isRating(visit.rating) &&
    typeof visit.note === "string" &&
    visit.note.length <= VISIT_NOTE_MAX &&
    Array.isArray(visit.breads) &&
    visit.breads.every((bread) => typeof bread === "string") &&
    isCalendarDate(visit.visitedOn) &&
    isTimestamp(visit.createdAt) &&
    isTimestamp(visit.updatedAt)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
