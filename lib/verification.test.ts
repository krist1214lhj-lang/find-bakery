import { describe, expect, it } from "vitest";
import { bakeries, searchBakeries } from "@/lib/bakeries";
import {
  formatCheckedDate,
  getOperatingStatus,
  isVerificationFresh,
} from "@/lib/verification";

describe("verification freshness", () => {
  it("treats a recent A grade record as fresh", () => {
    expect(
      isVerificationFresh(
        "A",
        "2026-06-16T03:00:00+09:00",
        new Date("2026-06-18T03:00:00+09:00"),
      ),
    ).toBe(true);
  });

  it("always requires rechecking a D grade record", () => {
    expect(
      isVerificationFresh(
        "D",
        "2026-06-18T03:00:00+09:00",
        new Date("2026-06-18T04:00:00+09:00"),
      ),
    ).toBe(false);
  });
});

describe("operating status", () => {
  it("does not claim an old record is open", () => {
    const staleBakery = bakeries[2];
    expect(
      getOperatingStatus(staleBakery, new Date("2026-06-18T12:00:00+09:00"))
        .state,
    ).toBe("unknown");
  });

  it("uses verified business hours for a fresh record", () => {
    const freshBakery = bakeries[0];
    expect(
      getOperatingStatus(freshBakery, new Date("2026-06-18T12:00:00+09:00"))
        .state,
    ).toBe("open");
  });

  it("prioritizes a confirmed temporary closure over regular hours", () => {
    const bakeryWithClosure = bakeries[1];
    const status = getOperatingStatus(
      bakeryWithClosure,
      new Date("2026-06-18T12:00:00+09:00"),
    );

    expect(status.state).toBe("temporary-closed");
    expect(status.hoursLabel).toBe("임시휴무");
    expect(status.description).toContain("설비 점검");
  });

  it("uses changed hours only on the matching date", () => {
    const bakeryWithChangedHours = {
      ...bakeries[0],
      specialSchedules: [
        {
          id: "changed-hours-test",
          date: "2026-06-18",
          type: "changed-hours" as const,
          opensAt: "12:00",
          closesAt: "17:00",
          note: "행사로 단축 영업합니다.",
          confirmed: true,
          sourceLabel: "공식 공지",
        },
      ],
    };

    expect(
      getOperatingStatus(
        bakeryWithChangedHours,
        new Date("2026-06-18T11:00:00+09:00"),
      ).state,
    ).toBe("opens-later");
    expect(
      getOperatingStatus(
        bakeryWithChangedHours,
        new Date("2026-06-19T11:00:00+09:00"),
      ).state,
    ).toBe("open");
  });
});

describe("bakery search", () => {
  it("searches bakery names and menu names", () => {
    expect(searchBakeries({ q: "소금빵" })).toHaveLength(1);
    expect(searchBakeries({ q: "웨이브" })[0]?.slug).toBe("wave-bagel-busan");
  });

  it("searches foreign bakery names with curated Korean aliases", () => {
    expect(searchBakeries({ q: "멜로우오븐" })[0]?.slug).toBe(
      "mellow-oven-seongsu",
    );
    expect(searchBakeries({ q: "올드 타운 베이커리" })[0]?.slug).toBe(
      "old-town-bakery-daejeon",
    );
    expect(searchBakeries({ q: "웨이브-베이글 부산" })[0]?.slug).toBe(
      "wave-bagel-busan",
    );
  });

  it("combines category and region filters", () => {
    expect(searchBakeries({ category: "bagel", region: "부산" })).toHaveLength(
      1,
    );
    expect(searchBakeries({ category: "bagel", region: "서울" })).toHaveLength(
      0,
    );
  });
});

describe("date formatting", () => {
  it("formats dates in the bakery timezone", () => {
    expect(formatCheckedDate("2026-06-16T23:30:00Z")).toContain("2026");
  });
});
