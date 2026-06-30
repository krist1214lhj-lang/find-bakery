// "꼭 먹어볼 빵"(SIGNATURE) 카드용: 정밀검증 normalized_value.categories에서
// 대표 빵 카테고리 + 근거(evidence)를 안전하게 추출한다. 서버 의존성 없는 순수 함수.
// (jeju-pilot 저장 시 normalizeCategories와 동일한 유효성 규칙)

const VALID_SLUGS = new Set([
  "salt-bread",
  "bagel",
  "baked-sweets",
  "meal-bread",
  "cake",
  "croissant",
]);

export type SignatureCategory = { slug: string; evidence: string };

export function extractSignatureCategories(
  normalizedValue: unknown,
): SignatureCategory[] {
  if (!normalizedValue || typeof normalizedValue !== "object") return [];
  const categories = (normalizedValue as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) return [];

  const out: SignatureCategory[] = [];
  const seen = new Set<string>();
  for (const raw of categories) {
    if (!raw || typeof raw !== "object") continue;
    const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
    const evidence = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
    if (!VALID_SLUGS.has(slug) || !evidence || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, evidence });
  }
  return out;
}
