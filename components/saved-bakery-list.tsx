"use client";

import Link from "next/link";
import { BakeryCard } from "@/components/bakery-card";
import { useSavedBakeries } from "@/components/saved-bakeries-provider";
import type { Bakery } from "@/lib/types";

export function SavedBakeryList({ bakeries }: { bakeries: Bakery[] }) {
  const { savedIds, ready } = useSavedBakeries();
  const savedBakeries = bakeries.filter((bakery) =>
    savedIds.includes(bakery.id),
  );

  if (!ready) {
    return (
      <div className="empty-state compact-state" aria-live="polite">
        <span aria-hidden="true">…</span>
        <h2>저장한 빵집을 불러오고 있어요.</h2>
      </div>
    );
  }

  if (savedBakeries.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">♡</span>
        <h2>아직 저장한 빵집이 없어요.</h2>
        <p>가보고 싶은 곳을 모아 나만의 빵길을 만들어 보세요.</p>
        <Link className="primary-link" href="/explore">
          빵집 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="saved-summary">{savedBakeries.length}곳을 저장했어요.</p>
      <div className="bakery-grid">
        {savedBakeries.map((bakery) => (
          <BakeryCard bakery={bakery} key={bakery.id} />
        ))}
      </div>
    </>
  );
}
