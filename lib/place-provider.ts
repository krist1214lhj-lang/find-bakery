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
  captureToken?: string;
};

export type StoredPlaceCandidateStatus =
  | "discovered"
  | "in-review"
  | "approved"
  | "rejected"
  | "duplicate";

export type StoredPlaceCandidate = Omit<
  PlaceCandidate,
  "captureToken" | "distanceMeters"
> & {
  id: string;
  status: StoredPlaceCandidateStatus;
  regionLevel1: string;
  regionLevel2: string;
  regionLevel3?: string;
  matchedLocationId?: string;
  approvedLocationId?: string;
  createdAt: string;
  reviewedAt?: string;
  possibleDuplicates: PlaceCandidateDuplicate[];
  registryEvidence: PlaceCandidateRegistryEvidence[];
};

export type PlaceCandidateRegistryEvidence = {
  id: string;
  provider: "sbiz";
  externalId: string;
  name: string;
  roadAddress?: string;
  lotAddress?: string;
  score: number;
  reasons: string[];
  retrievedAt: string;
};

export type PlaceCandidateDuplicate = {
  locationId: string;
  name: string;
  roadAddress: string;
  score: number;
  reasons: string[];
};

export type PlaceCandidateReviewAction =
  | "hold"
  | "approve"
  | "reject"
  | "mark-duplicate";

export type StoredPlaceCandidateReviewAction = {
  id: string;
  candidateId: string;
  action: PlaceCandidateReviewAction;
  reason: string;
  previousStatus: StoredPlaceCandidateStatus;
  nextStatus: StoredPlaceCandidateStatus;
  matchedLocationId?: string;
  createdAt: string;
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
