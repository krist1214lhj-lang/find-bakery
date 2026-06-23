import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/admin-report-repository";
import {
  parseOfficialVerificationDraft,
} from "@/lib/official-verification";
import { registerAdminOfficialVerification } from "@/lib/official-verification-repository";

export async function POST(request: Request) {
  if (!isDemoAdminEnabled()) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json(
      { message: "공식 확인 요청 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  const parsed = parseOfficialVerificationDraft(value);
  if (!parsed.ok) {
    return NextResponse.json(
      { message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const queue = await registerAdminOfficialVerification(parsed.value);
    return NextResponse.json(queue, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Official verification registration failed", {
      message: cause instanceof Error ? cause.message : "unknown error",
    });
    return NextResponse.json(
      { message: "공식 확인을 등록하지 못했어요." },
      { status: 500 },
    );
  }
}
