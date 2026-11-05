"use client";

import { useRef, useState } from "react";
import { SavedBakeryList } from "@/components/saved-bakery-list";
import { VisitedBakeryList } from "@/components/visited-bakery-list";
import type { Bakery } from "@/lib/types";

export type SavedTab = "saved" | "visited";

const TABS: Array<{ id: SavedTab; label: string; title: string }> = [
  { id: "saved", label: "저장한 곳", title: "저장한 빵집" },
  { id: "visited", label: "다녀온 곳", title: "다녀온 빵집" },
];

export function SavedTabs({
  bakeries,
  initialTab,
}: {
  bakeries: Bakery[];
  initialTab: SavedTab;
}) {
  const [tab, setTab] = useState<SavedTab>(initialTab);
  const tabRefs = useRef<Record<SavedTab, HTMLButtonElement | null>>({
    saved: null,
    visited: null,
  });
  const current = TABS.find((item) => item.id === tab) ?? TABS[0];

  function select(next: SavedTab) {
    setTab(next);
    // 새로고침·공유해도 같은 탭이 열리도록 주소에 남긴다(페이지 이동 없이).
    const url = new URL(window.location.href);
    if (next === "visited") {
      url.searchParams.set("tab", "visited");
    } else {
      url.searchParams.delete("tab");
    }
    window.history.replaceState(window.history.state, "", url);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    select(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <h1>{current.title}</h1>
      <div
        aria-label="저장한 곳과 다녀온 곳"
        className="saved-tabs"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {TABS.map((item) => (
          <button
            aria-controls={`saved-panel-${item.id}`}
            aria-selected={tab === item.id}
            id={`saved-tab-${item.id}`}
            key={item.id}
            onClick={() => select(item.id)}
            ref={(element) => {
              tabRefs.current[item.id] = element;
            }}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`saved-tab-${tab}`}
        id={`saved-panel-${tab}`}
        role="tabpanel"
      >
        {tab === "visited" ? (
          <VisitedBakeryList bakeries={bakeries} />
        ) : (
          <SavedBakeryList bakeries={bakeries} />
        )}
      </div>
    </>
  );
}
