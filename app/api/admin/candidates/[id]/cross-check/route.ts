import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import { getAdminPlaceCandidate } from "@/lib/place-candidate-repository";
import { crossCheckWithSbiz } from "@/lib/sbiz-store-registry";
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
