export type PlaceSearchInput = {
  query: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

export type PlaceCandidate = {
  provider: "kakao";
  externalId: string;
  name: string;
  category: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  latitude: number;
  longitude: number;
  placeUrl: string;
  distanceMeters?: number;
  retrievedAt: string;
};

export type PlaceSearchResult = {
  places: PlaceCandidate[];
  totalCount: number;
  isEnd: boolean;
};

export class PlaceProviderError extends Error {
  constructor(
    public readonly code:
      | "PROVIDER_UNAVAILABLE"
      | "PROVIDER_TIMEOUT"
      | "PROVIDER_RATE_LIMITED"
      | "PROVIDER_UNAUTHORIZED"
      | "PROVIDER_INVALID_RESPONSE"
      | "PROVIDER_EMPTY_RESULT",
    message: string,
  ) {
    super(message);
    this.name = "PlaceProviderError";
  }
}
