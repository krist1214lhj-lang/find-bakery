import { describe, expect, it } from "vitest";
import {
  clampGrade,
  collectFromResponse,
  computeCostKrw,
  estimatedCostKrw,
  normalizeCategories,
  normalizeSources,
  parseVerdict,
} from "@/lib/verification-research-core";

describe("verification research — verdict parsing", () => {
  it("extracts grade and sources from a fenced JSON block", () => {
    const text = `검색 결과 정리합니다.
\`\`\`json
{"proposedGrade":"B","confidence":"high","rationale":"블로그 2곳에서 같은 가게로 확인.","sources":[{"title":"네이버 블로그 후기","url":"https://blog.naver.com/x/1","kind":"blog"},{"title":"뉴스","url":"https://news.example.com/2","kind":"news"}]}
\`\`\``;
    const v = parseVerdict(text);
    expect(v.proposedGrade).toBe("B");
    expect(v.confidence).toBe("high");
    expect(v.sources).toHaveLength(2);
    expect(v.sources[0].url).toBe("https://blog.naver.com/x/1");
  });

  it("withholds the grade when the model gives no sources (안전 규칙)", () => {
    const text = `\`\`\`json
{"proposedGrade":"A","confidence":"high","rationale":"유명함","sources":[]}
\`\`\``;
    const v = parseVerdict(text);
    expect(v.proposedGrade).toBeNull();
    expect(v.confidence).toBe("low");
  });

  it("returns null grade when there is no JSON at all", () => {
    const v = parseVerdict("검색했지만 확실한 출처를 못 찾았습니다.");
    expect(v.proposedGrade).toBeNull();
    expect(v.sources).toEqual([]);
  });

  it("parses the LAST json block and falls back to a bare object", () => {
    const v = parseVerdict(
      'noise {"proposedGrade":"C","rationale":"단서 1곳","sources":[{"title":"t","url":"https://a.com/1"}]}',
    );
    expect(v.proposedGrade).toBe("C");
    expect(v.sources[0].kind).toBe("other");
  });
});

describe("verification research — source normalization", () => {
  it("drops non-http urls, dedupes, and caps at 5", () => {
    const src = normalizeSources([
      { title: "a", url: "https://a.com/1" },
      { title: "dup", url: "https://a.com/1" },
      { title: "bad", url: "ftp://x" },
      { title: "no-url" },
      { title: "b", url: "http://b.com/2", kind: "news" },
      { title: "c", url: "https://c.com/3" },
      { title: "d", url: "https://d.com/4" },
      { title: "e", url: "https://e.com/5" },
      { title: "f", url: "https://f.com/6" },
    ]);
    expect(src).toHaveLength(5);
    expect(src.map((s) => s.url)).toEqual([
      "https://a.com/1",
      "http://b.com/2",
      "https://c.com/3",
      "https://d.com/4",
      "https://e.com/5",
    ]);
    expect(src[1].kind).toBe("news");
  });
});

describe("verification research — grade clamp & cost", () => {
  it("clamps invalid grades to null", () => {
    expect(clampGrade("A")).toBe("A");
    expect(clampGrade("D")).toBeNull();
    expect(clampGrade("S")).toBeNull();
    expect(clampGrade(null)).toBeNull();
  });

  it("computes Haiku cost in KRW (tokens + web search)", () => {
    // 12000 in, 700 out, 2 searches, haiku($1/$5) → ~51원
    const krw = computeCostKrw(
      { inputTokens: 12_000, outputTokens: 700 },
      2,
      "claude-haiku-4-5",
    );
    expect(krw).toBe(51);
    // 버튼 추정치: 실측(웹검색 입력 토큰 큼) 반영 ~70원
    expect(estimatedCostKrw("claude-haiku-4-5")).toBe(70);
  });

  it("Sonnet costs more than Haiku for the same usage", () => {
    const usage = { inputTokens: 12_000, outputTokens: 700 };
    const haiku = computeCostKrw(usage, 2, "claude-haiku-4-5");
    const sonnet = computeCostKrw(usage, 2, "claude-sonnet-4-6");
    expect(sonnet).toBeGreaterThan(haiku);
  });
});

describe("verification research — category suggestions", () => {
  it("keeps valid slugs with evidence, drops invalid/no-evidence, dedupes", () => {
    const cats = normalizeCategories([
      { slug: "salt-bread", evidence: "소금빵 맛집으로 언급" },
      { slug: "salt-bread", evidence: "중복(무시)" },
      { slug: "cake", evidence: "딸기케이크 전문" },
      { slug: "pizza", evidence: "유효하지 않은 slug" },
      { slug: "bagel" }, // 근거 없음
      { slug: "croissant", evidence: "" }, // 빈 근거
    ]);
    expect(cats.map((c) => c.slug)).toEqual(["salt-bread", "cake"]);
    expect(cats[0].evidence).toBe("소금빵 맛집으로 언급");
  });

  it("parseVerdict includes evidenced categories", () => {
    const v = parseVerdict(
      '```json\n{"proposedGrade":"C","sources":[{"title":"t","url":"https://a.com/1"}],"categories":[{"slug":"cake","evidence":"케이크 전문점"}]}\n```',
    );
    expect(v.categories).toEqual([{ slug: "cake", evidence: "케이크 전문점" }]);
  });

  it("clears categories when there are no sources (추측 금지)", () => {
    const v = parseVerdict(
      '```json\n{"proposedGrade":"B","sources":[],"categories":[{"slug":"cake","evidence":"x"}]}\n```',
    );
    expect(v.proposedGrade).toBeNull();
    expect(v.categories).toEqual([]);
  });
});

describe("verification research — response collection", () => {
  it("pulls text, real search sources, usage, and search count", () => {
    const collected = collectFromResponse({
      content: [
        { type: "text", text: "검색합니다." },
        {
          type: "web_search_tool_result",
          content: [
            { type: "web_search_result", url: "https://blog.naver.com/x", title: "후기" },
            { type: "web_search_result", url: "https://blog.naver.com/x", title: "dup" },
          ],
        },
        { type: "text", text: '```json\n{"proposedGrade":"C"}\n```' },
      ],
      usage: {
        input_tokens: 5000,
        output_tokens: 300,
        server_tool_use: { web_search_requests: 2 },
      },
    });
    expect(collected.realSources).toHaveLength(1);
    expect(collected.searchCount).toBe(2);
    expect(collected.usage.inputTokens).toBe(5000);
    expect(collected.text).toContain("proposedGrade");
  });
});
