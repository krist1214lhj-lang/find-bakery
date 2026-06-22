import { afterEach, describe, expect, it } from "vitest";
import {
  signPlaceCandidate,
  verifyPlaceCandidateToken,
} from "@/lib/place-candidate-token";
import type { PlaceCandidate } from "@/lib/place-provider";

const originalKey = process.env.KAKAO_REST_API_KEY;
const candidate: PlaceCandidate = {
  provider: "kakao",
  externalId: "123",
  name: "동네빵집",
  category: "음식점 > 간식 > 제과,베이커리",
  address: "서울 성동구 성수동1가",
  roadAddress: "서울 성동구 성수이로 1",
  phone: "02-123-4567",
  latitude: 37.54,
  longitude: 127.05,
  placeUrl: "https://place.map.kakao.com/123",
  retrievedAt: "2026-06-22T00:00:00.000Z",
};

afterEach(() => {
  process.env.KAKAO_REST_API_KEY = originalKey;
});

describe("place candidate capture token", () => {
  it("round-trips a server-signed candidate", () => {
    process.env.KAKAO_REST_API_KEY = "test-key";
    const token = signPlaceCandidate(candidate);

    expect(verifyPlaceCandidateToken(token)).toEqual(candidate);
  });

  it("rejects a tampered token", () => {
    process.env.KAKAO_REST_API_KEY = "test-key";
    const token = signPlaceCandidate(candidate);

    expect(verifyPlaceCandidateToken(`${token}x`)).toBeNull();
  });
});
