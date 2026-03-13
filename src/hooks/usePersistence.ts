import { useCallback } from "react";
import type { GameState } from "@/core/battle/types";
import { loadFromStorage, saveToStorage } from "@/core/persistence/storage";

export function usePersistence(): {
  loadState: () => GameState | undefined;
  saveState: (state: GameState) => void;
} {
  const loadState = useCallback(() => loadFromStorage(), []);
  const saveState = useCallback((state: GameState) => {
    saveToStorage(state);
  }, []);

  return { loadState, saveState };
}

