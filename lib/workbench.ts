// 로컬 전용 관리자 "작업대" 데이터 로더 (서버 전용 — fs 사용).
// 입력: output/stage2-verified.json (2차 검증 산출물). DB는 건드리지 않음(보기 단계).
// 좌표·주소·카테고리는 카카오값 그대로. 추측 없음.

import { readFileSync } from "node:fs";
import path from "node:path";

export type WorkbenchDecision = "승인후보" | "보류" | "제외";

export type WorkbenchItem = {
  id: string;
  decision: WorkbenchDecision;
  name: string;
  category: string;
  roadAddress: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  placeUrl: string | null;
  isFranchise: boolean;
  franchiseBrand: string | null;
  reason: string | null;
  decidedBy: string | null;
};

export type WorkbenchData = {
  items: WorkbenchItem[];
  generatedAt: string | null;
  model: string | null;
  error?: string;
};

const DECISIONS: WorkbenchDecision[] = ["승인후보", "보류", "제외"];

export function loadWorkbench(): WorkbenchData {
  const file = path.join(process.cwd(), "output", "stage2-verified.json");

  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {
      items: [],
      generatedAt: null,
      model: null,
      error:
        "output/stage2-verified.json 이 없습니다. 먼저 1차·2차 검증 스크립트를 실행해 산출물을 만들어 주세요.",
    };
  }

  let parsed: {
    results?: unknown[];
    generated_at?: string;
    model?: string;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      items: [],
      generatedAt: null,
      model: null,
      error: "stage2-verified.json 을 파싱하지 못했습니다(형식 오류).",
    };
  }

  const items: WorkbenchItem[] = (parsed.results ?? [])
    .map((entry, index): WorkbenchItem | null => {
      const r = entry as Record<string, unknown>;
      const decision = r.decision as string;
      if (!DECISIONS.includes(decision as WorkbenchDecision)) return null;
      const placeUrl = (r.place_url as string) ?? null;
      const idMatch = placeUrl?.match(/\/(\d+)\s*$/);
      const lat = typeof r.latitude === "number" ? r.latitude : null;
      const lon = typeof r.longitude === "number" ? r.longitude : null;
      return {
        id: idMatch ? `kakao-${idMatch[1]}` : `row-${index}`,
        decision: decision as WorkbenchDecision,
        name: (r.name as string) ?? "(이름 없음)",
        category: (r.category as string) ?? "",
        roadAddress: (r.road_address as string) ?? null,
        address: (r.address as string) ?? null,
        latitude: lat,
        longitude: lon,
        phone: (r.phone as string) ?? null,
        placeUrl,
        isFranchise: Boolean(r.is_franchise),
        franchiseBrand: (r.franchise_brand as string) ?? null,
        reason: (r.reason as string) ?? null,
        decidedBy: (r.decided_by as string) ?? null,
      };
    })
    .filter((x): x is WorkbenchItem => x !== null);

  return {
    items,
    generatedAt: parsed.generated_at ?? null,
    model: parsed.model ?? null,
  };
}
