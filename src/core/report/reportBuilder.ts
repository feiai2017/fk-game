import { diagnoseBattle } from "@/core/battle/diagnosis";
import type { BattleInput, BattleReport } from "@/core/battle/types";
import { buildTopDamageFormulaBreakdowns } from "@/core/battle/formulaExplain";
import type { SimulationOutput } from "@/core/battle/simulator";
import { generateLoot } from "@/core/loot/lootGenerator";
import { buildFocusedFloorDiagnosis } from "@/core/report/focusedFloorDiagnosis";
import { buildReportGuidance } from "@/core/report/guidance";

interface BuildReportInput {
  input: BattleInput;
  simulation: SimulationOutput;
}

export function buildBattleReport(args: BuildReportInput): BattleReport {
  const { input, simulation } = args;
  const diagnosis = diagnoseBattle({
    win: simulation.win,
    floor: input.floor,
    archetype: input.archetype,
    metrics: simulation.metrics,
  });
  const loot = generateLoot({
    win: simulation.win,
    floor: input.floor,
    archetype: input.archetype,
    seed: `${input.floor.floor}:${simulation.metrics.totalDamage.toFixed(1)}:${simulation.metrics.duration.toFixed(
      1,
    )}`,
  });

  return {
    win: simulation.win,
    floor: input.floor.floor,
    pressure: input.floor.pressure,
    metrics: simulation.metrics,
    diagnosis,
    guidance: buildReportGuidance({
      floor: input.floor,
      archetype: input.archetype,
      metrics: simulation.metrics,
      diagnosis,
      loadout: input.loadout,
    }),
    combatLog: simulation.combatLog,
    combatEvents: simulation.combatEvents,
    formulaBreakdowns: buildTopDamageFormulaBreakdowns({
      input,
      metrics: simulation.metrics,
      topN: 3,
    }),
    focusedFloorDiagnosis: buildFocusedFloorDiagnosis({
      baseInput: input,
      runCount: 10,
    }),
    loot,
  };
}
