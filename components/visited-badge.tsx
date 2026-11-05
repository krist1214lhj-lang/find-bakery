"use client";

import { useVisitLog } from "@/components/visit-log-provider";

// 목록 카드용 "다녀옴 ★4" 표시. 가장 최근 방문에 준 별점을 보여준다.
export function VisitedBadge({ bakeryId }: { bakeryId: string }) {
  const { ready, latestFor } = useVisitLog();
  const latest = ready ? latestFor(bakeryId) : undefined;
  if (!latest) {
    return null;
  }

  return (
    <p className="visited-badge">
      다녀옴 <span aria-hidden="true">★{latest.rating}</span>
      <span className="sr-only">최근 별점 {latest.rating}점</span>
    </p>
  );
}
