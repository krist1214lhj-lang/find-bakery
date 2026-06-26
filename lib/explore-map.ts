import type { Bakery } from "@/lib/types";
import type { PlaceCandidate } from "@/lib/place-provider";
import { findPossibleDuplicateLocations } from "@/lib/place-candidate-matching";

// "같은 빵집" 판단 임계값. 이름/주소/전화/좌표 점수가 이 값을 넘으면 같은 곳으로 본다.
// 신호 1개(이름만 45·주소만 40·좌표만 30)로는 못 넘기고, 신호 2개 이상 일치해야 넘는다.
// → 다른 빵집을 같다고 잘못 거르는 일이 없도록 보수적으로 둔다(애매하면 남김).
const DEDUP_SCORE_THRESHOLD = 55;

export type ExploreMapItem =
  | {
      id: string;
      kind: "verified";
      name: string;
      latitude: number;
      longitude: number;
      address: string;
      bakery: Bakery;
    }
  | {
      id: string;
      kind: "candidate";
      name: string;
      latitude: number;
      longitude: number;
      address: string;
      candidate: PlaceCandidate;
    };

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export function buildExploreMapItems(
  bakeries: Bakery[],
  candidates: PlaceCandidate[],
): ExploreMapItem[] {
  // 이미 저장된 빵집과 같은 곳인 카카오 후보는 제외해 중복 표시를 막는다.
  // 빵집(verified)은 그대로 두고, 겹치는 "후보"만 걸러낸다.
  const dedupedCandidates = candidates.filter(
    (candidate) => !isSavedBakery(candidate, bakeries),
  );

  return [
    ...bakeries.map(
      (bakery): ExploreMapItem => ({
        id: `bakery:${bakery.id}`,
        kind: "verified",
        name: bakery.name,
        latitude: bakery.latitude,
        longitude: bakery.longitude,
        address: bakery.roadAddress,
        bakery,
      }),
    ),
    ...dedupedCandidates.map(
      (candidate): ExploreMapItem => ({
        id: `candidate:${candidate.externalId}`,
        kind: "candidate",
        name: candidate.name,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        address: candidate.roadAddress ?? candidate.address,
        candidate,
      }),
    ),
  ];
}

// 카카오 후보가 이미 저장된 빵집과 "같은 곳"인지 판단한다.
function isSavedBakery(candidate: PlaceCandidate, bakeries: Bakery[]) {
  // 1순위: 카카오 placeId 일치 → 100% 같은 가게(가장 확실). 무조건 중복.
  //   저장 빵집 slug 는 "kakao-<placeId>" 로 placeId 를 담는다(approve-and-save 규칙).
  const hasSamePlaceId = bakeries.some(
    (bakery) => bakeryKakaoPlaceId(bakery.slug) === candidate.externalId,
  );
  if (hasSamePlaceId) {
    return true;
  }

  // 2순위: placeId 가 없을 때만, 이름·주소·전화·좌표 점수로 판단(신호 2개 이상).
  const matches = findPossibleDuplicateLocations(
    {
      name: candidate.name,
      roadAddress: candidate.roadAddress,
      address: candidate.address,
      phone: candidate.phone,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    },
    bakeries.map((bakery) => ({
      id: bakery.id,
      name: bakery.name,
      roadAddress: bakery.roadAddress,
      phone: bakery.phone,
      latitude: bakery.latitude,
      longitude: bakery.longitude,
    })),
  );

  return matches.some((match) => match.score >= DEDUP_SCORE_THRESHOLD);
}

// 저장 빵집 slug 에서 카카오 placeId 를 꺼낸다("kakao-1512893541" → "1512893541").
// 사람이 지은 slug(seed 데이터)는 형식이 안 맞아 undefined → placeId 매칭에서 자연히 빠진다.
function bakeryKakaoPlaceId(slug: string): string | undefined {
  const matched = slug.match(/^kakao-(\d+)$/);
  return matched ? matched[1] : undefined;
}

export function filterItemsByBounds(
  items: ExploreMapItem[],
  bounds: MapBounds,
) {
  return items.filter(
    (item) =>
      item.latitude >= bounds.south &&
      item.latitude <= bounds.north &&
      item.longitude >= bounds.west &&
      item.longitude <= bounds.east,
  );
}

export function getMapCenter(items: ExploreMapItem[]) {
  if (items.length === 0) {
    return { latitude: 36.35, longitude: 127.8 };
  }

  return {
    latitude:
      items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
    longitude:
      items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
  };
}

export function getMapSearchRadius(bounds: MapBounds) {
  const centerLatitude = (bounds.south + bounds.north) / 2;
  const latitudeMeters = (bounds.north - bounds.south) * 111_320;
  const longitudeMeters =
    (bounds.east - bounds.west) *
    111_320 *
    Math.cos((centerLatitude * Math.PI) / 180);
  const halfDiagonal =
    Math.sqrt(latitudeMeters ** 2 + longitudeMeters ** 2) / 2;

  return Math.min(20_000, Math.max(500, Math.round(halfDiagonal)));
}
