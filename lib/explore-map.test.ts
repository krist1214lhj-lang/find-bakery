import { describe, expect, it } from "vitest";
import { bakeries } from "@/lib/bakeries";
import {
  buildExploreMapItems,
  filterItemsByBounds,
  getMapCenter,
  getMapSearchRadius,
} from "@/lib/explore-map";

describe("explore map model", () => {
  it("keeps verified and candidate IDs distinct", () => {
    const items = buildExploreMapItems(bakeries.slice(0, 1), [
      {
        provider: "kakao",
        externalId: "123",
        name: "후보 빵집",
        category: "음식점 > 제과",
        address: "서울 성동구",
        latitude: 37.55,
        longitude: 127.05,
        placeUrl: "https://place.map.kakao.com/123",
        retrievedAt: "2026-06-23T00:00:00Z",
      },
    ]);

    expect(items.map((item) => item.id)).toEqual([
      `bakery:${bakeries[0].id}`,
      "candidate:123",
    ]);
  });

  it("uses one bounds filter for list and map results", () => {
    const items = buildExploreMapItems(bakeries, []);
    const filtered = filterItemsByBounds(items, {
      south: 37.4,
      west: 126.8,
      north: 37.7,
      east: 127.2,
    });

    expect(filtered.map((item) => item.name)).toEqual(["멜로우 오븐 성수점"]);
  });

  it("calculates a stable center and clamps search radius", () => {
    const items = buildExploreMapItems(bakeries.slice(0, 2), []);
    const center = getMapCenter(items);

    expect(center.latitude).toBeCloseTo((37.5445 + 36.328) / 2);
    expect(
      getMapSearchRadius({
        south: 33,
        west: 124,
        north: 39,
        east: 132,
      }),
    ).toBe(20_000);
  });
});
