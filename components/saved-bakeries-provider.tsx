"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  SAVED_BAKERIES_KEY,
  toggleSavedBakeryId,
} from "@/lib/storage";

type ToggleResult =
  | { ok: true; saved: boolean }
  | { ok: false; message: string };

type SavedBakeriesContextValue = {
  savedIds: string[];
  ready: boolean;
  isSaved: (bakeryId: string) => boolean;
  toggle: (bakeryId: string) => ToggleResult;
};

const SavedBakeriesContext =
  createContext<SavedBakeriesContextValue | null>(null);
const SAVED_EVENT = "bbang-gil:saved-bakeries-change";
const EMPTY_SNAPSHOT = "[]";

function subscribeToSavedBakeries(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SAVED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SAVED_EVENT, onStoreChange);
  };
}

function getSavedSnapshot() {
  try {
    return window.localStorage.getItem(SAVED_BAKERIES_KEY) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function getServerSavedSnapshot() {
  return EMPTY_SNAPSHOT;
}

function subscribeToHydration() {
  return () => undefined;
}

export function SavedBakeriesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const savedSnapshot = useSyncExternalStore(
    subscribeToSavedBakeries,
    getSavedSnapshot,
    getServerSavedSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const savedIds = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(savedSnapshot);
      return Array.isArray(parsed)
        ? parsed.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
    } catch {
      return [];
    }
  }, [savedSnapshot]);

  const toggle = useCallback((bakeryId: string): ToggleResult => {
    try {
      const next = toggleSavedBakeryId(window.localStorage, bakeryId);
      window.dispatchEvent(new Event(SAVED_EVENT));
      return { ok: true, saved: next.includes(bakeryId) };
    } catch {
      return {
        ok: false,
        message: "저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.",
      };
    }
  }, []);

  const value = useMemo(
    () => ({
      savedIds,
      ready,
      isSaved: (bakeryId: string) => savedIds.includes(bakeryId),
      toggle,
    }),
    [ready, savedIds, toggle],
  );

  return (
    <SavedBakeriesContext.Provider value={value}>
      {children}
    </SavedBakeriesContext.Provider>
  );
}

export function useSavedBakeries() {
  const context = useContext(SavedBakeriesContext);
  if (!context) {
    throw new Error(
      "useSavedBakeries must be used within SavedBakeriesProvider",
    );
  }

  return context;
}
