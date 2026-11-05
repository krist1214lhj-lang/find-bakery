import { describe, expect, it } from "vitest";
import {
  VISIT_LOG_KEY,
  VisitLogError,
  addVisit,
  deleteVisit,
  exportVisits,
  formatVisitDate,
  importVisits,
  latestVisit,
  readVisits,
  summarizeVisitedBakeries,
  todayInSeoul,
  updateVisit,
  validateVisitDraft,
  visitsForBakery,
  type VisitDraft,
} from "@/lib/visit-log";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const TODAY = "2026-11-05";

function draft(overrides: Partial<VisitDraft> = {}): VisitDraft {
  return {
    bakeryId: "bakery-1",
    bakeryName: "스택베이커리",
    bakeryRegion: "서울 광진구",
    rating: 4,
    note: "소금빵이 바삭했어요",
    breads: ["소금빵"],
    visitedOn: TODAY,
    ...overrides,
  };
}

describe("validateVisitDraft", () => {
  it("accepts a visit with only a rating", () => {
    expect(validateVisitDraft(draft({ note: "", breads: [] }), TODAY)).toEqual({
      valid: true,
    });
  });

  it("requires a whole-number rating from 1 to 5", () => {
    for (const rating of [0, 6, 3.5, Number.NaN]) {
      expect(validateVisitDraft(draft({ rating }), TODAY)).toEqual({
        valid: false,
        message: "별점을 골라 주세요.",
      });
    }
  });

  it("limits the note to 300 characters after trimming", () => {
    expect(
      validateVisitDraft(draft({ note: ` ${"가".repeat(300)} ` }), TODAY),
    ).toEqual({ valid: true });
    expect(
      validateVisitDraft(draft({ note: "가".repeat(301) }), TODAY),
    ).toEqual({
      valid: false,
      message: "한 줄평은 300자 이하로 입력해 주세요.",
    });
  });

  it("rejects malformed and future visit dates", () => {
    for (const visitedOn of ["", "2026-02-30", "2026/11/05", "어제"]) {
      expect(validateVisitDraft(draft({ visitedOn }), TODAY)).toEqual({
        valid: false,
        message: "방문 날짜를 확인해 주세요.",
      });
    }
    expect(
      validateVisitDraft(draft({ visitedOn: "2026-11-06" }), TODAY),
    ).toEqual({ valid: false, message: "미래 날짜는 고를 수 없어요." });
    expect(
      validateVisitDraft(draft({ visitedOn: "2025-12-31" }), TODAY),
    ).toEqual({ valid: true });
  });

  it("limits how many breads and how long each name can be", () => {
    const tooMany = Array.from({ length: 11 }, (_, index) => `빵${index}`);
    expect(validateVisitDraft(draft({ breads: tooMany }), TODAY)).toEqual({
      valid: false,
      message: "먹은 빵은 10개까지 적을 수 있어요.",
    });
    expect(
      validateVisitDraft(draft({ breads: ["가".repeat(41)] }), TODAY),
    ).toEqual({
      valid: false,
      message: "빵 이름은 40자 이하로 입력해 주세요.",
    });
  });

  it("requires the bakery it belongs to", () => {
    expect(validateVisitDraft(draft({ bakeryId: " " }), TODAY)).toEqual({
      valid: false,
      message: "방문한 빵집을 찾을 수 없어요.",
    });
  });
});

describe("visit log storage", () => {
  it("adds a visit with a trimmed note and tidy bread list", () => {
    const storage = new MemoryStorage();
    const now = new Date("2026-11-05T03:00:00.000Z");

    const visit = addVisit(
      storage,
      draft({
        note: "  겉바속촉  ",
        breads: [" 소금빵 ", "", "소금빵", "크루아상"],
      }),
      { id: "visit-1", now, today: TODAY },
    );

    expect(visit).toEqual({
      id: "visit-1",
      bakeryId: "bakery-1",
      bakeryName: "스택베이커리",
      bakeryRegion: "서울 광진구",
      rating: 4,
      note: "겉바속촉",
      breads: ["소금빵", "크루아상"],
      visitedOn: TODAY,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(readVisits(storage)).toEqual([visit]);
  });

  it("refuses to store an invalid visit", () => {
    const storage = new MemoryStorage();

    expect(() =>
      addVisit(storage, draft({ rating: 0 }), { today: TODAY }),
    ).toThrow("별점을 골라 주세요.");
    expect(readVisits(storage)).toEqual([]);
  });

  it("keeps every visit to the same bakery, newest visit first", () => {
    const storage = new MemoryStorage();
    addVisit(storage, draft({ visitedOn: "2026-10-01" }), {
      id: "old",
      now: new Date("2026-10-01T01:00:00.000Z"),
      today: TODAY,
    });
    addVisit(storage, draft({ visitedOn: "2026-11-01" }), {
      id: "new",
      now: new Date("2026-11-01T01:00:00.000Z"),
      today: TODAY,
    });
    addVisit(storage, draft({ visitedOn: "2026-11-01", rating: 5 }), {
      id: "new-later-same-day",
      now: new Date("2026-11-01T05:00:00.000Z"),
      today: TODAY,
    });
    addVisit(storage, draft({ bakeryId: "bakery-2" }), {
      id: "other",
      today: TODAY,
    });

    const visits = readVisits(storage);
    expect(visitsForBakery(visits, "bakery-1").map((v) => v.id)).toEqual([
      "new-later-same-day",
      "new",
      "old",
    ]);
    expect(latestVisit(visits, "bakery-1")?.rating).toBe(5);
    expect(latestVisit(visits, "bakery-404")).toBeUndefined();
  });

  it("updates a visit but keeps its identity and creation time", () => {
    const storage = new MemoryStorage();
    const created = addVisit(storage, draft(), {
      id: "visit-1",
      now: new Date("2026-11-01T01:00:00.000Z"),
      today: TODAY,
    });
    const later = new Date("2026-11-05T09:00:00.000Z");

    const updated = updateVisit(
      storage,
      "visit-1",
      draft({
        bakeryId: "someone-else",
        rating: 2,
        note: "다시 가니 별로",
        visitedOn: "2026-11-02",
      }),
      { now: later, today: TODAY },
    );

    expect(updated).toEqual({
      ...created,
      rating: 2,
      note: "다시 가니 별로",
      visitedOn: "2026-11-02",
      updatedAt: later.toISOString(),
    });
    expect(readVisits(storage)).toEqual([updated]);
    expect(() =>
      updateVisit(storage, "missing", draft(), { today: TODAY }),
    ).toThrow("고칠 방문 기록을 찾을 수 없어요.");
    expect(() =>
      updateVisit(storage, "visit-1", draft({ rating: 9 }), { today: TODAY }),
    ).toThrow("별점을 골라 주세요.");
  });

  it("deletes only the chosen visit", () => {
    const storage = new MemoryStorage();
    addVisit(storage, draft(), { id: "a", today: TODAY });
    addVisit(storage, draft(), { id: "b", today: TODAY });

    expect(deleteVisit(storage, "a")).toBe(true);
    expect(deleteVisit(storage, "a")).toBe(false);
    expect(readVisits(storage).map((v) => v.id)).toEqual(["b"]);
  });

  it("recovers safely from broken or foreign stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem(VISIT_LOG_KEY, "{broken");
    expect(readVisits(storage)).toEqual([]);

    storage.setItem(VISIT_LOG_KEY, JSON.stringify({ not: "a list" }));
    expect(readVisits(storage)).toEqual([]);

    const good = addVisit(new MemoryStorage(), draft(), {
      id: "good",
      today: TODAY,
    });
    storage.setItem(
      VISIT_LOG_KEY,
      JSON.stringify([good, { id: "bad", rating: 4 }, null, "text"]),
    );
    expect(readVisits(storage)).toEqual([good]);
  });
});

describe("summarizeVisitedBakeries", () => {
  it("groups visits per bakery, newest first, and marks hidden bakeries", () => {
    const storage = new MemoryStorage();
    addVisit(
      storage,
      draft({ bakeryName: "옛 이름", visitedOn: "2026-09-01", rating: 3 }),
      { id: "a1", today: TODAY },
    );
    addVisit(
      storage,
      draft({ bakeryName: "새 이름", visitedOn: "2026-10-20", rating: 5 }),
      { id: "a2", today: TODAY },
    );
    addVisit(
      storage,
      draft({
        bakeryId: "hidden-bakery",
        bakeryName: "숨은 빵집",
        bakeryRegion: "부산 해운대구",
        visitedOn: "2026-11-03",
        rating: 2,
      }),
      { id: "b1", today: TODAY },
    );

    expect(
      summarizeVisitedBakeries(readVisits(storage), new Set(["bakery-1"])),
    ).toEqual([
      {
        bakeryId: "hidden-bakery",
        bakeryName: "숨은 빵집",
        bakeryRegion: "부산 해운대구",
        visitCount: 1,
        latestRating: 2,
        latestVisitedOn: "2026-11-03",
        isPublic: false,
      },
      {
        bakeryId: "bakery-1",
        bakeryName: "새 이름",
        bakeryRegion: "서울 광진구",
        visitCount: 2,
        latestRating: 5,
        latestVisitedOn: "2026-10-20",
        isPublic: true,
      },
    ]);
  });
});

describe("export and import", () => {
  it("restores exported visits into an empty browser", () => {
    const source = new MemoryStorage();
    addVisit(source, draft(), { id: "a", today: TODAY });
    addVisit(source, draft({ bakeryId: "bakery-2" }), {
      id: "b",
      today: TODAY,
    });
    const file = exportVisits(
      readVisits(source),
      new Date("2026-11-05T00:00:00.000Z"),
    );

    const target = new MemoryStorage();
    expect(importVisits(target, file)).toEqual({
      added: 2,
      updated: 0,
      unchanged: 0,
      invalid: 0,
    });
    expect(readVisits(target)).toEqual(readVisits(source));
    expect(JSON.parse(file)).toMatchObject({
      app: "bbang-gil",
      kind: "visit-log",
      version: 1,
      exportedAt: "2026-11-05T00:00:00.000Z",
    });
  });

  it("merges without duplicates and keeps the newer edit", () => {
    const storage = new MemoryStorage();
    addVisit(storage, draft({ rating: 3 }), {
      id: "same-newer-in-file",
      now: new Date("2026-11-01T00:00:00.000Z"),
      today: TODAY,
    });
    addVisit(storage, draft({ rating: 5 }), {
      id: "same-newer-here",
      now: new Date("2026-11-04T00:00:00.000Z"),
      today: TODAY,
    });

    const other = new MemoryStorage();
    addVisit(other, draft({ rating: 1 }), {
      id: "same-newer-in-file",
      now: new Date("2026-11-03T00:00:00.000Z"),
      today: TODAY,
    });
    addVisit(other, draft({ rating: 1 }), {
      id: "same-newer-here",
      now: new Date("2026-11-02T00:00:00.000Z"),
      today: TODAY,
    });
    addVisit(other, draft(), { id: "brand-new", today: TODAY });
    const parsed = JSON.parse(exportVisits(readVisits(other)));
    parsed.visits.push({ id: "broken" });

    expect(importVisits(storage, JSON.stringify(parsed))).toEqual({
      added: 1,
      updated: 1,
      unchanged: 1,
      invalid: 1,
    });
    const byId = new Map(readVisits(storage).map((v) => [v.id, v]));
    expect(byId.size).toBe(3);
    expect(byId.get("same-newer-in-file")?.rating).toBe(1);
    expect(byId.get("same-newer-here")?.rating).toBe(5);
    expect(byId.has("brand-new")).toBe(true);
  });

  it("rejects files that are not a 빵길 visit log", () => {
    const storage = new MemoryStorage();
    for (const text of ["not json", "[]", JSON.stringify({ kind: "other" })]) {
      expect(() => importVisits(storage, text)).toThrow(
        "빵길 방문 기록 파일이 아니에요.",
      );
    }
    expect(readVisits(storage)).toEqual([]);
  });
});

describe("formatVisitDate", () => {
  it("shows the date the Korean way without shifting time zones", () => {
    expect(formatVisitDate("2026-11-05")).toBe("2026. 11. 5.");
    expect(formatVisitDate("2026-01-31")).toBe("2026. 1. 31.");
    expect(formatVisitDate("broken")).toBe("broken");
  });
});

describe("user-facing errors", () => {
  it("are marked so the screen can show them as they are", () => {
    expect(() =>
      addVisit(new MemoryStorage(), draft({ rating: 0 }), { today: TODAY }),
    ).toThrow(VisitLogError);
    expect(() => importVisits(new MemoryStorage(), "nope")).toThrow(
      VisitLogError,
    );
  });
});

describe("todayInSeoul", () => {
  it("uses the Korean calendar date even late at night UTC", () => {
    expect(todayInSeoul(new Date("2026-11-04T15:30:00.000Z"))).toBe(
      "2026-11-05",
    );
    expect(todayInSeoul(new Date("2026-11-04T14:59:00.000Z"))).toBe(
      "2026-11-04",
    );
  });
});
