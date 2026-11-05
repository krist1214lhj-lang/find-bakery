"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  VISIT_LOG_KEY,
  VisitLogError,
  addVisit,
  deleteVisit,
  importVisits,
  parseVisits,
  todayInSeoul,
  updateVisit,
  visitsForBakery,
  type ImportResult,
  type VisitDraft,
  type VisitEntry,
} from "@/lib/visit-log";

type ActionResult<T> = { ok: true; value: T } | { ok: false; message: string };

type VisitLogContextValue = {
  visits: VisitEntry[];
  ready: boolean;
  latestFor: (bakeryId: string) => VisitEntry | undefined;
  add: (draft: VisitDraft) => ActionResult<VisitEntry>;
  update: (visitId: string, draft: VisitDraft) => ActionResult<VisitEntry>;
  remove: (visitId: string) => ActionResult<boolean>;
  importText: (text: string) => ActionResult<ImportResult>;
};

const VisitLogContext = createContext<VisitLogContextValue | null>(null);
const VISIT_LOG_EVENT = "bbang-gil:visit-log-change";
const EMPTY_SNAPSHOT = "[]";
const STORAGE_FAILURE =
  "기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.";

function subscribeToVisitLog(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(VISIT_LOG_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(VISIT_LOG_EVENT, onStoreChange);
  };
}

function getVisitLogSnapshot() {
  try {
    return window.localStorage.getItem(VISIT_LOG_KEY) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function getServerVisitLogSnapshot() {
  return EMPTY_SNAPSHOT;
}

function subscribeToHydration() {
  return () => undefined;
}

function run<T>(action: () => T): ActionResult<T> {
  try {
    const value = action();
    window.dispatchEvent(new Event(VISIT_LOG_EVENT));
    return { ok: true, value };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof VisitLogError ? cause.message : STORAGE_FAILURE,
    };
  }
}

export function VisitLogProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeToVisitLog,
    getVisitLogSnapshot,
    getServerVisitLogSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const visits = useMemo(() => parseVisits(snapshot), [snapshot]);
  const latestByBakery = useMemo(() => {
    const latest = new Map<string, VisitEntry>();
    for (const bakeryId of new Set(visits.map((visit) => visit.bakeryId))) {
      latest.set(bakeryId, visitsForBakery(visits, bakeryId)[0]);
    }
    return latest;
  }, [visits]);

  const add = useCallback(
    (draft: VisitDraft) =>
      run(() =>
        addVisit(window.localStorage, draft, { today: todayInSeoul() }),
      ),
    [],
  );
  const update = useCallback(
    (visitId: string, draft: VisitDraft) =>
      run(() =>
        updateVisit(window.localStorage, visitId, draft, {
          today: todayInSeoul(),
        }),
      ),
    [],
  );
  const remove = useCallback(
    (visitId: string) => run(() => deleteVisit(window.localStorage, visitId)),
    [],
  );
  const importText = useCallback(
    (text: string) => run(() => importVisits(window.localStorage, text)),
    [],
  );

  const value = useMemo(
    () => ({
      visits,
      ready,
      latestFor: (bakeryId: string) => latestByBakery.get(bakeryId),
      add,
      update,
      remove,
      importText,
    }),
    [add, importText, latestByBakery, ready, remove, update, visits],
  );

  return (
    <VisitLogContext.Provider value={value}>
      {children}
    </VisitLogContext.Provider>
  );
}

export function useVisitLog() {
  const context = useContext(VisitLogContext);
  if (!context) {
    throw new Error("useVisitLog must be used within VisitLogProvider");
  }

  return context;
}
