import { describe, expect, it } from "vitest";
import { findPossibleDuplicateLocations } from "@/lib/place-candidate-matching";

describe("place candidate duplicate matching", () => {
  it("prioritizes exact address, phone, name, and nearby coordinates", () => {
    const matches = findPossibleDuplicateLocations(
      {
        name: "멜로우 오븐 성수점",
        address: "서울 성동구 성수동",
        roadAddress: "서울 성동구 성수이로 1",
        phone: "02-123-4567",
        latitude: 37.54,
        longitude: 127.05,
      },
      [
        {
          id: "same",
          name: "멜로우오븐 성수점",
          roadAddress: "서울 성동구 성수이로 1",
          phone: "021234567",
          latitude: 37.5401,
          longitude: 127.0501,
        },
        {
          id: "far",
          name: "다른 빵집",
          roadAddress: "부산 수영구 광안로 1",
          phone: null,
          latitude: 35.15,
          longitude: 129.11,
        },
      ],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      locationId: "same",
      score: 100,
    });
  });

  it("does not suggest weak matches", () => {
    expect(
      findPossibleDuplicateLocations(
        {
          name: "새 빵집",
          address: "서울 성동구 새로운길 1",
          latitude: 37.54,
          longitude: 127.05,
        },
        [
          {
            id: "other",
            name: "완전히 다른 곳",
            roadAddress: "서울 마포구 먼길 2",
            latitude: 37.56,
            longitude: 126.9,
          },
        ],
      ),
    ).toEqual([]);
  });
});
