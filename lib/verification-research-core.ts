// 빵집 "정밀 검증"의 순수 로직(네트워크/서버 의존 없음 — 테스트 대상).
// 서버 전용 호출부는 verification-research.ts 에 있다.

export const VERIFY_MODEL = "claude-haiku-4-5"; // ← 정확도 아쉬우면 "claude-sonnet-4-6"
export const MAX_SEARCHES = 2; // 웹검색 하드캡(곳당)
export const MAX_TOKENS = 1500;

// 단가(공식, 2026-05 기준): $ per 1M tokens. 웹검색 $0.01/회.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};
const WEB_SEARCH_USD = 0.01;
const USD_TO_KRW = 1450; // 표시용 환율(대략)

export type ProposedGrade = "A" | "B" | "C" | null;

export type VerificationSource = {
  title: string;
  url: string;
  summary?: string;
  kind: "official" | "news" | "blog" | "other";
};

// 작업대 빵 카테고리(체크박스)와 동일한 slug 집합.
export const CATEGORY_SLUGS = [
  "salt-bread",
  "bagel",
  "baked-sweets",
  "meal-bread",
  "cake",
  "croissant",
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export type CategorySuggestion = { slug: CategorySlug; evidence: string };

export type VerificationVerdict = {
  proposedGrade: ProposedGrade;
  confidence: "high" | "medium" | "low";
  rationale: string;
  sources: VerificationSource[];
  categories: CategorySuggestion[];
};

export type ResearchInput = {
  name: string;
  region?: string | null;
  roadAddress?: string | null;
  category?: string | null;
  placeUrl?: string | null;
};

export type ResearchResult = VerificationVerdict & {
  model: string;
  searchCount: number;
  usage: { inputTokens: number; outputTokens: number };
  costKrw: number;
};

export function clampGrade(value: unknown): ProposedGrade {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

function clampConfidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

export function normalizeSources(value: unknown): VerificationSource[] {
  if (!Array.isArray(value)) return [];
  const out: VerificationSource[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const kind =
      r.kind === "official" || r.kind === "news" || r.kind === "blog"
        ? r.kind
        : "other";
    out.push({
      title:
        typeof r.title === "string" && r.title.trim() ? r.title.trim() : url,
      url,
      summary:
        typeof r.summary === "string" && r.summary.trim()
          ? r.summary.trim()
          : undefined,
      kind,
    });
    if (out.length >= 5) break;
  }
  return out;
}

// 카테고리 제안: 유효 slug + 비어있지 않은 근거(evidence)만(추측 금지). slug 중복 제거.
export function normalizeCategories(value: unknown): CategorySuggestion[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(CATEGORY_SLUGS);
  const out: CategorySuggestion[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const slug = typeof r.slug === "string" ? r.slug.trim() : "";
    const evidence = typeof r.evidence === "string" ? r.evidence.trim() : "";
    if (!valid.has(slug) || !evidence || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug: slug as CategorySlug, evidence });
    if (out.length >= CATEGORY_SLUGS.length) break;
  }
  return out;
}

// 안전 규칙: 출처가 하나도 없으면 등급·카테고리 제안을 모두 보류한다(추측 금지 원칙).
export function applySafety(verdict: VerificationVerdict): VerificationVerdict {
  if (verdict.sources.length === 0) {
    return {
      ...verdict,
      categories: [],
      proposedGrade: null,
      confidence: "low",
      rationale:
        verdict.proposedGrade !== null
          ? verdict.rationale + " (출처를 제시하지 못해 등급 제안을 보류합니다.)"
          : verdict.rationale,
    };
  }
  return verdict;
}

function extractLastJsonObject(text: string): string | null {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const body = fences[i][1].trim();
    if (body.startsWith("{")) return body;
  }
  // 폴백: 마지막 '}' 에서 역방향으로 중괄호를 맞춰 가장 바깥 객체를 찾는다.
  const end = text.lastIndexOf("}");
  if (end === -1) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) return text.slice(i, end + 1);
    }
  }
  return null;
}

// 모델 응답 텍스트에서 마지막 JSON 평결 블록을 뽑아 파싱한다.
export function parseVerdict(text: string): VerificationVerdict {
  const json = extractLastJsonObject(text);
  let parsed: Record<string, unknown> = {};
  if (json) {
    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  return applySafety({
    proposedGrade: clampGrade(parsed.proposedGrade),
    confidence: clampConfidence(parsed.confidence),
    rationale:
      typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : "근거를 충분히 확인하지 못했습니다.",
    sources: normalizeSources(parsed.sources),
    categories: normalizeCategories(parsed.categories),
  });
}

export function computeCostKrw(
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  },
  searchCount: number,
  model: string,
): number {
  const p = PRICING[model] ?? PRICING["claude-haiku-4-5"];
  const inputAll =
    usage.inputTokens +
    (usage.cacheReadTokens ?? 0) +
    (usage.cacheCreationTokens ?? 0);
  const usd =
    (inputAll / 1_000_000) * p.input +
    (usage.outputTokens / 1_000_000) * p.output +
    Math.max(0, searchCount) * WEB_SEARCH_USD;
  return Math.round(usd * USD_TO_KRW);
}

// 버튼에 표시할 예상비용(검색 max + 실측 기반 토큰 가정: 웹검색은 입력 토큰이 큼).
export function estimatedCostKrw(model: string = VERIFY_MODEL): number {
  return computeCostKrw(
    { inputTokens: 22_000, outputTokens: 1_200 },
    MAX_SEARCHES,
    model,
  );
}

export function buildUserPrompt(input: ResearchInput): string {
  return [
    "다음 빵집을 검증해 주세요.",
    `이름: ${input.name}`,
    input.region ? `지역: ${input.region}` : null,
    input.roadAddress ? `도로명주소: ${input.roadAddress}` : null,
    input.category ? `카카오 카테고리: ${input.category}` : null,
    input.placeUrl ? `카카오 원문: ${input.placeUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const SYSTEM_PROMPT = `당신은 한국 빵집 정보의 신뢰도 검증 담당입니다. 주어진 빵집이 "실재하고 사람들이 언급하는 빵집"인지 한국어 웹(네이버 블로그, 뉴스, 맛집/푸드 매체)에서 검색해 교차확인하고 신뢰등급을 제안합니다.

규칙:
- 같은 이름의 다른 지점·동명 업체와 혼동하지 마세요. 반드시 같은 "구/동·도로명주소"의 그 가게인지 확인하세요.
- 추측 금지. 근거(출처)를 못 찾으면 등급을 제안하지 말고 proposedGrade를 null 로 두세요.
- 등급 기준:
  - "A": 공식 출처(공식 홈페이지/공식 SNS) 또는 공신력 있는 매체·방송에서 확인.
  - "B": 서로 독립적인 출처 2곳 이상(블로그·뉴스 등)에서 교차확인.
  - "C": 약한 단서 1곳만 확인.
  - null: 근거 없음/불확실/동일 가게 확신 불가.
- 웹검색은 최대 ${MAX_SEARCHES}회만 사용하세요.

추가로, **같은 검색 결과만으로(추가 검색 금지)** 이 빵집의 "대표 메뉴/유명한 빵"에 해당하는 빵 카테고리를 제안하세요.
- 카테고리 slug: salt-bread(소금빵), bagel(베이글), baked-sweets(구움과자), meal-bread(식사빵), cake(케이크), croissant(크루아상).
- 블로그·맛집DB 후기/대표메뉴에 **실제 근거가 있는 카테고리만** 넣으세요. 가게 이름만 보고 추측하지 마세요. 근거 없으면 빈 배열([]).
- 각 카테고리에는 한국어 근거(evidence) 1문장(어느 출처에서 무엇으로 언급됐는지)을 넣으세요.

반드시 마지막에 아래 JSON만 코드블록으로 출력하세요(설명은 그 앞에):
\`\`\`json
{"proposedGrade":"A|B|C|null","confidence":"high|medium|low","rationale":"한국어 2~3문장 근거","sources":[{"title":"제목","url":"https://...","summary":"한줄 요약","kind":"official|news|blog|other"}],"categories":[{"slug":"salt-bread","evidence":"○○블로그에서 소금빵 맛집으로 언급"}]}
\`\`\``;

export type AnthropicBlock = {
  type: string;
  text?: string;
  content?: { type: string; url?: string; title?: string }[];
};

// Anthropic 응답에서 텍스트·실제 검색결과·사용량을 추출(순수).
export function collectFromResponse(data: {
  content?: AnthropicBlock[];
  usage?: Record<string, unknown>;
  stop_reason?: string;
}): {
  text: string;
  realSources: VerificationSource[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  searchCount: number;
} {
  let text = "";
  const realSources: VerificationSource[] = [];
  const seen = new Set<string>();
  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) text += block.text + "\n";
    if (
      block.type === "web_search_tool_result" &&
      Array.isArray(block.content)
    ) {
      for (const r of block.content) {
        if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
          seen.add(r.url);
          realSources.push({ title: r.title ?? r.url, url: r.url, kind: "other" });
        }
      }
    }
  }
  const usage = data.usage ?? {};
  const serverToolUse = (usage.server_tool_use ?? {}) as Record<string, unknown>;
  return {
    text,
    realSources,
    usage: {
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      cacheReadTokens: Number(usage.cache_read_input_tokens ?? 0),
      cacheCreationTokens: Number(usage.cache_creation_input_tokens ?? 0),
    },
    searchCount: Number(serverToolUse.web_search_requests ?? 0),
  };
}
