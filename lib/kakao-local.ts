import {
  PlaceProviderError,
  type PlaceCandidate,
  type PlaceSearchInput,
  type PlaceSearchResult,
} from "@/lib/place-provider";

const KAKAO_KEYWORD_SEARCH_URL =
  "https://dapi.kakao.com/v2/local/search/keyword.json";
const DEFAULT_RADIUS_METERS = 5_000;
const MAX_RADIUS_METERS = 20_000;

type Fetcher = typeof fetch;

export async function searchKakaoPlaces(
  input: PlaceSearchInput,
  fetcher: Fetcher = fetch,
): Promise<PlaceSearchResult> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    throw new PlaceProviderError(
      "PROVIDER_UNAVAILABLE",
      "카카오 장소 검색 설정이 필요합니다.",
    );
  }

  const query = normalizeBakeryQuery(input.query);
  if (!query) {
    throw new PlaceProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "검색어를 입력해 주세요.",
    );
  }

  const url = new URL(KAKAO_KEYWORD_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("size", "15");

  if (
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    isCoordinate(input.latitude, input.longitude)
  ) {
    url.searchParams.set("x", String(input.longitude));
    url.searchParams.set("y", String(input.latitude));
    url.searchParams.set(
      "radius",
      String(clampRadius(input.radiusMeters ?? DEFAULT_RADIUS_METERS)),
    );
    url.searchParams.set("sort", "distance");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new PlaceProviderError(
        "PROVIDER_TIMEOUT",
        "장소 검색 응답이 늦어지고 있어요.",
      );
    }
    throw new PlaceProviderError(
      "PROVIDER_UNAVAILABLE",
      "장소 검색 서비스에 연결하지 못했어요.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new PlaceProviderError(
      "PROVIDER_UNAUTHORIZED",
      "카카오 장소 검색 인증을 확인해 주세요.",
    );
  }
  if (response.status === 429) {
    throw new PlaceProviderError(
      "PROVIDER_RATE_LIMITED",
      "장소 검색 요청이 많아 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok) {
    throw new PlaceProviderError(
      "PROVIDER_UNAVAILABLE",
      "장소 검색 서비스가 일시적으로 응답하지 않아요.",
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  const parsed = parseKakaoPlaceSearchResponse(
    payload,
    new Date().toISOString(),
  );
  if (parsed.places.length === 0) {
    throw new PlaceProviderError(
      "PROVIDER_EMPTY_RESULT",
      "조건에 맞는 카카오 장소를 찾지 못했어요.",
    );
  }
  return parsed;
}

export function parseKakaoPlaceSearchResponse(
  payload: unknown,
  retrievedAt: string,
): PlaceSearchResult {
  if (!isRecord(payload) || !isRecord(payload.meta)) {
    throw invalidResponse();
  }

  const { documents, meta } = payload;
  if (
    !Array.isArray(documents) ||
    typeof meta.total_count !== "number" ||
    typeof meta.is_end !== "boolean"
  ) {
    throw invalidResponse();
  }

  const places = documents.map((document) =>
    parseKakaoPlace(document, retrievedAt),
  );
  return {
    places,
    totalCount: meta.total_count,
    isEnd: meta.is_end,
  };
}

function parseKakaoPlace(value: unknown, retrievedAt: string): PlaceCandidate {
  if (!isRecord(value)) {
    throw invalidResponse();
  }

  const externalId = readRequiredString(value, "id");
  const name = readRequiredString(value, "place_name");
  const category = readRequiredString(value, "category_name");
  const address = readRequiredString(value, "address_name");
  const x = readRequiredString(value, "x");
  const y = readRequiredString(value, "y");
  const placeUrl = readRequiredString(value, "place_url");
  if (
    externalId === null ||
    name === null ||
    category === null ||
    address === null ||
    x === null ||
    y === null ||
    placeUrl === null
  ) {
    throw invalidResponse();
  }

  const longitude = Number(x);
  const latitude = Number(y);
  if (!isCoordinate(latitude, longitude)) {
    throw invalidResponse();
  }

  const distance =
    typeof value.distance === "string" && value.distance.trim()
      ? Number(value.distance)
      : NaN;
  return {
    provider: "kakao",
    externalId,
    name,
    category,
    address,
    roadAddress:
      typeof value.road_address_name === "string" && value.road_address_name
        ? value.road_address_name
        : undefined,
    phone:
      typeof value.phone === "string" && value.phone ? value.phone : undefined,
    latitude,
    longitude,
    placeUrl,
    distanceMeters: Number.isFinite(distance) ? distance : undefined,
    retrievedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : null;
}

function isCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function normalizeBakeryQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return "";
  }

  return /(빵|베이커리|제과|bakery)/iu.test(trimmed)
    ? trimmed
    : `${trimmed} 빵집`;
}

function clampRadius(radius: number) {
  if (!Number.isFinite(radius)) {
    return DEFAULT_RADIUS_METERS;
  }
  return Math.min(MAX_RADIUS_METERS, Math.max(1, Math.round(radius)));
}

function invalidResponse() {
  return new PlaceProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "장소 검색 응답 형식을 확인하지 못했어요.",
  );
}
