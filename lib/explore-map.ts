import type { Bakery } from "@/lib/types";
import type { PlaceCandidate } from "@/lib/place-provider";

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
    ...candidates.map(
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
