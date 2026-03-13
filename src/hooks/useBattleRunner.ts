import { useCallback } from "react";
import { runAutoBattle } from "@/core/battle/simulator";
import type { BattleInput, BattleReport } from "@/core/battle/types";
import { buildBattleReport } from "@/core/report/reportBuilder";

export function useBattleRunner(): (input: BattleInput) => BattleReport {
  return useCallback((input: BattleInput) => {
    const simulation = runAutoBattle(input);
    return buildBattleReport({ input, simulation });
  }, []);
}

