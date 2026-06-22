import type { Metadata } from "next";
import Link from "next/link";
import { BakeryCard } from "@/components/bakery-card";
import { NearbyBakerySearch } from "@/components/nearby-bakery-search";
import { getBreadCategories, searchBakeries } from "@/lib/bakery-repository";

export const metadata: Metadata = {
  title: "빵집 탐색",
};

type ExplorePageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    region?: string;
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
          <button type="submit">검색</button>
        </form>
      </div>

      <div className="filter-row" aria-label="검색 필터">
        <Link href="/explore?region=서울">서울</Link>
        <Link href="/explore?region=대전">대전</Link>
        <Link href="/explore?category=salt-bread">소금빵</Link>
        <Link href="/explore?category=bagel">베이글</Link>
      </div>

      <div className="result-summary">
        <strong>{results.length}곳</strong>
        <span>Supabase 공개 데이터 기준</span>
      </div>

      {results.length > 0 ? (
        <div className="bakery-grid">
          {results.map((bakery) => (
            <BakeryCard bakery={bakery} key={bakery.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">🥐</span>
          <h2>조건에 맞는 빵집이 아직 없어요.</h2>
          <p>검색어를 바꾸거나 전국 목록을 다시 둘러보세요.</p>
          <Link className="primary-link" href="/explore">
            필터 초기화
          </Link>
        </div>
      )}

      <NearbyBakerySearch initialQuery={query.q} />
    </section>
  );
}
