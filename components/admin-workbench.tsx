"use client";

import { useMemo, useState } from "react";
import { KakaoMap } from "@/components/kakao-map";
import type { ExploreMapItem } from "@/lib/explore-map";
import type { WorkbenchData, WorkbenchDecision, WorkbenchItem } from "@/lib/workbench";
import styles from "./admin-workbench.module.css";

type Props = WorkbenchData & { mapApiKey?: string };

const DECISION_META: Record<
  WorkbenchDecision,
  { icon: string; label: string; tone: string }
> = {
  승인후보: { icon: "✅", label: "승인후보", tone: "approve" },
  보류: { icon: "🟡", label: "보류 (사람확인)", tone: "hold" },
  제외: { icon: "❌", label: "제외", tone: "reject" },
};

const ORDER: WorkbenchDecision[] = ["승인후보", "보류", "제외"];

export function AdminWorkbench({ items, generatedAt, model, error, mapApiKey }: Props) {
  const [selectedId, setSelectedId] = useState<string>();

  // 좌표가 있는 항목만 지도에 핀으로(기존 KakaoMap 재사용 — ExploreMapItem 형태로 변환)
  const mapItems = useMemo<ExploreMapItem[]>(
    () =>
      items
        .filter((it) => it.latitude != null && it.longitude != null)
        .map((it) => ({
          id: it.id,
          kind: "candidate",
          name: it.name,
          latitude: it.latitude as number,
          longitude: it.longitude as number,
          address: it.roadAddress ?? it.address ?? "",
          candidate: {
            provider: "kakao",
            externalId: it.id,
            name: it.name,
            category: it.category,
            address: it.address ?? "",
            roadAddress: it.roadAddress ?? undefined,
            phone: it.phone ?? undefined,
            latitude: it.latitude as number,
            longitude: it.longitude as number,
            placeUrl: it.placeUrl ?? "",
            retrievedAt: generatedAt ?? new Date().toISOString(),
          },
        })),
    [items, generatedAt],
  );

  const counts = useMemo(() => {
    const c: Record<WorkbenchDecision, number> = { 승인후보: 0, 보류: 0, 제외: 0 };
    for (const it of items) c[it.decision] += 1;
    return c;
  }, [items]);

  if (error) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <span className="eyebrow">BAKERY WORKBENCH · 로컬 전용</span>
          <h1>빵집 작업대</h1>
        </div>
        <div className={styles.empty}>
          <p>{error}</p>
          <pre>
{`# 예시
node scripts/verify-stage1-kakao.mjs
node scripts/verify-stage2-claude.mjs`}
          </pre>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <span className="eyebrow">BAKERY WORKBENCH · 로컬 전용</span>
        <h1>빵집 작업대</h1>
        <p>
          2차 검증 결과(<code>output/stage2-verified.json</code>)를 상태별로 보는 화면입니다.
          이번 단계는 <strong>보기 전용</strong> — 승인·저장 버튼은 다음 단계입니다.
          {model ? ` · 모델 ${model}` : ""}
          {generatedAt ? ` · 생성 ${new Date(generatedAt).toLocaleString("ko-KR")}` : ""}
        </p>
        <p className={styles.localBadge}>
          🔒 이 페이지는 로컬(dev)에서만 열립니다. 배포(Vercel)에서는 404로 차단됩니다.
        </p>
      </div>

      <div className={styles.summary}>
        {ORDER.map((d) => (
          <span key={d} className={styles[`pill_${DECISION_META[d].tone}`]}>
            {DECISION_META[d].icon} {DECISION_META[d].label} {counts[d]}
          </span>
        ))}
        <span className={styles.pillMuted}>전체 {items.length}</span>
      </div>

      <div className={styles.split}>
        <div className={styles.lists} aria-label="빵집 상태별 목록">
          {ORDER.map((decision) => {
            const group = items.filter((it) => it.decision === decision);
            return (
              <div key={decision} className={styles.group}>
                <h2 className={styles.groupTitle}>
                  {DECISION_META[decision].icon} {DECISION_META[decision].label}
                  <span>{group.length}</span>
                </h2>
                {group.length === 0 ? (
                  <p className={styles.groupEmpty}>해당 없음</p>
                ) : (
                  <div className={styles.cards}>
                    {group.map((it) => (
                      <WorkbenchCard
                        key={it.id}
                        item={it}
                        tone={DECISION_META[decision].tone}
                        selected={it.id === selectedId}
                        onSelect={() => setSelectedId(it.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.mapPanel}>
          <KakaoMap
            apiKey={mapApiKey}
            items={mapItems}
            onBoundsChange={() => {}}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
          <p className={styles.mapHint}>
            카드를 클릭하면 지도에서 해당 핀이 강조됩니다. (핀 {mapItems.length}개)
          </p>
        </div>
      </div>
    </section>
  );
}

function WorkbenchCard({
  item,
  tone,
  selected,
  onSelect,
}: {
  item: WorkbenchItem;
  tone: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`${styles.card} ${styles[`card_${tone}`]} ${selected ? styles.cardSelected : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.cardHead}>
        <h3>{item.name}</h3>
        {item.isFranchise ? (
          <span className={styles.franchise}>프랜차이즈{item.franchiseBrand ? `:${item.franchiseBrand}` : ""}</span>
        ) : null}
      </div>
      <p className={styles.addr}>{item.roadAddress ?? item.address ?? "(주소 없음)"}</p>
      <p className={styles.category}>{item.category || "카테고리 정보 없음"}</p>
      <div className={styles.metaRow}>
        <span className={styles.gradeBadge} title="자동수집 빵집은 아직 검증 전입니다.">
          검증등급: 미검증 · D
        </span>
        <span className={styles.source}>
          출처: 카카오 로컬
          {item.placeUrl ? (
            <>
              {" "}
              <a
                href={item.placeUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                원문 ↗
              </a>
            </>
          ) : null}
        </span>
      </div>
      {item.reason ? (
        <p className={styles.reason}>
          2차 사유: {item.reason}
          {item.decidedBy ? ` (${item.decidedBy})` : ""}
        </p>
      ) : null}
    </article>
  );
}
