import type { GameState } from "@/core/battle/types";

const STORAGE_KEY = "fg-autobattler-phase1";

interface PersistedPayload {
  version: number;
  state: GameState;
}

const PERSIST_VERSION = 2;

export function loadFromStorage(): GameState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const payload = JSON.parse(raw) as PersistedPayload;
    if (!payload || payload.version !== PERSIST_VERSION) {
      return undefined;
    }
    return payload.state;
  } catch {
    return undefined;
  }
}

export function saveToStorage(state: GameState): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: PersistedPayload = {
    version: PERSIST_VERSION,
    state,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
