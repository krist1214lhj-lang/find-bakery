import { NextResponse } from "next/server";
import { verifyPlaceCandidateToken } from "@/lib/place-candidate-token";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const token = await readToken(request);
  if (!token) {
    return jsonError("검수 요청 형식을 확인해 주세요.", 400);
  }

  const candidate = verifyPlaceCandidateToken(token);
  if (!candidate) {
    return jsonError("장소 검색 결과가 만료됐어요. 다시 검색해 주세요.", 400);
  }

  const region = parseKoreanAddress(candidate.roadAddress ?? candidate.address);
  if (!region) {
    return jsonError("장소의 행정구역을 확인하지 못했어요.", 400);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonError("Supabase 관리자 설정이 필요합니다.", 503);
  }

  const { data, error } = await supabase
    .from("place_candidates")
    .upsert(
      {
        provider: candidate.provider,
        external_id: candidate.externalId,
        name: candidate.name,
        category: candidate.category,
        address: candidate.address,
        road_address: candidate.roadAddress ?? null,
        phone: candidate.phone ?? null,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        region_level_1: region.level1,
        region_level_2: region.level2,
        region_level_3: region.level3,
        place_url: candidate.placeUrl,
        last_seen_at: candidate.retrievedAt,
      },
      { onConflict: "provider,external_id" },
    )
    .select("id,status")
    .single();

  if (error) {
    console.error("Place candidate capture failed", {
      code: error.code,
      message: error.message,
    });
    return jsonError("검수 요청을 저장하지 못했어요.", 500);
  }

  return NextResponse.json(
    { id: data.id, status: data.status },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function readToken(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object") {
      return null;
    }
    const token = (value as { token?: unknown }).token;
    return typeof token === "string" && token.length <= 8_192 ? token : null;
  } catch {
    return null;
  }
}

function parseKoreanAddress(address: string) {
  const parts = address.trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  return {
    level1: parts[0],
    level2: parts[1],
    level3: parts[2] || null,
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
