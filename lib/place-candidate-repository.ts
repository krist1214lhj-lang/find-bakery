import "server-only";

import { findPossibleDuplicateLocations } from "@/lib/place-candidate-matching";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  PlaceCandidateReviewAction,
  StoredPlaceCandidate,
  StoredPlaceCandidateReviewAction,
  StoredPlaceCandidateStatus,
} from "@/lib/place-provider";

type CandidateRow = Database["public"]["Tables"]["place_candidates"]["Row"];
type CandidateActionRow =
  Database["public"]["Tables"]["place_candidate_review_actions"]["Row"];
type LocationRow = Pick<
  Database["public"]["Tables"]["bakery_locations"]["Row"],
  "id" | "name" | "road_address" | "phone" | "latitude" | "longitude"
>;

export type AdminPlaceCandidateQueue = {
  candidates: StoredPlaceCandidate[];
  actions: StoredPlaceCandidateReviewAction[];
};

export async function getAdminPlaceCandidateQueue(): Promise<AdminPlaceCandidateQueue> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const [candidatesResult, actionsResult, locationsResult] = await Promise.all([
    supabase.from("place_candidates").select("*").order("created_at", {
      ascending: false,
    }),
    supabase
      .from("place_candidate_review_actions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("bakery_locations")
      .select("id,name,road_address,phone,latitude,longitude"),
  ]);

  const failed = [candidatesResult, actionsResult, locationsResult].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`장소 후보 큐 조회 실패: ${failed.error.message}`);
  }

  const locations = locationsResult.data ?? [];
  return {
    candidates: (candidatesResult.data ?? []).map((candidate) =>
      mapCandidate(candidate, locations),
    ),
    actions: (actionsResult.data ?? []).map(mapCandidateAction),
  };
}

export async function getAdminPlaceCandidate(candidateId: string) {
  const queue = await getAdminPlaceCandidateQueue();
  return queue.candidates.find((candidate) => candidate.id === candidateId);
}

export async function reviewAdminPlaceCandidate(
  candidateId: string,
  action: PlaceCandidateReviewAction,
  reason: string,
  matchedLocationId?: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 관리자 설정이 필요합니다.");
  }

  const args: Database["public"]["Functions"]["review_place_candidate"]["Args"] =
    {
      candidate_id: candidateId,
      review_action: toDatabaseReviewAction(action),
      review_reason: reason.trim(),
    };
  if (matchedLocationId) {
    args.duplicate_location_id = matchedLocationId;
  }

  const { error } = await supabase.rpc("review_place_candidate", args);
  if (error) {
    throw new Error(error.message);
  }

  return getAdminPlaceCandidateQueue();
}

function mapCandidate(
  candidate: CandidateRow,
  locations: LocationRow[],
): StoredPlaceCandidate {
  return {
    id: candidate.id,
    provider: "kakao",
    externalId: candidate.external_id,
    name: candidate.name,
    category: candidate.category,
    address: candidate.address,
    roadAddress: candidate.road_address ?? undefined,
    phone: candidate.phone ?? undefined,
    latitude: Number(candidate.latitude),
    longitude: Number(candidate.longitude),
    placeUrl: candidate.place_url,
    retrievedAt: candidate.last_seen_at,
    status: fromDatabaseStatus(candidate.status),
    regionLevel1: candidate.region_level_1,
    regionLevel2: candidate.region_level_2,
    regionLevel3: candidate.region_level_3 ?? undefined,
    matchedLocationId: candidate.matched_location_id ?? undefined,
    approvedLocationId: candidate.approved_location_id ?? undefined,
    createdAt: candidate.created_at,
    reviewedAt: candidate.reviewed_at ?? undefined,
    possibleDuplicates: findPossibleDuplicateLocations(
      {
        name: candidate.name,
        address: candidate.address,
        roadAddress: candidate.road_address,
        phone: candidate.phone,
        latitude: Number(candidate.latitude),
        longitude: Number(candidate.longitude),
      },
      locations.map((location) => ({
        id: location.id,
        name: location.name,
        roadAddress: location.road_address,
        phone: location.phone,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      })),
    ),
  };
}

function mapCandidateAction(
  action: CandidateActionRow,
): StoredPlaceCandidateReviewAction {
  return {
    id: action.id,
    candidateId: action.candidate_id,
    action: fromDatabaseReviewAction(action.action),
    reason: action.reason,
    previousStatus: fromDatabaseStatus(action.previous_status),
    nextStatus: fromDatabaseStatus(action.next_status),
    matchedLocationId: action.matched_location_id ?? undefined,
    createdAt: action.created_at,
  };
}

function fromDatabaseStatus(
  status: Database["public"]["Enums"]["place_candidate_status"],
): StoredPlaceCandidateStatus {
  return status === "in_review" ? "in-review" : status;
}

function toDatabaseReviewAction(action: PlaceCandidateReviewAction) {
  return action === "mark-duplicate" ? "mark_duplicate" : action;
}

function fromDatabaseReviewAction(
  action: Database["public"]["Enums"]["place_candidate_review_action"],
): PlaceCandidateReviewAction {
  return action === "mark_duplicate" ? "mark-duplicate" : action;
}
