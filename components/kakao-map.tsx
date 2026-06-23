"use client";

import { useEffect, useRef, useState } from "react";
import type { ExploreMapItem, MapBounds } from "@/lib/explore-map";
import { getMapCenter } from "@/lib/explore-map";

type Props = {
  apiKey?: string;
  items: ExploreMapItem[];
  selectedId?: string;
  onBoundsChange: (bounds: MapBounds) => void;
  onSelect: (id: string) => void;
};

type KakaoLatLng = {
  getLat(): number;
  getLng(): number;
};

type KakaoBounds = {
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
  extend(position: KakaoLatLng): void;
};

type KakaoMap = {
  getBounds(): KakaoBounds;
  panTo(position: KakaoLatLng): void;
  relayout(): void;
  setBounds(bounds: KakaoBounds): void;
};

type KakaoMarker = {
  setMap(map: KakaoMap | null): void;
  setZIndex(value: number): void;
};

type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    title: string;
    clickable: boolean;
  }) => KakaoMarker;
  event: {
    addListener(
      target: KakaoMap | KakaoMarker,
      type: string,
      handler: () => void,
    ): void;
    removeListener(
      target: KakaoMap | KakaoMarker,
      type: string,
      handler: () => void,
    ): void;
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let sdkPromise: Promise<KakaoMaps> | null = null;

export function KakaoMap({
  apiKey,
  items,
  selectedId,
  onBoundsChange,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());
  const itemsRef = useRef(items);
  const prevItemsRef = useRef(items);
  const prevSelectedIdRef = useRef(selectedId);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    apiKey ? "loading" : "error",
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      return;
    }

    let active = true;
    const markers = markersRef.current;
    void loadKakaoMaps(apiKey)
      .then((maps) => {
        if (!active || !containerRef.current) {
          return;
        }
        const center = getMapCenter(itemsRef.current);
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.latitude, center.longitude),
          level: itemsRef.current.length > 1 ? 8 : 4,
        });
        mapRef.current = map;
        const idleHandler = () =>
          onBoundsChangeRef.current(readBounds(map.getBounds()));
        maps.event.addListener(map, "idle", idleHandler);
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
      markers.forEach((marker) => marker.setMap(null));
      markers.clear();
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();
    const bounds = new maps.LatLngBounds();

    for (const item of items) {
      const position = new maps.LatLng(item.latitude, item.longitude);
      bounds.extend(position);
      const marker = new maps.Marker({
        map,
        position,
        title: `${item.kind === "verified" ? "검증된 빵집" : "미검증 후보"} · ${item.name}`,
        clickable: true,
      });
      marker.setZIndex(1);
      maps.event.addListener(marker, "click", () => onSelect(item.id));
      markersRef.current.set(item.id, marker);
    }

    map.relayout();
    if (items.length > 1) {
      map.setBounds(bounds);
    } else if (items[0]) {
      map.panTo(new maps.LatLng(items[0].latitude, items[0].longitude));
    }
  }, [items, onSelect, status]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) =>
      marker.setZIndex(id === selectedId ? 10 : 1),
    );

    const itemsChanged = prevItemsRef.current !== items;
    const selectionChanged = prevSelectedIdRef.current !== selectedId;
    prevItemsRef.current = items;
    prevSelectedIdRef.current = selectedId;

    // items가 바뀐 프레임에서는 마커 생성 effect의 setBounds가 화면을 잡으므로
    // panTo를 생략한다. 순수 사용자 선택(selectedId만 변경)일 때만 이동한다.
    if (itemsChanged || !selectionChanged || !selectedId) {
      return;
    }

    const selected = items.find((item) => item.id === selectedId);
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (selected && map && maps) {
      map.panTo(new maps.LatLng(selected.latitude, selected.longitude));
    }
  }, [items, selectedId]);

  return (
    <div className="explore-map-shell">
      <div
        aria-label="빵집 검색 결과 지도"
        className="explore-map-canvas"
        ref={containerRef}
        role="application"
      />
      {status !== "ready" ? (
        <div className="explore-map-fallback">
          <span aria-hidden="true">⌖</span>
          <strong>
            {apiKey ? "지도를 불러오는 중이에요" : "카카오 지도 키가 필요해요"}
          </strong>
          <p>
            {apiKey
              ? "잠시 후에도 보이지 않으면 JavaScript SDK 도메인 설정을 확인해 주세요."
              : "목록 탐색은 그대로 사용할 수 있습니다. NEXT_PUBLIC_KAKAO_MAP_JS_KEY를 설정해 주세요."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function loadKakaoMaps(apiKey: string) {
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao.maps);
  }
  if (sdkPromise) {
    return sdkPromise;
  }

  const promise = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey)}&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error("Kakao Maps SDK is unavailable."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };
    script.onerror = () => reject(new Error("Kakao Maps SDK failed to load."));
    document.head.appendChild(script);
  });

  sdkPromise = promise;
  // 로드 실패 시 캐시를 비워 다음 마운트에서 재시도할 수 있게 한다.
  // 더 새로운 시도가 이미 들어왔다면 그 promise는 덮어쓰지 않는다.
  promise.catch(() => {
    if (sdkPromise === promise) {
      sdkPromise = null;
    }
  });

  return promise;
}

function readBounds(bounds: KakaoBounds): MapBounds {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  return {
    south: southWest.getLat(),
    west: southWest.getLng(),
    north: northEast.getLat(),
    east: northEast.getLng(),
  };
}
