export type StoreRegistryRecord = {
  provider: "sbiz";
  externalId: string;
  name: string;
  industryLarge?: string;
  industryMiddle?: string;
  industrySmall?: string;
  lotAddress?: string;
  roadAddress?: string;
  latitude: number;
  longitude: number;
  retrievedAt: string;
};

export type StoreRegistryMatch = StoreRegistryRecord & {
  score: number;
  reasons: string[];
};

export type StoreRegistrySearchResult = {
  stores: StoreRegistryRecord[];
  totalCount: number;
};

export class StoreRegistryProviderError extends Error {
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
    this.name = "StoreRegistryProviderError";
  }
}
