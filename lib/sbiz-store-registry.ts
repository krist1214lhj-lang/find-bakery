import type { StoredPlaceCandidate } from "@/lib/place-provider";
import {
  StoreRegistryProviderError,
  type StoreRegistryMatch,
  type StoreRegistryRecord,
  type StoreRegistrySearchResult,
} from "@/lib/store-registry-provider";

const DEFAULT_API_URL =
  "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";
const SEARCH_RADIUS_METERS = 300;
type Fetcher = typeof fetch;

export async function crossCheckWithSbiz(
  candidate: StoredPlaceCandidate,
  fetcher: Fetcher = fetch,
) {
  const result = await searchSbizStores(
    candidate.latitude,
    candidate.longitude,
    fetcher,
  );
  return rankSbizMatches(candidate, result.stores);
}

export async function searchSbizStores(
  latitude: number,
  longitude: number,
  fetcher: Fetcher = fetch,
): Promise<StoreRegistrySearchResult> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new StoreRegistryProviderError(
      "PROVIDER_UNAVAILABLE",
      "공공데이터포털 서비스 키가 필요합니다.",
    );
  }

  const url = new URL(process.env.DATA_GO_KR_STORE_API_URL || DEFAULT_API_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("radius", String(SEARCH_RADIUS_METERS));
  url.searchParams.set("cx", String(longitude));
  url.searchParams.set("cy", String(latitude));
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("type", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  let response: Response;
  try {
    response = await fetcher(url, {
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new StoreRegistryProviderError(
        "PROVIDER_TIMEOUT",
        "공공 상가정보 응답이 늦어지고 있어요.",
      );
    }
    throw new StoreRegistryProviderError(
      "PROVIDER_UNAVAILABLE",
      "공공 상가정보 서비스에 연결하지 못했어요.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new StoreRegistryProviderError(
      "PROVIDER_UNAUTHORIZED",
      "공공데이터포털 인증키를 확인해 주세요.",
    );
  }
  if (response.status === 429) {
    throw new StoreRegistryProviderError(
      "PROVIDER_RATE_LIMITED",
      "공공데이터 호출 한도를 초과했어요.",
    );
  }
  if (!response.ok) {
    throw new StoreRegistryProviderError(
      "PROVIDER_UNAVAILABLE",
      "공공 상가정보 서비스가 일시적으로 응답하지 않아요.",
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  return parseSbizResponse(payload, new Date().toISOString());
}

export function parseSbizResponse(
  payload: unknown,
  retrievedAt: string,
): StoreRegistrySearchResult {
  if (!isRecord(payload) || !isRecord(payload.response)) {
    throw invalidResponse();
  }
  const response = payload.response;
  if (!isRecord(response.header) || !isRecord(response.body)) {
    throw invalidResponse();
  }

  const resultCode = String(response.header.resultCode ?? "");
  if (resultCode && resultCode !== "00" && resultCode !== "0000") {
    throw new StoreRegistryProviderError(
      resultCode.includes("AUTH")
        ? "PROVIDER_UNAUTHORIZED"
        : "PROVIDER_UNAVAILABLE",
      typeof response.header.resultMsg === "string"
        ? response.header.resultMsg
        : "공공 상가정보 조회에 실패했어요.",
    );
  }

  const body = response.body;
  const totalCount = Number(body.totalCount ?? 0);
  const rawItems = isRecord(body.items) ? body.items.item : [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const stores = items.map((item) => parseStore(item, retrievedAt));
  return {
    stores,
    totalCount: Number.isFinite(totalCount) ? totalCount : stores.length,
  };
}

export function rankSbizMatches(
  candidate: Pick<
    StoredPlaceCandidate,
    "name" | "address" | "roadAddress" | "latitude" | "longitude"
  >,
  stores: StoreRegistryRecord[],
): StoreRegistryMatch[] {
  return stores
    .filter(isBakeryStore)
    .map((store) => {
      const reasons: string[] = [];
      let score = 0;
      if (normalize(candidate.name) === normalize(store.name)) {
        score += 50;
        reasons.push("상호 일치");
      } else if (
        normalize(candidate.name).includes(normalize(store.name)) ||
        normalize(store.name).includes(normalize(candidate.name))
      ) {
        score += 25;
        reasons.push("상호 유사");
      }

      const candidateAddress = candidate.roadAddress ?? candidate.address;
      const storeAddress = store.roadAddress ?? store.lotAddress ?? "";
      if (normalize(candidateAddress) === normalize(storeAddress)) {
        score += 35;
        reasons.push("주소 일치");
      }

      const distance = distanceMeters(
        candidate.latitude,
        candidate.longitude,
        store.latitude,
        store.longitude,
      );
      if (distance <= 50) {
        score += 30;
        reasons.push(`좌표 ${Math.round(distance)}m 이내`);
      } else if (distance <= 150) {
        score += 15;
        reasons.push(`좌표 ${Math.round(distance)}m 이내`);
      }

      return { ...store, score: Math.min(score, 100), reasons };
    })
    .filter((match) => match.score >= 40)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function parseStore(value: unknown, retrievedAt: string): StoreRegistryRecord {
  if (!isRecord(value)) {
    throw invalidResponse();
  }
  const externalId = readString(value, "bizesId");
  const name = readString(value, "bizesNm");
  const latitude = Number(value.lat);
  const longitude = Number(value.lon);
  if (
    !externalId ||
    !name ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw invalidResponse();
  }

  return {
    provider: "sbiz",
    externalId,
    name,
    industryLarge: readString(value, "indsLclsNm"),
    industryMiddle: readString(value, "indsMclsNm"),
    industrySmall: readString(value, "indsSclsNm"),
    lotAddress: readString(value, "lnoAdr"),
    roadAddress: readString(value, "rdnmAdr"),
    latitude,
    longitude,
    retrievedAt,
  };
}

function isBakeryStore(store: StoreRegistryRecord) {
  return [store.industryLarge, store.industryMiddle, store.industrySmall].some(
    (value) => /(제과|베이커리|빵|떡\/한과)/u.test(value ?? ""),
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function invalidResponse() {
  return new StoreRegistryProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "공공 상가정보 응답 형식을 확인하지 못했어요.",
  );
}
