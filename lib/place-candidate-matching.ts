import type { PlaceCandidateDuplicate } from "@/lib/place-provider";

type CandidateMatchInput = {
  name: string;
  roadAddress?: string | null;
  address: string;
  phone?: string | null;
  latitude: number;
  longitude: number;
};

type LocationMatchInput = {
  id: string;
  name: string;
  roadAddress: string;
  phone?: string | null;
  latitude: number;
  longitude: number;
};

export function findPossibleDuplicateLocations(
  candidate: CandidateMatchInput,
  locations: LocationMatchInput[],
): PlaceCandidateDuplicate[] {
  return locations
    .map((location) => scoreDuplicate(candidate, location))
    .filter((match): match is PlaceCandidateDuplicate => Boolean(match))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function scoreDuplicate(
  candidate: CandidateMatchInput,
  location: LocationMatchInput,
) {
  const reasons: string[] = [];
  let score = 0;
  if (normalize(candidate.name) === normalize(location.name)) {
    score += 45;
    reasons.push("상호 일치");
  }
  const candidateAddress = candidate.roadAddress || candidate.address;
  if (normalize(candidateAddress) === normalize(location.roadAddress)) {
    score += 40;
    reasons.push("주소 일치");
  }
  if (
    candidate.phone &&
    location.phone &&
    normalizePhone(candidate.phone) === normalizePhone(location.phone)
  ) {
    score += 35;
    reasons.push("전화번호 일치");
  }

  const distance = distanceMeters(
    candidate.latitude,
    candidate.longitude,
    location.latitude,
    location.longitude,
  );
  if (distance <= 50) {
    score += 30;
    reasons.push(`좌표 ${Math.round(distance)}m 이내`);
  } else if (distance <= 150) {
    score += 15;
    reasons.push(`좌표 ${Math.round(distance)}m 이내`);
  }

  return score >= 30
    ? {
        locationId: location.id,
        name: location.name,
        roadAddress: location.roadAddress,
        score: Math.min(score, 100),
        reasons,
      }
    : null;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
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
