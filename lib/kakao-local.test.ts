import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeBakeryQuery,
  parseKakaoPlaceSearchResponse,
  searchKakaoPlaces,
} from "@/lib/kakao-local";
import { PlaceProviderError } from "@/lib/place-provider";

const originalKey = process.env.KAKAO_REST_API_KEY;

afterEach(() => {
  process.env.KAKAO_REST_API_KEY = originalKey;
});

describe("Kakao Local place provider", () => {
  it("normalizes a keyword search response", () => {
    const result = parseKakaoPlaceSearchResponse(
      {
        meta: { total_count: 1, is_end: true },
        documents: [
          {
            id: "123",
            place_name: "동네빵집",
            category_name: "음식점 > 간식 > 제과,베이커리",
            phone: "02-123-4567",
            address_name: "서울 성동구 성수동1가",
            road_address_name: "서울 성동구 성수이로 1",
            x: "127.05",
            y: "37.54",
            place_url: "https://place.map.kakao.com/123",
            distance: "412",
          },
        ],
      },
      "2026-06-22T00:00:00.000Z",
    );

    expect(result.places[0]).toMatchObject({
      provider: "kakao",
      externalId: "123",
      name: "동네빵집",
      latitude: 37.54,
      longitude: 127.05,
      distanceMeters: 412,
    });
  });

  it("adds bakery intent to a neighborhood-only query", () => {
    expect(normalizeBakeryQuery("성수동")).toBe("성수동 빵집");
    expect(normalizeBakeryQuery("성수동 베이커리")).toBe("성수동 베이커리");
  });

  it("rejects malformed coordinates", () => {
    expect(() =>
      parseKakaoPlaceSearchResponse(
        {
          meta: { total_count: 1, is_end: true },
          documents: [
            {
              id: "123",
              place_name: "동네빵집",
              category_name: "베이커리",
              address_name: "서울",
              x: "not-a-coordinate",
              y: "37.54",
              place_url: "https://place.map.kakao.com/123",
            },
          ],
        },
        "2026-06-22T00:00:00.000Z",
      ),
    ).toThrow(PlaceProviderError);
  });

  it("requires a server-side REST API key", async () => {
    delete process.env.KAKAO_REST_API_KEY;

    await expect(searchKakaoPlaces({ query: "빵집" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("sends coordinates as longitude x and latitude y", async () => {
    process.env.KAKAO_REST_API_KEY = "test-key";
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          meta: { total_count: 1, is_end: true },
          documents: [
            {
              id: "123",
              place_name: "동네빵집",
              category_name: "베이커리",
              address_name: "서울",
              x: "127.05",
              y: "37.54",
              place_url: "https://place.map.kakao.com/123",
            },
          ],
        }),
      );
    };

    await searchKakaoPlaces(
      { query: "빵집", latitude: 37.54, longitude: 127.05 },
      fetcher,
    );

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("query")).toBe("빵집");
    expect(url.searchParams.get("x")).toBe("127.05");
    expect(url.searchParams.get("y")).toBe("37.54");
    expect(url.searchParams.get("sort")).toBe("distance");
  });

  it("does not interpret an empty provider distance as zero meters", () => {
    const result = parseKakaoPlaceSearchResponse(
      {
        meta: { total_count: 1, is_end: true },
        documents: [
          {
            id: "123",
            place_name: "동네빵집",
            category_name: "베이커리",
            address_name: "서울",
            x: "127.05",
            y: "37.54",
            place_url: "https://place.map.kakao.com/123",
            distance: "",
          },
        ],
      },
      "2026-06-22T00:00:00.000Z",
    );

    expect(result.places[0]?.distanceMeters).toBeUndefined();
  });
});
