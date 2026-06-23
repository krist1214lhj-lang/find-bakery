import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { buildReverificationQueue } from "@/lib/reverification";

type VerificationRow =
  Database["public"]["Tables"]["verification_records"]["Row"];

const locations = [{ id: "location-1", name: "테스트 빵집" }];
const menus = [{ id: "menu-1", name: "소금빵" }];
const sources = [
  {
    id: "source-1",
    publisher: "공식 인스타그램",
    type: "official_sns" as const,
    url: "https://example.com/source",
  },
];

describe("buildReverificationQueue", () => {
  it("groups records and orders conflicts before expired and due-soon items", () => {
    const queue = buildReverificationQueue(
      [
        record({
          id: "expired",
          field: "business_hours",
          nextReviewAt: "2026-06-01T00:00:00Z",
        }),
        record({
          id: "due-soon",
          field: "phone",
          nextReviewAt: "2026-06-30T00:00:00Z",
        }),
        record({
          id: "conflict",
          field: "price",
          menuItemId: "menu-1",
          result: "conflicts",
          grade: "D",
          nextReviewAt: "2026-06-10T00:00:00Z",
        }),
      ],
      locations,
      menus,
      sources,
      new Date("2026-06-23T00:00:00Z"),
    );

    expect(queue.counts).toEqual({
      conflict: 1,
      expired: 1,
      dueSoon: 1,
    });
    expect(queue.items.map((item) => item.id)).toEqual([
      "conflict",
      "expired",
      "due-soon",
    ]);
    expect(queue.items[0]?.menuName).toBe("소금빵");
  });

  it("omits current records and downgrades expired A grades to C", () => {
    const queue = buildReverificationQueue(
      [
        record({
          id: "current",
          field: "phone",
          nextReviewAt: "2026-12-01T00:00:00Z",
        }),
        record({
          id: "expired",
          field: "address",
          grade: "A",
          nextReviewAt: "2026-06-22T00:00:00Z",
        }),
      ],
      locations,
      menus,
      sources,
      new Date("2026-06-23T00:00:00Z"),
    );

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({
      id: "expired",
      storedGrade: "A",
      effectiveGrade: "C",
      state: "expired",
    });
  });
});

function record({
  id,
  field,
  nextReviewAt,
  menuItemId = null,
  result = "confirmed",
  grade = "A",
}: {
  id: string;
  field: VerificationRow["field"];
  nextReviewAt: string;
  menuItemId?: string | null;
  result?: VerificationRow["result"];
  grade?: VerificationRow["grade"];
}): VerificationRow {
  return {
    id,
    location_id: "location-1",
    menu_item_id: menuItemId,
    field,
    normalized_value: {},
    source_id: "source-1",
    source_authority: "official",
    result,
    grade,
    rule_version: 1,
    verified_by: null,
    verified_at: "2026-06-01T00:00:00Z",
    next_review_at: nextReviewAt,
    note: "검증 메모",
    created_at: "2026-06-01T00:00:00Z",
  };
}
