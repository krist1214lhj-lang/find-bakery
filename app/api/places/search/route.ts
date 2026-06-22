import { NextResponse } from "next/server";
import { searchKakaoPlaces } from "@/lib/kakao-local";
import { signPlaceCandidate } from "@/lib/place-candidate-token";
import { PlaceProviderError } from "@/lib/place-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const latitude = readCoordinate(url.searchParams.get("lat"), -90, 90);
  const longitude = readCoordinate(url.searchParams.get("lon"), -180, 180);

  if (!query || query.length > 80) {
    return jsonError("1~80자의 검색어를 입력해 주세요.", 400);
  }
  if (
    (latitude === undefined) !== (longitude === undefined) ||
    latitude === null ||
    longitude === null
  ) {
    return jsonError("현재 위치 좌표를 확인해 주세요.", 400);
  }

  try {
    const result = await searchKakaoPlaces({
      query,
      latitude,
      longitude,
    });
    return NextResponse.json(
      {
        ...result,
        places: result.places.map((place) => ({
          ...place,
          captureToken: signPlaceCandidate(place),
        })),
      },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  } catch (cause) {
    if (cause instanceof PlaceProviderError) {
      if (cause.code === "PROVIDER_EMPTY_RESULT") {
        return NextResponse.json(
          {
            places: [],
            totalCount: 0,
            isEnd: true,
            message: cause.message,
          },
          { headers: { "Cache-Control": "private, max-age=60" } },
        );
      }

      const status = {
        PROVIDER_UNAUTHORIZED: 502,
        PROVIDER_RATE_LIMITED: 429,
        PROVIDER_TIMEOUT: 504,
        PROVIDER_INVALID_RESPONSE: 502,
        PROVIDER_UNAVAILABLE: 503,
      }[cause.code];
      return NextResponse.json(
        { code: cause.code, message: cause.message },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return jsonError("장소 검색 중 예상하지 못한 오류가 발생했어요.", 500);
  }
}

function readCoordinate(
  value: string | null,
  minimum: number,
  maximum: number,
) {
  if (value === null) {
    return undefined;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) &&
    coordinate >= minimum &&
    coordinate <= maximum
    ? coordinate
    : null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
