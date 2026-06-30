// "이곳이 알려진 이유" 카드 출처 칩: normalized_value.sources({title,url,kind})에서
// 도메인 기반 매체명 + 공식 여부를 뽑는다. 서버 의존성 없는 순수 함수.

import type { FameSource } from "@/lib/types";

// 알려진 매체 도메인 → 친화 매체명. 미매핑은 공식이면 "공식 홈페이지", 아니면 호스트명.
const MEDIA_NAMES: Record<string, string> = {
  "diningcode.com": "다이닝코드",
  "siksinhot.com": "식신",
  "instagram.com": "인스타그램",
  "polle.com": "뽈레",
  "triple.guide": "트리플",
  "daangn.com": "당근",
  "mangoplate.com": "망고플레이트",
  "youtube.com": "유튜브",
  "naver.com": "네이버",
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return null;
  }
}

function mediaLabel(host: string, official: boolean): string {
  for (const [domain, name] of Object.entries(MEDIA_NAMES)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return official ? "공식 홈페이지" : host;
}

export function extractFameSources(normalizedValue: unknown): FameSource[] {
  if (!normalizedValue || typeof normalizedValue !== "object") return [];
  const sources = (normalizedValue as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return [];

  const seen = new Set<string>();
  const items: FameSource[] = [];
  for (const raw of sources) {
    if (!raw || typeof raw !== "object") continue;
    const rawUrl = (raw as { url?: unknown }).url;
    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const host = hostnameOf(url);
    if (!host || seen.has(host)) continue; // 매체 1개당 칩 1개
    seen.add(host);
    const official = (raw as { kind?: unknown }).kind === "official";
    items.push({ url, label: mediaLabel(host, official), official });
  }
  // 공식 출처를 앞으로(나머지는 원래 순서 유지 — Array.prototype.sort는 안정 정렬)
  items.sort((a, b) => Number(b.official) - Number(a.official));
  return items;
}
