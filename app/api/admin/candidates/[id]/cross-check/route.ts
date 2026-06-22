import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { getAdminPlaceCandidate } from "@/lib/place-candidate-repository";
import { crossCheckWithSbiz } from "@/lib/sbiz-store-registry";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { StoreRegistryProviderError } from "@/lib/store-registry-provider";

type CrossCheckRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: CrossCheckRouteProps,
) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const { id } = await params;
  const candidate = await getAdminPlaceCandidate(id);
  if (!candidate) {
    return NextResponse.json(
      { message: "장소 후보를 찾을 수 없어요." },
      { status: 404 },
    );
  }

  try {
    const matches = await crossCheckWithSbiz(candidate);
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { message: "Supabase 관리자 설정이 필요합니다." },
        { status: 503 },
      );
    }

    if (matches.length > 0) {
      const { error } = await supabase.from("place_candidate_evidence").upsert(
        matches.map((match) => ({
          candidate_id: candidate.id,
          provider: match.provider,
          external_id: match.externalId,
          name: match.name,
          industry_large: match.industryLarge ?? null,
          industry_middle: match.industryMiddle ?? null,
          industry_small: match.industrySmall ?? null,
          lot_address: match.lotAddress ?? null,
          road_address: match.roadAddress ?? null,
          latitude: match.latitude,
          longitude: match.longitude,
          match_score: match.score,
          match_reasons: match.reasons,
          retrieved_at: match.retrievedAt,
        })),
        { onConflict: "candidate_id,provider,external_id" },
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json(
      { matches },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    if (cause instanceof StoreRegistryProviderError) {
      const status = {
        PROVIDER_UNAUTHORIZED: 502,
        PROVIDER_RATE_LIMITED: 429,
        PROVIDER_EMPTY_RESULT: 200,
        PROVIDER_TIMEOUT: 504,
        PROVIDER_INVALID_RESPONSE: 502,
        PROVIDER_UNAVAILABLE: 503,
      }[cause.code];
      return NextResponse.json(
        { matches: [], code: cause.code, message: cause.message },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { message: "공공데이터 교차 확인에 실패했어요." },
      { status: 500 },
    );
  }
}
