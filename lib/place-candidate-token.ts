import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlaceCandidate } from "@/lib/place-provider";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 15 * 60 * 1000;

type CandidateTokenPayload = {
  version: number;
  expiresAt: number;
  candidate: Omit<PlaceCandidate, "captureToken" | "distanceMeters">;
};

export function signPlaceCandidate(candidate: PlaceCandidate) {
  const payload: CandidateTokenPayload = {
    version: TOKEN_VERSION,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    candidate: {
      provider: candidate.provider,
      externalId: candidate.externalId,
      name: candidate.name,
      category: candidate.category,
      address: candidate.address,
      roadAddress: candidate.roadAddress,
      phone: candidate.phone,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      placeUrl: candidate.placeUrl,
      retrievedAt: candidate.retrievedAt,
    },
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createSignature(encoded)}`;
}

export function verifyPlaceCandidateToken(token: string) {
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) {
    return null;
  }

  const expectedSignature = createSignature(encoded);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CandidateTokenPayload;
    if (
      payload.version !== TOKEN_VERSION ||
      payload.expiresAt < Date.now() ||
      !isCandidate(payload.candidate)
    ) {
      return null;
    }
    return payload.candidate;
  } catch {
    return null;
  }
}

function createSignature(encoded: string) {
  const secret = process.env.KAKAO_REST_API_KEY?.trim();
  if (!secret) {
    throw new Error("장소 후보 서명 설정이 필요합니다.");
  }
  return createHmac("sha256", `place-candidate-v1:${secret}`)
    .update(encoded)
    .digest("base64url");
}

function isCandidate(
  candidate: CandidateTokenPayload["candidate"],
): candidate is CandidateTokenPayload["candidate"] {
  return (
    candidate?.provider === "kakao" &&
    typeof candidate.externalId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.address === "string" &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number" &&
    typeof candidate.placeUrl === "string" &&
    typeof candidate.retrievedAt === "string"
  );
}
