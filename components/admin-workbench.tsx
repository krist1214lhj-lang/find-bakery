"use client";

import { useMemo, useState } from "react";
import { KakaoMap } from "@/components/kakao-map";
import type { ExploreMapItem } from "@/lib/explore-map";
import type { WorkbenchData, WorkbenchDecision, WorkbenchItem } from "@/lib/workbench";
import {
  VERIFY_MODEL,
  estimatedCostKrw,
  type ResearchResult,
} from "@/lib/verification-research-core";
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

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "salt-bread", label: "소금빵" },
  { slug: "bagel", label: "베이글" },
  { slug: "baked-sweets", label: "구움과자" },
  { slug: "meal-bread", label: "식사빵" },
  { slug: "cake", label: "케이크" },
  { slug: "croissant", label: "크루아상" },
];

const CAT_KEYWORDS: { slug: string; kws: string[] }[] = [
  { slug: "bagel", kws: ["베이글"] },
  { slug: "croissant", kws: ["크루아상", "크로와상", "크라상"] },
  { slug: "salt-bread", kws: ["소금빵"] },
  { slug: "cake", kws: ["케이크", "케익"] },
  { slug: "baked-sweets", kws: ["쿠키", "구움과자", "휘낭시에", "마들렌", "스콘"] },
  { slug: "meal-bread", kws: ["식사빵", "바게트", "치아바타", "캄파뉴"] },
];

const GRADES = ["D", "C", "B", "A"] as const;

function suggestCategories(name: string): string[] {
  const n = name.replace(/\s+/g, "").toLowerCase();
  const found: string[] = [];
  for (const c of CAT_KEYWORDS) {
    if (c.kws.some((k) => n.includes(k.replace(/\s+/g, "").toLowerCase()))) found.push(c.slug);
  }
  return found;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new Error((payload?.message as string) ?? `요청 실패 (HTTP ${res.status})`);
  }
  return payload ?? {};
}

export function AdminWorkbench({ items, generatedAt, model, error, dbConnected, mapApiKey }: Props) {
  const [selectedId, setSelectedId] = useState<string>();

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
          2차 검증 결과(<code>output/stage2-verified.json</code>)를 보고 승인·카테고리·등급을 처리합니다.
          {model ? ` · 모델 ${model}` : ""}
          {generatedAt ? ` · 생성 ${new Date(generatedAt).toLocaleString("ko-KR")}` : ""}
        </p>
        <p className={styles.localBadge}>
          🔒 로컬(dev)에서만 열립니다. 배포(Vercel)에서는 미들웨어+가드로 404 차단됩니다.
          {dbConnected ? "" : " ⚠️ DB 미연결 — 저장 상태를 못 읽었습니다(.env.local 확인)."}
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
            카드의 “📍지도” 버튼을 누르면 해당 핀이 강조됩니다. (핀 {mapItems.length}개)
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
  const [saved, setSaved] = useState(item.saved);
  const [locationId, setLocationId] = useState<string | null>(item.savedLocationId);
  const [savedSlug, setSavedSlug] = useState<string | null>(item.savedSlug);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    new Set(item.existingCategorySlugs),
  );
  const [grade, setGrade] = useState<string | null>(item.currentGrade);
  const [busy, setBusy] = useState<
    "" | "approve" | "categories" | "grade" | "verify" | "apply"
  >("");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const suggested = useMemo(() => suggestCategories(item.name), [item.name]);
  const canWrite = saved && locationId;

  async function onApprove() {
    if (busy) return;
    if (!window.confirm(`이 빵집을 DB에 저장할까요?\n\n${item.name}\n${item.roadAddress ?? item.address ?? ""}`)) return;
    setBusy("approve");
    setMessage(null);
    try {
      const result = (await postJson("/api/admin/workbench/approve", {
        item: {
          name: item.name,
          category: item.category,
          roadAddress: item.roadAddress,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          phone: item.phone,
          placeUrl: item.placeUrl,
          isFranchise: item.isFranchise,
          franchiseBrand: item.franchiseBrand,
        },
      })) as { locationId: string; slug: string; alreadyExisted: boolean };
      setSaved(true);
      setLocationId(result.locationId);
      setSavedSlug(result.slug);
      setMessage({
        kind: "ok",
        text: result.alreadyExisted ? "이미 저장돼 있던 빵집입니다." : "저장했습니다(active).",
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setBusy("");
    }
  }

  function toggleCat(slug: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function applySuggestion() {
    if (suggested.length === 0) return;
    setSelectedCats((prev) => new Set([...prev, ...suggested]));
  }

  async function onSaveCategories() {
    if (busy || !locationId) return;
    const list = [...selectedCats];
    if (!window.confirm(`카테고리를 저장할까요?\n\n${item.name}\n선택: ${list.length ? list.join(", ") : "(없음 — 전체 해제)"}`)) return;
    setBusy("categories");
    setMessage(null);
    try {
      const result = (await postJson("/api/admin/workbench/categories", {
        locationId,
        categorySlugs: list,
      })) as { categorySlugs: string[] };
      setSelectedCats(new Set(result.categorySlugs));
      setMessage({ kind: "ok", text: `카테고리 저장됨: ${result.categorySlugs.length ? result.categorySlugs.join(", ") : "(없음)"}` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "카테고리 저장 실패" });
    } finally {
      setBusy("");
    }
  }

  async function onGrade(g: string) {
    if (busy || !locationId) return;
    if (!window.confirm(`검증등급을 '${g}'(으)로 지정할까요?\n\n${item.name}\n(verification_records에 오늘 날짜로 기록됩니다)`)) return;
    setBusy("grade");
    setMessage(null);
    try {
      const result = (await postJson("/api/admin/workbench/grade", {
        locationId,
        grade: g,
      })) as { grade: string; checkedAt: string };
      setGrade(result.grade);
      setMessage({ kind: "ok", text: `등급 '${result.grade}' 기록됨 (${new Date(result.checkedAt).toLocaleDateString("ko-KR")})` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "등급 부여 실패" });
    } finally {
      setBusy("");
    }
  }

  async function onVerify() {
    if (busy) return;
    setBusy("verify");
    setMessage(null);
    try {
      const result = (await postJson("/api/admin/workbench/verify", {
        name: item.name,
        region: null,
        roadAddress: item.roadAddress,
        category: item.category,
        placeUrl: item.placeUrl,
      })) as ResearchResult;
      setResearch(result);
      // 추천 카테고리는 기존 선택을 지우지 않고 "미리 체크"만 한다(사용자가 수정·저장).
      if (result.categories.length > 0) {
        setSelectedCats(
          (prev) => new Set([...prev, ...result.categories.map((c) => c.slug)]),
        );
      }
      const catNote = result.categories.length
        ? ` · 추천 카테고리 ${result.categories.length}개(체크박스 반영)`
        : "";
      setMessage({
        kind: "ok",
        text: `정밀 검증 완료 · 실비 약 ${result.costKrw}원 (웹검색 ${result.searchCount}회)${catNote}`,
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "정밀 검증 실패" });
    } finally {
      setBusy("");
    }
  }

  async function onApplyResearch() {
    if (busy || !locationId || !research?.proposedGrade) return;
    const g = research.proposedGrade;
    if (
      !window.confirm(
        `정밀 검증 제안 등급 '${g}'를 적용할까요?\n\n${item.name}\n(출처·근거와 함께 verification_records에 기록됩니다)`,
      )
    )
      return;
    setBusy("apply");
    setMessage(null);
    try {
      const result = (await postJson("/api/admin/workbench/grade", {
        locationId,
        grade: g,
        evidence: {
          rationale: research.rationale,
          confidence: research.confidence,
          sources: research.sources,
        },
      })) as { grade: string; checkedAt: string };
      setGrade(result.grade);
      setMessage({
        kind: "ok",
        text: `등급 '${result.grade}' 적용됨(증거 기록) (${new Date(result.checkedAt).toLocaleDateString("ko-KR")})`,
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "등급 적용 실패" });
    } finally {
      setBusy("");
    }
  }

  return (
    <article
      className={`${styles.card} ${styles[`card_${tone}`]} ${selected ? styles.cardSelected : ""}`}
    >
      <div className={styles.cardHead}>
        <h3>{item.name}</h3>
        <div className={styles.headRight}>
          {item.isFranchise ? (
            <span className={styles.franchise}>
              프랜차이즈{item.franchiseBrand ? `:${item.franchiseBrand}` : ""}
            </span>
          ) : null}
          <button type="button" className={styles.mapBtn} onClick={onSelect}>
            📍지도
          </button>
        </div>
      </div>
      <p className={styles.addr}>{item.roadAddress ?? item.address ?? "(주소 없음)"}</p>
      <p className={styles.category}>{item.category || "카테고리 정보 없음"}</p>
      <div className={styles.metaRow}>
        <span className={styles.source}>
          출처: 카카오 로컬
          {item.placeUrl ? (
            <>
              {" "}
              <a href={item.placeUrl} target="_blank" rel="noreferrer">원문 ↗</a>
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

      {/* ── [기능2] 승인 ─────────────────────────── */}
      <div className={styles.controlRow}>
        {saved ? (
          <span className={styles.savedBadge}>✅ 저장됨{savedSlug ? ` (${savedSlug})` : ""}</span>
        ) : (
          <button
            type="button"
            className={styles.approveBtn}
            disabled={busy === "approve"}
            onClick={onApprove}
          >
            {busy === "approve" ? "저장 중…" : "승인 → 저장"}
          </button>
        )}
      </div>

      {/* ── [기능1] 카테고리 ─────────────────────── */}
      <div className={styles.controlBlock}>
        <div className={styles.controlLabel}>
          빵 카테고리
          {suggested.length > 0 ? (
            <span className={styles.suggest}>
              추정: {suggested.map((s) => CATEGORIES.find((c) => c.slug === s)?.label ?? s).join(", ")}
              <button type="button" className={styles.linkBtn} disabled={!canWrite} onClick={applySuggestion}>
                추정 적용
              </button>
            </span>
          ) : (
            <span className={styles.suggestMuted}>추정: 없음</span>
          )}
        </div>
        <div className={styles.catRow}>
          {CATEGORIES.map((c) => (
            <label key={c.slug} className={`${styles.catChk} ${!canWrite ? styles.catDisabled : ""}`}>
              <input
                type="checkbox"
                checked={selectedCats.has(c.slug)}
                disabled={!canWrite || busy !== ""}
                onChange={() => toggleCat(c.slug)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={!canWrite || busy === "categories"}
          onClick={onSaveCategories}
        >
          {busy === "categories" ? "저장 중…" : "카테고리 저장"}
        </button>
        {!canWrite ? <span className={styles.disabledNote}>승인(저장) 후 지정 가능</span> : null}
      </div>

      {/* ── [기능4] 정밀 검증 (웹검색) ───────────── */}
      <div className={styles.controlBlock}>
        <div className={styles.controlLabel}>
          정밀 검증 (웹검색)
          <span className={styles.suggestMuted}>
            {VERIFY_MODEL} · 약 {estimatedCostKrw()}원/회
          </span>
        </div>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={busy !== ""}
          onClick={onVerify}
        >
          {busy === "verify" ? "검증 중… (수 초)" : "정밀 검증 실행"}
        </button>
        {research ? (
          <div className={styles.researchBox}>
            <div className={styles.researchHead}>
              제안 등급:{" "}
              <strong className={styles.proposed}>
                {research.proposedGrade ?? "제안 없음 (D 유지)"}
              </strong>
              <span className={styles.confidence}>확신도 {research.confidence}</span>
              <span className={styles.costTag}>실비 약 {research.costKrw}원</span>
            </div>
            <p className={styles.rationale}>{research.rationale}</p>
            {research.sources.length > 0 ? (
              <ul className={styles.srcList}>
                {research.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      [{s.kind}] {s.title}
                    </a>
                    {s.summary ? (
                      <span className={styles.srcSummary}> — {s.summary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.suggestMuted}>찾은 출처 없음</p>
            )}
            {research.categories.length > 0 ? (
              <div className={styles.catSuggest}>
                <div className={styles.catSuggestHead}>
                  추천 카테고리:{" "}
                  <strong>
                    {research.categories
                      .map(
                        (c) =>
                          CATEGORIES.find((x) => x.slug === c.slug)?.label ?? c.slug,
                      )
                      .join(" · ")}
                  </strong>
                  <span className={styles.suggestMuted}>
                    {" "}
                    (아래 체크박스에 미리 반영됨 — 수정 후 “카테고리 저장”)
                  </span>
                </div>
                <ul className={styles.catEvList}>
                  {research.categories.map((c) => (
                    <li key={c.slug}>
                      {CATEGORIES.find((x) => x.slug === c.slug)?.label ?? c.slug} —
                      근거: {c.evidence}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.suggestMuted}>추천 카테고리: 미정 (웹 근거 없음)</p>
            )}
            {research.proposedGrade ? (
              canWrite ? (
                <button
                  type="button"
                  className={styles.approveBtn}
                  disabled={busy !== ""}
                  onClick={onApplyResearch}
                >
                  {busy === "apply"
                    ? "적용 중…"
                    : `이 등급(${research.proposedGrade}) 적용`}
                </button>
              ) : (
                <span className={styles.disabledNote}>승인(저장) 후 적용 가능</span>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── [기능3] 등급 ─────────────────────────── */}
      <div className={styles.controlBlock}>
        <div className={styles.controlLabel}>
          검증등급
          <span className={styles.curGrade}>현재: {grade ? grade : "미검증·D"}</span>
        </div>
        <div className={styles.gradeRow}>
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className={`${styles.gradeBtn} ${grade === g ? styles.gradeBtnActive : ""}`}
              disabled={!canWrite || busy === "grade"}
              onClick={() => onGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
        {!canWrite ? <span className={styles.disabledNote}>승인(저장) 후 지정 가능</span> : null}
      </div>

      {message ? (
        <p className={message.kind === "ok" ? styles.msgOk : styles.msgErr}>{message.text}</p>
      ) : null}
    </article>
  );
}
