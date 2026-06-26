import { describe, expect, it } from "vitest";
import { bakeries } from "@/lib/bakeries";
import {
  buildExploreMapItems,
  filterItemsByBounds,
  getMapCenter,
  getMapSearchRadius,
} from "@/lib/explore-map";
import type { PlaceCandidate } from "@/lib/place-provider";

// 기본값은 "저장 빵집과 전혀 겹치지 않는" 후보(부산, 무관한 이름)다.
// 각 테스트에서 중복 여부를 만들 값만 덮어쓴다.
function candidate(overrides: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    provider: "kakao",
    externalId: "999",
    name: "무관한 후보 빵집",
    category: "음식점 > 제과,베이커리",
    address: "부산 해운대구 무관로 1",
    latitude: 35.16,
    longitude: 129.16,
    placeUrl: "https://place.map.kakao.com/999",
    retrievedAt: "2026-06-26T00:00:00Z",
    ...overrides,
  };
}

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

  it("drops a candidate that shares the saved bakery's Kakao placeId (slug)", () => {
    // 저장 빵집 slug 는 "kakao-<placeId>" 형태로 placeId 를 담는다.
    // placeId 가 같으면 이름·좌표가 달라도 무조건 같은 가게 → 후보 제외.
    const bakery = { ...bakeries[0], slug: "kakao-1512893541" };
    const items = buildExploreMapItems(
      [bakery],
      [
        candidate({
          externalId: "1512893541",
          name: "이름이 달라도",
          latitude: 35.1,
          longitude: 129.0,
        }),
      ],
    );

    expect(items.map((item) => item.id)).toEqual([`bakery:${bakery.id}`]);
  });

  it("drops a candidate matching a saved bakery by name and nearby coordinates", () => {
    // placeId 가 없어도 이름 일치(+45) + 좌표 50m 이내(+30) = 75 ≥ 55 → 제외.
    const items = buildExploreMapItems(bakeries.slice(0, 1), [
      candidate({
        externalId: "999",
        name: "멜로우오븐 성수점",
        latitude: 37.5446,
        longitude: 127.0561,
      }),
    ]);

    expect(items.map((item) => item.id)).toEqual([`bakery:${bakeries[0].id}`]);
  });

  it("keeps a weakly-matching candidate (single signal) to avoid hiding a real bakery", () => {
    // 이름만 같고(+45) 좌표는 멀고 주소도 다름 → 45 < 55 → 안전하게 남긴다.
    const items = buildExploreMapItems(bakeries.slice(0, 1), [
      candidate({
        externalId: "999",
        name: "멜로우 오븐 성수점",
        latitude: 35.16,
        longitude: 129.16,
      }),
    ]);

    expect(items.map((item) => item.id)).toContain("candidate:999");
    expect(items.map((item) => item.id)).toContain(`bakery:${bakeries[0].id}`);
  });

  it("never drops verified bakeries when removing duplicate candidates", () => {
    const bakery = { ...bakeries[0], slug: "kakao-1512893541" };
    const items = buildExploreMapItems(
      [bakery],
      [candidate({ externalId: "1512893541" })],
    );

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("verified");
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
