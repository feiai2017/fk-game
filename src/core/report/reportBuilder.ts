import { diagnoseBattle } from "@/core/battle/diagnosis";
import type { BattleInput, BattleReport, Loadout, SkillDef, Stats } from "@/core/battle/types";
import { buildTopDamageFormulaBreakdowns } from "@/core/battle/formulaExplain";
import type { SimulationOutput } from "@/core/battle/simulator";
import { generateLoot } from "@/core/loot/lootGenerator";
import { buildBattleRecap } from "@/core/report/battleRecap";
import { buildFocusedFloorDiagnosis } from "@/core/report/focusedFloorDiagnosis";
import { buildReportGuidance } from "@/core/report/guidance";
import { buildBattleTimeline } from "@/core/report/timelineFormatter";

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

  const timeline = buildBattleTimeline({
    events: simulation.combatEvents,
  });

  const report: BattleReport = {
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
    timeline,
    combatSnapshots: simulation.combatSnapshots,
    context: {
      seed: input.seedTag ?? null,
      floor: { ...input.floor },
      archetype: input.archetype,
      finalStats: cloneStats(input.finalStats),
      selectedSkills: cloneSkills(input.skills),
      loadout: cloneLoadout(input.loadout),
    },
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

  report.recap = buildBattleRecap(report);

  return report;
}

function cloneStats(stats: Stats): Stats {
  return { ...stats };
}

function cloneSkills(skills: SkillDef[]): SkillDef[] {
  return skills.map((skill) => ({
    ...skill,
    tags: [...skill.tags],
    dot: skill.dot ? { ...skill.dot } : undefined,
  }));
}

function cloneLoadout(loadout: Loadout): Loadout {
  return {
    weapon: loadout.weapon ? { ...loadout.weapon } : undefined,
    helm: loadout.helm ? { ...loadout.helm } : undefined,
    armor: loadout.armor ? { ...loadout.armor } : undefined,
    ring1: loadout.ring1 ? { ...loadout.ring1 } : undefined,
    ring2: loadout.ring2 ? { ...loadout.ring2 } : undefined,
    core: loadout.core ? { ...loadout.core } : undefined,
    skillIds: [...loadout.skillIds],
  };
}
