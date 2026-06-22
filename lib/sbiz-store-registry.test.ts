import { afterEach, describe, expect, it } from "vitest";
import {
  parseSbizResponse,
  rankSbizMatches,
  searchSbizStores,
} from "@/lib/sbiz-store-registry";

const originalKey = process.env.DATA_GO_KR_SERVICE_KEY;

afterEach(() => {
  process.env.DATA_GO_KR_SERVICE_KEY = originalKey;
});

describe("Sbiz store registry provider", () => {
  it("normalizes public store records", () => {
    const result = parseSbizResponse(
      {
        response: {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          body: {
            totalCount: 1,
            items: {
              item: [
                {
                  bizesId: "store-1",
                  bizesNm: "동네빵집",
                  indsLclsNm: "음식",
                  indsMclsNm: "제과·제빵",
                  indsSclsNm: "베이커리",
                  lnoAdr: "서울 성동구 성수동1가",
                  rdnmAdr: "서울 성동구 성수이로 1",
                  lon: "127.05",
                  lat: "37.54",
                },
              ],
            },
          },
        },
      },
      "2026-06-22T00:00:00.000Z",
    );

    expect(result.stores[0]).toMatchObject({
      provider: "sbiz",
      externalId: "store-1",
      name: "동네빵집",
      latitude: 37.54,
      longitude: 127.05,
    });
  });

  it("ranks bakery records by name, address, and coordinates", () => {
    const matches = rankSbizMatches(
      {
        name: "동네 빵집",
        address: "서울 성동구 성수동1가",
        roadAddress: "서울 성동구 성수이로 1",
        latitude: 37.54,
        longitude: 127.05,
      },
      [
        {
          provider: "sbiz",
          externalId: "store-1",
          name: "동네빵집",
          industryMiddle: "제과·제빵",
          roadAddress: "서울 성동구 성수이로 1",
          latitude: 37.5401,
          longitude: 127.0501,
          retrievedAt: "2026-06-22T00:00:00.000Z",
        },
        {
          provider: "sbiz",
          externalId: "restaurant",
          name: "동네식당",
          industryMiddle: "한식",
          roadAddress: "서울 성동구 성수이로 1",
          latitude: 37.54,
          longitude: 127.05,
          retrievedAt: "2026-06-22T00:00:00.000Z",
        },
      ],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.score).toBe(100);
  });

  it("normalizes shortened and official metropolitan address names", () => {
    const matches = rankSbizMatches(
      {
        name: "퍼먼트",
        address: "서울 성동구 성수동1가",
        roadAddress: "서울 성동구 서울숲2길 37",
        latitude: 37.546,
        longitude: 127.043,
      },
      [
        {
          provider: "sbiz",
          externalId: "ferment",
          name: "퍼먼트알티드",
          industryMiddle: "기타 간이",
          industrySmall: "빵/도넛",
          roadAddress: "서울특별시 성동구 서울숲2길 37",
          latitude: 37.54601,
          longitude: 127.04301,
          retrievedAt: "2026-06-22T00:00:00.000Z",
        },
      ],
    );

    expect(matches[0]?.score).toBe(90);
    expect(matches[0]?.reasons).toContain("주소 일치");
  });

  it("accepts the official flat response shape", () => {
    const result = parseSbizResponse(
      {
        resultCode: "00",
        resultMsg: "NORMAL SERVICE.",
        totalCount: "1",
        items: [
          {
            bizesId: "flat-1",
            bizesNm: "평평한빵집",
            indsMclsNm: "제과·제빵",
            rdnmAdr: "서울 성동구 성수이로 2",
            lon: "127.05",
            lat: "37.54",
          },
        ],
      },
      "2026-06-22T00:00:00.000Z",
    );

    expect(result.stores[0]?.externalId).toBe("flat-1");
  });

  it("requires a public data service key", async () => {
    delete process.env.DATA_GO_KR_SERVICE_KEY;

    await expect(searchSbizStores(37.54, 127.05)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("uses the case-sensitive ServiceKey parameter from the official spec", async () => {
    process.env.DATA_GO_KR_SERVICE_KEY = "test-service-key";
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
            body: { totalCount: 0, items: { item: [] } },
          },
        }),
      );
    };

    await searchSbizStores(37.54, 127.05, fetcher);

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("ServiceKey")).toBe("test-service-key");
    expect(url.searchParams.has("serviceKey")).toBe(false);
    expect(url.searchParams.get("indsMclsCd")).toBe("I210");
  });
});
