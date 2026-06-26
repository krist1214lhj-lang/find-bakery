import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applySafety,
  buildUserPrompt,
  collectFromResponse,
  computeCostKrw,
  MAX_SEARCHES,
  MAX_TOKENS,
  parseVerdict,
  SYSTEM_PROMPT,
  VERIFY_MODEL,
  type ResearchInput,
  type ResearchResult,
} from "@/lib/verification-research-core";

// 빵집 "정밀 검증" — Claude 웹검색으로 블로그·뉴스·맛집매체를 교차확인해
// 신뢰등급(C/B/A)을 "제안"한다. (DB 쓰기 없음 — 사용자가 "적용"할 때만 기록)
// 비용 절감: Haiku 4.5 우선, 웹검색 최대 2회, 사용자가 누른 1곳만 호출.
// 규칙: ANTHROPIC_API_KEY 는 .env*(gitignored)/환경변수에서만(하드코딩 금지).

export {
  VERIFY_MODEL,
  estimatedCostKrw,
  type ResearchInput,
  type ResearchResult,
  type VerificationSource,
  type ProposedGrade,
} from "@/lib/verification-research-core";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function loadKey(name: string): string {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  for (const f of [".env.local", ".env.remote.local"]) {
    try {
      const text = readFileSync(path.join(process.cwd(), f), "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*#/.test(line)) continue;
        const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
        if (m) return m[1].replace(/^"(.*)"$/, "$1").trim();
      }
    } catch {
      // 다음 후보로
    }
  }
  return "";
}

export async function researchBakeryGrade(
  input: ResearchInput,
): Promise<ResearchResult> {
  const apiKey = loadKey("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 가 없습니다(.env.local 등에 설정 필요). 정밀 검증을 할 수 없습니다.",
    );
  }
  if (!input.name?.trim()) throw new Error("빵집 이름이 필요합니다.");

  const body = {
    model: VERIFY_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: MAX_SEARCHES,
        user_location: { type: "approximate", country: "KR" },
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Claude 호출 실패 (HTTP ${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as Parameters<typeof collectFromResponse>[0];
  const collected = collectFromResponse(data);
  const verdict = parseVerdict(collected.text);

  // 모델이 고른 출처가 비면 실제 검색결과 상위로 보강(표시용).
  const sources =
    verdict.sources.length > 0
      ? verdict.sources
      : collected.realSources.slice(0, 3);
  const finalVerdict = applySafety({ ...verdict, sources });

  return {
    ...finalVerdict,
    model: VERIFY_MODEL,
    searchCount: collected.searchCount,
    usage: {
      inputTokens: collected.usage.inputTokens,
      outputTokens: collected.usage.outputTokens,
    },
    costKrw: computeCostKrw(collected.usage, collected.searchCount, VERIFY_MODEL),
  };
}
