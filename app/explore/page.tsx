import type { Metadata } from "next";
import Link from "next/link";
import { ExploreWorkspace } from "@/components/explore-workspace";
import { getBreadCategories, searchBakeries } from "@/lib/bakery-repository";

export const metadata: Metadata = {
  title: "빵집 탐색",
};

type ExplorePageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    region?: string;
    view?: string;
  }>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const query = await searchParams;
  const [breadCategories, results] = await Promise.all([
    getBreadCategories(),
    searchBakeries(query),
  ]);
  const selectedCategory = breadCategories.find(
    (category) => category.slug === query.category,
  );
  const hasSearchQuery = Boolean(query.q?.trim());
  const title = query.q
    ? `'${query.q}' 검색 결과`
    : query.region
      ? `${query.region}의 빵집`
      : selectedCategory
        ? `${selectedCategory.name} 빵집`
        : "전국 빵집 탐색";

  return (
    <section className="page-section">
      <div className="explore-header">
        <span className="eyebrow">EXPLORE</span>
        <h1>{title}</h1>
        <p>검증 상태와 대표 메뉴를 함께 비교해 보세요.</p>
        <form className="search-box compact" action="/explore">
          <label className="sr-only" htmlFor="explore-search">
            빵집 검색
          </label>
          <input
            defaultValue={query.q}
            id="explore-search"
            name="q"
            placeholder="빵집이나 메뉴를 검색하세요"
          />
          {query.category ? (
            <input name="category" type="hidden" value={query.category} />
          ) : null}
          {query.region ? (
            <input name="region" type="hidden" value={query.region} />
          ) : null}
          {query.view ? (
            <input name="view" type="hidden" value={query.view} />
          ) : null}
          <button type="submit">검색</button>
        </form>
      </div>

      <div className="filter-row" aria-label="검색 필터">
        <Link href={getExploreHref(query, { region: "서울" })}>서울</Link>
        <Link href={getExploreHref(query, { region: "대전" })}>대전</Link>
        <Link href={getExploreHref(query, { category: "salt-bread" })}>
          소금빵
        </Link>
        <Link href={getExploreHref(query, { category: "bagel" })}>
          베이글
        </Link>
        <Link href="/explore">필터 초기화</Link>
      </div>

      {results.length === 0 && !hasSearchQuery ? (
        <div className="empty-state">
          <span aria-hidden="true">🥐</span>
          <h2>조건에 맞는 빵집이 아직 없어요.</h2>
          <p>검색어를 바꾸거나 전국 목록을 다시 둘러보세요.</p>
          <Link className="primary-link" href="/explore">
            필터 초기화
          </Link>
        </div>
      ) : (
        <ExploreWorkspace
          bakeries={results}
          initialQuery={query.q}
          initialView={query.view === "map" ? "map" : "list"}
          mapApiKey={process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY?.trim()}
        />
      )}
    </section>
  );
}

function getExploreHref(
  current: Awaited<ExplorePageProps["searchParams"]>,
  update: { region?: string; category?: string },
) {
  const params = new URLSearchParams();
  if (current.q) params.set("q", current.q);
  if (current.view) params.set("view", current.view);
  if (update.region) params.set("region", update.region);
  else if (current.region) params.set("region", current.region);
  if (update.category) params.set("category", update.category);
  else if (current.category) params.set("category", current.category);
  return `/explore?${params.toString()}`;
}
