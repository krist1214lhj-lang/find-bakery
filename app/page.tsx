import Link from "next/link";
import { BakeryCard } from "@/components/bakery-card";
import {
  getBreadCategories,
  getRecentlyVerifiedBakeries,
} from "@/lib/bakery-repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [breadCategories, recentBakeries] = await Promise.all([
    getBreadCategories(),
    getRecentlyVerifiedBakeries(3),
  ]);

  return (
    <div className="home-snap">
      <section className="hero-section home-panel" aria-label="빵길 시작">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span aria-hidden="true">✦</span>
            전국 빵집의 최신 정보를 한곳에
          </div>
          <h1>
            빵 냄새를 따라,
            <br />
            <em>확실한 길</em>로.
          </h1>
          <p>
            유명하다는 말만 믿고 떠나지 않도록. 영업시간과 메뉴를 언제, 어디서
            확인했는지 함께 알려드려요.
          </p>

          <form className="hero-search" action="/explore">
            <label className="sr-only" htmlFor="home-search">
              지역, 빵집 또는 빵 이름 검색
            </label>
            <span className="hero-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              id="home-search"
              name="q"
              placeholder="성수 소금빵, 부산 베이글…"
            />
            <button type="submit">빵길 찾기</button>
          </form>

          <div className="hero-trust-list" aria-label="서비스 특징">
            <span>
              <strong>출처</strong>를 남겨요
            </span>
            <span>
              <strong>확인일</strong>을 보여줘요
            </span>
            <span>
              <strong>변경 정보</strong>를 제보해요
            </span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-route-line" aria-hidden="true" />
          <div className="hero-video-frame">
            <video
              aria-hidden="true"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              src="/title.mp4"
            />
            <div className="hero-video-caption">
              <span>오늘의 빵길</span>
              <strong>갓 구운 곳으로 출발</strong>
            </div>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <span>FRESHLY</span>
            <strong>CHECKED</strong>
            <small>2026 · BBANG GIL</small>
          </div>
          <div className="hero-ticket">
            <span className="hero-ticket-label">BAKERY ROUTE No. 01</span>
            <strong>먹고 싶은 빵에서 시작하세요</strong>
            <span>지역보다 취향이 먼저여도 괜찮아요.</span>
          </div>
        </div>

        <div className="hero-scroll-cue" aria-hidden="true">
          <span />
          빵길 둘러보기
        </div>
      </section>

      <section
        className="content-section category-section home-panel"
        aria-labelledby="home-category-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">BREAD FIRST</span>
            <h2 id="home-category-title">오늘 마음이 가는 빵은?</h2>
          </div>
          <p>지역을 정하지 않아도 좋아요. 먹고 싶은 것부터 골라보세요.</p>
        </div>
        <div className="category-grid">
          {breadCategories.map((category, index) => (
            <Link
              className="category-chip"
              href={`/explore?category=${encodeURIComponent(category.slug)}`}
              key={category.slug}
            >
              <small>0{index + 1}</small>
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section
        className="content-section home-panel home-featured-panel"
        aria-labelledby="home-featured-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">FRESHLY CHECKED</span>
            <h2 id="home-featured-title">최근 정보가 확인된 빵집</h2>
          </div>
          <Link href="/explore">전체 보기 →</Link>
        </div>
        <div className="bakery-grid">
          {recentBakeries.map((bakery) => (
            <BakeryCard bakery={bakery} key={bakery.id} />
          ))}
        </div>
        <p className="home-swipe-hint" aria-hidden="true">
          옆으로 넘겨 더 보기 →
        </p>
      </section>

      <section
        className="content-section region-section home-panel"
        aria-labelledby="home-region-title"
      >
        <div>
          <span className="eyebrow">REGIONAL ROUTES</span>
          <h2 id="home-region-title">
            도시마다 다른
            <br />
            빵의 표정을 만나보세요.
          </h2>
          <p>여행지에서 놓치기 아쉬운 빵집을 지역별로 둘러보세요.</p>
        </div>
        <div className="region-links">
          {["서울", "대전", "부산", "대구", "전주", "제주"].map(
            (region, index) => (
              <Link
                href={`/explore?region=${encodeURIComponent(region)}`}
                key={region}
              >
                <small>0{index + 1}</small>
                <strong>{region}</strong>
                <span aria-hidden="true">↗</span>
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
