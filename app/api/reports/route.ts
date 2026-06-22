import { NextResponse } from "next/server";
import { getBakeryById } from "@/lib/bakery-repository";
import { validateCorrectionDraft } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CorrectionCategory,
  CorrectionDraft,
  StoredCorrectionReport,
} from "@/lib/types";

const categoryMap: Record<
  CorrectionCategory,
  "hours" | "closure" | "relocation" | "menu_price" | "phone_address" | "other"
> = {
  hours: "hours",
  closure: "closure",
  relocation: "relocation",
  "menu-price": "menu_price",
  "phone-address": "phone_address",
  other: "other",
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return jsonError("요청 내용이 너무 큽니다.", 413);
  }

  const draft = await readDraft(request);
  if (!draft) {
    return jsonError("요청 형식을 확인해 주세요.", 400);
  }

  const validation = validateCorrectionDraft(draft);
  if (!validation.valid) {
    return jsonError(validation.message, 400);
  }

  const bakery = await getBakeryById(draft.bakeryId);
  if (!bakery || bakery.name !== draft.bakeryName) {
    return jsonError("제보할 빵집을 찾을 수 없어요.", 404);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { mode: "local-only" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await supabase
    .from("correction_reports")
    .insert({
      location_id: draft.bakeryId,
      reporter_id: null,
      category: categoryMap[draft.category],
      description: draft.description.trim(),
      source_url: draft.sourceUrl?.trim() || null,
      status: "submitted",
    })
    .select(
      "id, location_id, category, description, source_url, status, created_at",
    )
    .single();

  if (error) {
    console.error("Correction report insert failed", {
      code: error.code,
      message: error.message,
    });
    return jsonError("제보를 서버에 저장하지 못했어요.", 500);
  }

  const report: StoredCorrectionReport = {
    id: data.id,
    bakeryId: data.location_id,
    bakeryName: bakery.name,
    category: draft.category,
    description: data.description,
    sourceUrl: data.source_url ?? undefined,
    status: "submitted",
    createdAt: data.created_at,
  };

  return NextResponse.json(
    { report },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function readDraft(request: Request): Promise<CorrectionDraft | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object") {
      return null;
    }

    const draft = value as Partial<CorrectionDraft>;
    if (
      typeof draft.bakeryId !== "string" ||
      typeof draft.bakeryName !== "string" ||
      typeof draft.category !== "string" ||
      typeof draft.description !== "string" ||
      (draft.sourceUrl !== undefined && typeof draft.sourceUrl !== "string")
    ) {
      return null;
    }

    return draft as CorrectionDraft;
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
