"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BakeryCard } from "@/components/bakery-card";
import { KakaoMap } from "@/components/kakao-map";
import {
  buildExploreMapItems,
  filterItemsByBounds,
  getMapSearchRadius,
  type MapBounds,
} from "@/lib/explore-map";
import type { PlaceCandidate, PlaceSearchResult } from "@/lib/place-provider";
import type { Bakery } from "@/lib/types";

type Props = {
  bakeries: Bakery[];
  initialQuery?: string;
  initialView?: "list" | "map";
  mapApiKey?: string;
};

export function ExploreWorkspace({
  bakeries,
  initialQuery = "",
  initialView = "list",
  mapApiKey,
}: Props) {
  const [view, setView] = useState<"list" | "map">(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [mapBounds, setMapBounds] = useState<MapBounds>();
  const [appliedBounds, setAppliedBounds] = useState<MapBounds>();
  const [capturingId, setCapturingId] = useState("");
  const [capturedIds, setCapturedIds] = useState<string[]>([]);
  const autoSearchStarted = useRef(false);

  const allItems = useMemo(
    () => buildExploreMapItems(bakeries, candidates),
    [bakeries, candidates],
  );
  const visibleItems = useMemo(
    () =>
      appliedBounds
        ? filterItemsByBounds(allItems, appliedBounds)
        : allItems,
    [allItems, appliedBounds],
  );
  const selected =
    visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];

  const searchPlaces = useCallback(
    async (
      searchQuery: string,
      coordinates?: {
        latitude: number;
        longitude: number;
        radiusMeters?: number;
      },
    ) => {
      const normalizedQuery = searchQuery.trim();
      if (!normalizedQuery) {
        setMessage("동네나 빵집 이름을 입력해 주세요.");
        return;
      }

      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ q: normalizedQuery });
        if (coordinates) {
          params.set("lat", String(coordinates.latitude));
          params.set("lon", String(coordinates.longitude));
          if (coordinates.radiusMeters) {
            params.set("radius", String(coordinates.radiusMeters));
          }
        }
        const response = await fetch(`/api/places/search?${params}`);
        const payload = (await response.json().catch(() => null)) as
          | (PlaceSearchResult & { message?: string })
          | { message?: string }
          | null;
        if (!response.ok || !payload || !("places" in payload)) {
          throw new Error(payload?.message ?? "카카오 장소를 검색하지 못했어요.");
        }

        setCandidates(payload.places);
        setAppliedBounds(undefined);
        setSelectedId(undefined);
        setMessage(
          payload.places.length > 0
            ? `미검증 카카오 후보 ${payload.places.length}곳을 함께 표시합니다.`
            : "조건에 맞는 카카오 장소를 찾지 못했어요.",
        );
      } catch (cause) {
        setCandidates([]);
        setMessage(
          cause instanceof Error
            ? cause.message
            : "카카오 장소를 검색하지 못했어요.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!initialQuery.trim() || autoSearchStarted.current) {
      return;
    }
    autoSearchStarted.current = true;
    void searchPlaces(initialQuery);
  }, [initialQuery, searchPlaces]);

  function changeView(nextView: "list" | "map") {
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState(null, "", url);
  }

  async function submitCandidateSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await searchPlaces(query);
  }

  function searchNearby() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("이 브라우저에서는 현재 위치를 사용할 수 없어요.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void searchPlaces(query || "빵집", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radiusMeters: 5_000,
        });
      },
      () => {
        setLoading(false);
        setMessage(
          "위치 권한을 사용할 수 없어요. 동네 이름을 직접 입력해 검색해 주세요.",
        );
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  async function searchCurrentMapArea() {
    if (!mapBounds) {
      setMessage("지도가 준비된 뒤 다시 시도해 주세요.");
      return;
    }
    const latitude = (mapBounds.south + mapBounds.north) / 2;
    const longitude = (mapBounds.west + mapBounds.east) / 2;
    await searchPlaces(query || "빵집", {
      latitude,
      longitude,
      radiusMeters: getMapSearchRadius(mapBounds),
    });
    setAppliedBounds(mapBounds);
  }

  async function captureCandidate(place: PlaceCandidate) {
    if (!place.captureToken || capturingId) {
      return;
    }
    setCapturingId(place.externalId);
    setMessage("");
    try {
      const response = await fetch("/api/place-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: place.captureToken }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "검수 요청을 저장하지 못했어요.");
      }
      setCapturedIds((current) => [...new Set([...current, place.externalId])]);
      setMessage(
        `${place.name}을 검수 대기 목록에 저장했어요. 승인 전에는 확정 정보로 공개되지 않아요.`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "검수 요청을 저장하지 못했어요.",
      );
    } finally {
      setCapturingId("");
    }
  }

  return (
    <section className="explore-workspace" data-view={view}>
      <div className="explore-tools">
        <div className="result-summary">
          <strong>현재 결과 {visibleItems.length}곳</strong>
          <span>
            검증된 빵집 {visibleItems.filter((item) => item.kind === "verified").length}
            곳 · 미검증 후보{" "}
            {visibleItems.filter((item) => item.kind === "candidate").length}곳
          </span>
        </div>
        <div className="view-toggle" aria-label="탐색 보기 방식">
          <button
            aria-pressed={view === "list"}
            onClick={() => changeView("list")}
            type="button"
          >
            목록
          </button>
          <button
            aria-pressed={view === "map"}
            onClick={() => changeView("map")}
            type="button"
          >
            지도
          </button>
        </div>
      </div>

      <form className="map-search-form" onSubmit={submitCandidateSearch}>
        <label className="sr-only" htmlFor="map-candidate-query">
          카카오 후보 검색
        </label>
        <input
          id="map-candidate-query"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="동네나 빵집 이름으로 미검증 후보 찾기"
          value={query}
        />
        <button disabled={loading} type="submit">
          {loading ? "검색 중…" : "후보 검색"}
        </button>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={searchNearby}
          type="button"
        >
          ◎ 내 위치
        </button>
      </form>
      {message ? (
        <p className="nearby-search-message" aria-live="polite">
          {message}
        </p>
      ) : null}

      {appliedBounds ? (
        <button
          className="clear-map-area"
          onClick={() => setAppliedBounds(undefined)}
          type="button"
        >
          지도 영역 필터 해제
        </button>
      ) : null}

      <div className="explore-split">
        <div className="explore-list-panel" aria-label="빵집 검색 결과 목록">
          {visibleItems.length > 0 ? (
            <div className="explore-unified-list">
              {visibleItems.map((item) =>
                item.kind === "verified" ? (
                  <div
                    className={
                      item.id === selected?.id
                        ? "map-result-card is-selected"
                        : "map-result-card"
                    }
                    key={item.id}
                  >
                    <BakeryCard bakery={item.bakery} />
                    <button
                      className="show-on-map"
                      onClick={() => {
                        setSelectedId(item.id);
                        changeView("map");
                      }}
                      type="button"
                    >
                      지도에서 보기
                    </button>
                  </div>
                ) : (
                  <CandidateResultCard
                    captured={capturedIds.includes(item.candidate.externalId)}
                    capturing={capturingId === item.candidate.externalId}
                    key={item.id}
                    onCapture={captureCandidate}
                    onSelect={() => {
                      setSelectedId(item.id);
                      changeView("map");
                    }}
                    place={item.candidate}
                    selected={item.id === selected?.id}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="empty-state compact">
              <h2>현재 영역에 표시할 빵집이 없어요.</h2>
              <p>지도 영역 필터를 해제하거나 다른 지역을 검색해 주세요.</p>
            </div>
          )}
        </div>

        <div className="explore-map-panel">
          <KakaoMap
            apiKey={mapApiKey}
            items={visibleItems}
            onBoundsChange={setMapBounds}
            onSelect={setSelectedId}
            selectedId={selected?.id}
          />
          <button
            className="search-map-area"
            disabled={loading || !mapBounds}
            onClick={searchCurrentMapArea}
            type="button"
          >
            이 지역 검색
          </button>
          {selected ? (
            <div className="map-preview-card">
              <span>
                {selected.kind === "verified"
                  ? "검증된 빵집"
                  : "카카오 미검증 후보"}
              </span>
              <strong>{selected.name}</strong>
              <p>{selected.address}</p>
              {selected.kind === "verified" ? (
                <Link href={`/bakery/${selected.bakery.slug}`}>
                  상세 보기 →
                </Link>
              ) : (
                <a
                  href={selected.candidate.placeUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  카카오맵 원문 →
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CandidateResultCard({
  captured,
  capturing,
  onCapture,
  onSelect,
  place,
  selected,
}: {
  captured: boolean;
  capturing: boolean;
  onCapture: (place: PlaceCandidate) => void;
  onSelect: () => void;
  place: PlaceCandidate;
  selected: boolean;
}) {
  return (
    <article
      className={
        selected
          ? "place-candidate-card map-result-card is-selected"
          : "place-candidate-card map-result-card"
      }
    >
      <div className="place-candidate-heading">
        <div>
          <span>카카오 미검증 후보</span>
          <h3>{place.name}</h3>
        </div>
        {place.distanceMeters !== undefined ? (
          <strong>{formatDistance(place.distanceMeters)}</strong>
        ) : null}
      </div>
      <p>{place.roadAddress ?? place.address}</p>
      <small>{place.category}</small>
      <div className="place-candidate-actions">
        <button
          disabled={captured || capturing || !place.captureToken}
          onClick={() => onCapture(place)}
          type="button"
        >
          {captured ? "검수 요청됨" : capturing ? "저장 중…" : "검수 요청"}
        </button>
        <button className="secondary-button" onClick={onSelect} type="button">
          지도에서 보기
        </button>
        <a href={place.placeUrl} rel="noreferrer" target="_blank">
          원문 ↗
        </a>
      </div>
    </article>
  );
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${distanceMeters.toLocaleString("ko-KR")}m`;
  }
  return `${(distanceMeters / 1_000).toFixed(1)}km`;
}
