"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { PlaceCandidate, PlaceSearchResult } from "@/lib/place-provider";

type NearbyBakerySearchProps = {
  autoSearch?: boolean;
  initialQuery?: string;
};

export function NearbyBakerySearch({
  autoSearch = false,
  initialQuery = "",
}: NearbyBakerySearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [places, setPlaces] = useState<PlaceCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturingId, setCapturingId] = useState("");
  const [capturedIds, setCapturedIds] = useState<string[]>([]);
  const autoSearchStarted = useRef(false);

  const searchPlaces = useCallback(
    async (
      searchQuery: string,
      coordinates?: { latitude: number; longitude: number },
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
        }

        const response = await fetch(`/api/places/search?${params}`);
        const payload = (await response.json().catch(() => null)) as
          | (PlaceSearchResult & { message?: string })
          | { message?: string }
          | null;

        if (!response.ok || !payload || !("places" in payload)) {
          throw new Error(payload?.message ?? "주변 빵집을 검색하지 못했어요.");
        }

        setPlaces(payload.places);
        setMessage(
          payload.places.length === 0
            ? "조건에 맞는 카카오 장소를 찾지 못했어요."
            : coordinates
              ? `현재 위치 주변 ${payload.places.length}곳을 찾았어요.`
              : `카카오 장소 ${payload.places.length}곳을 찾았어요.`,
        );
      } catch (cause) {
        setPlaces([]);
        setMessage(
          cause instanceof Error
            ? cause.message
            : "주변 빵집을 검색하지 못했어요.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!autoSearch || !initialQuery.trim() || autoSearchStarted.current) {
      return;
    }

    autoSearchStarted.current = true;
    void searchPlaces(initialQuery);
  }, [autoSearch, initialQuery, searchPlaces]);

  async function submit(event: FormEvent<HTMLFormElement>) {
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

      setCapturedIds((current) =>
        current.includes(place.externalId)
          ? current
          : [...current, place.externalId],
      );
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
    <section className="nearby-search" aria-labelledby="nearby-search-title">
      <div>
        <span className="eyebrow">KAKAO PLACE SEARCH</span>
        <h2 id="nearby-search-title">우리 동네 빵집 찾기</h2>
        <p>
          카카오 장소 결과는 아직 빵길에서 검증하지 않은 후보로 구분해 보여줘요.
        </p>
      </div>

      <form className="nearby-search-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="nearby-query">
          동네 또는 빵집 이름
        </label>
        <input
          id="nearby-query"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 성수동 빵집"
          value={query}
        />
        <button disabled={loading} type="submit">
          {loading ? "검색 중…" : "장소 검색"}
        </button>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={searchNearby}
          type="button"
        >
          ◎ 내 위치 주변
        </button>
      </form>

      {message ? (
        <p className="nearby-search-message" aria-live="polite">
          {message}
        </p>
      ) : null}

      {places.length > 0 ? (
        <div className="place-candidate-grid">
          {places.map((place) => (
            <PlaceCandidateCard
              captured={capturedIds.includes(place.externalId)}
              capturing={capturingId === place.externalId}
              key={place.externalId}
              onCapture={captureCandidate}
              place={place}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PlaceCandidateCard({
  captured,
  capturing,
  onCapture,
  place,
}: {
  captured: boolean;
  capturing: boolean;
  onCapture: (place: PlaceCandidate) => void;
  place: PlaceCandidate;
}) {
  return (
    <article className="place-candidate-card">
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
        {place.phone ? <a href={`tel:${place.phone}`}>전화</a> : null}
        <a href={place.placeUrl} rel="noreferrer" target="_blank">
          카카오맵에서 확인 ↗
        </a>
      </div>
      <small>
        카카오 장소 · {new Date(place.retrievedAt).toLocaleString("ko-KR")} 조회
      </small>
    </article>
  );
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${distanceMeters.toLocaleString("ko-KR")}m`;
  }
  return `${(distanceMeters / 1_000).toFixed(1)}km`;
}
