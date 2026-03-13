import type {
  ArchetypeKey,
  BattleReport,
  Loadout,
  PassiveEffectDef,
  RelicDef,
  RunEndSummary,
  RunProgress,
  RunRewardRecord,
  RunSkillUpgrade,
  RunState,
  SkillDef,
  Stats,
} from "@/core/battle/types";
import { RELIC_BY_ID } from "@/data/relics";

const STAT_KEYS: Array<keyof Stats> = [
  "hp",
  "atk",
  "def",
  "speed",
  "crit",
  "critDamage",
  "skillPower",
  "dotPower",
  "procPower",
  "resist",
  "regen",
  "shieldPower",
  "cdr",
  "resourceMax",
  "resourceRegen",
];

export function createInitialRunState(startFloor = 1): RunState {
  return {
    id: `run-${Date.now()}`,
    status: "in_progress",
    currentFloor: startFloor,
    canContinue: true,
    isOver: false,
    progress: createInitialRunProgress(),
  };
}

export function createInitialRunProgress(): RunProgress {
  return {
    statBonuses: {},
    skillUpgrades: {},
    passiveEffects: [],
    relicIds: [],
    selectedRewards: [],
    wins: 0,
    totalDamage: 0,
    totalDamageTaken: 0,
    highestClearedFloor: 0,
    damageByStyle: {
      direct: 0,
      dot: 0,
      proc: 0,
    },
  };
}

export function applyRunProgressToStats(base: Stats, progress: RunProgress): Stats {
  const relicStatBonus = mergeRelicStats(progress.relicIds);
  const merged: Stats = { ...base };
  for (const key of STAT_KEYS) {
    merged[key] += (progress.statBonuses[key] ?? 0) + (relicStatBonus[key] ?? 0);
  }
  return merged;
}

export function applyRunProgressToSkills(skills: SkillDef[], progress: RunProgress): SkillDef[] {
  return skills.map((skill) => {
    const upgrade = progress.skillUpgrades[skill.id];
    if (!upgrade) {
      return skill;
    }
    return applySkillUpgrade(skill, upgrade);
  });
}

export function applyRunProgressToLoadout(loadout: Loadout, progress: RunProgress): Loadout {
  const relicEffects = progress.relicIds.flatMap((id) => RELIC_BY_ID[id]?.mechanicEffects ?? []);
  const combinedEffects: PassiveEffectDef[] = [
    ...(loadout.core?.mechanicEffects ?? []),
    ...relicEffects,
    ...progress.passiveEffects,
  ];
  const relicModifiers = mergeRelicModifiers(progress.relicIds);
  const core = mergeCore(loadout.core, combinedEffects, relicModifiers);
  return {
    ...loadout,
    core,
  };
}

export function appendBattleToRunProgress(progress: RunProgress, report: BattleReport): RunProgress {
  const next = cloneRunProgress(progress);
  next.totalDamage += report.metrics.totalDamage;
  next.totalDamageTaken += report.metrics.damageTaken;
  next.damageByStyle.direct += report.metrics.totalDamage * report.metrics.directDamageRatio;
  next.damageByStyle.dot += report.metrics.dotDamage;
  next.damageByStyle.proc += report.metrics.procDamage;

  if ((next.mostDangerousDamageTaken ?? 0) < report.metrics.damageTaken) {
    next.mostDangerousDamageTaken = report.metrics.damageTaken;
    next.mostDangerousFloor = report.floor;
  }
  if (report.win) {
    next.wins += 1;
    next.highestClearedFloor = Math.max(next.highestClearedFloor, report.floor);
  }
  return next;
}

export function appendRunRewardRecord(
  progress: RunProgress,
  record: RunRewardRecord,
): RunProgress {
  const next = cloneRunProgress(progress);
  next.selectedRewards = [...next.selectedRewards, record];
  return next;
}

export function buildRunEndSummary(input: {
  run: RunState;
  archetype: ArchetypeKey;
  reachedFloor: number;
  outcome: "victory" | "defeat";
}): RunEndSummary {
  const dominantDamageStyle = dominantStyle(input.run.progress.damageByStyle);
  return {
    runId: input.run.id,
    outcome: input.outcome,
    reachedFloor: input.reachedFloor,
    highestClearedFloor: input.run.progress.highestClearedFloor,
    totalDamage: input.run.progress.totalDamage,
    totalDamageTaken: input.run.progress.totalDamageTaken,
    selectedRewards: input.run.progress.selectedRewards,
    dominantDamageStyle,
    mostDangerousFloor: input.run.progress.mostDangerousFloor,
    shortBuildSummary: shortBuildSummary(input.archetype, dominantDamageStyle, input.run.progress),
  };
}

function applySkillUpgrade(skill: SkillDef, upgrade: RunSkillUpgrade): SkillDef {
  return {
    ...skill,
    cooldown: Math.max(0.4, skill.cooldown - (upgrade.cooldownReduction ?? 0)),
    cost: Math.max(0, skill.cost - (upgrade.costReduction ?? 0)),
    directRatio: addMaybe(skill.directRatio, upgrade.directRatioBonus),
    procRatio: addMaybe(skill.procRatio, upgrade.procRatioBonus),
    dot: skill.dot
      ? {
          ...skill.dot,
          tickRatio: skill.dot.tickRatio + (upgrade.dotTickBonus ?? 0),
        }
      : undefined,
  };
}

function addMaybe(value: number | undefined, bonus: number | undefined): number | undefined {
  if (bonus === undefined) {
    return value;
  }
  return (value ?? 0) + bonus;
}

function mergeRelicStats(ids: string[]): Partial<Stats> {
  const merged: Partial<Stats> = {};
  for (const id of ids) {
    const relic = RELIC_BY_ID[id];
    if (!relic) {
      continue;
    }
    for (const key of STAT_KEYS) {
      merged[key] = (merged[key] ?? 0) + (relic.stats[key] ?? 0);
    }
  }
  return merged;
}

function mergeRelicModifiers(ids: string[]): NonNullable<RelicDef["mechanicModifiers"]> {
  const merged: NonNullable<RelicDef["mechanicModifiers"]> = {};
  for (const id of ids) {
    const modifier = RELIC_BY_ID[id]?.mechanicModifiers;
    if (!modifier) {
      continue;
    }
    if ((modifier.dotBurstBonus ?? 0) > 0) {
      merged.dotBurstBonus = (merged.dotBurstBonus ?? 0) + (modifier.dotBurstBonus ?? 0);
    }
    if ((modifier.executeBonus ?? 0) > 0) {
      merged.executeBonus = (merged.executeBonus ?? 0) + (modifier.executeBonus ?? 0);
    }
    if ((modifier.extraDotStacks ?? 0) > 0) {
      merged.extraDotStacks = (merged.extraDotStacks ?? 0) + (modifier.extraDotStacks ?? 0);
    }
    if ((modifier.resourceRefundBonus ?? 0) > 0) {
      merged.resourceRefundBonus =
        (merged.resourceRefundBonus ?? 0) + (modifier.resourceRefundBonus ?? 0);
    }
    if (modifier.procTriggerOnSpend) {
      merged.procTriggerOnSpend = true;
    }
  }
  return merged;
}

function mergeCore(
  core: Loadout["core"],
  effects: PassiveEffectDef[],
  bonusModifiers: NonNullable<RelicDef["mechanicModifiers"]>,
): Loadout["core"] {
  if (!core && effects.length === 0 && Object.keys(bonusModifiers).length === 0) {
    return core;
  }
  const base = core ?? {
    id: "core_run_blessing",
    name: "跑局祝福核心",
    slot: "core",
    rarity: "rare",
    stats: {},
    desc: "跑局奖励提供的临时核心效果。",
  };
  return {
    ...base,
    mechanicEffects: effects,
    mechanicModifiers: {
      ...base.mechanicModifiers,
      ...bonusModifiers,
      dotBurstBonus: (base.mechanicModifiers?.dotBurstBonus ?? 0) + (bonusModifiers.dotBurstBonus ?? 0),
      executeBonus: (base.mechanicModifiers?.executeBonus ?? 0) + (bonusModifiers.executeBonus ?? 0),
      extraDotStacks: (base.mechanicModifiers?.extraDotStacks ?? 0) + (bonusModifiers.extraDotStacks ?? 0),
      resourceRefundBonus:
        (base.mechanicModifiers?.resourceRefundBonus ?? 0) + (bonusModifiers.resourceRefundBonus ?? 0),
      procTriggerOnSpend:
        base.mechanicModifiers?.procTriggerOnSpend || bonusModifiers.procTriggerOnSpend || false,
    },
  };
}

function dominantStyle(values: RunProgress["damageByStyle"]): "direct" | "dot" | "proc" {
  const entries = Object.entries(values) as Array<["direct" | "dot" | "proc", number]>;
  return entries.sort((left, right) => right[1] - left[1])[0][0];
}

function shortBuildSummary(
  archetype: ArchetypeKey,
  style: "direct" | "dot" | "proc",
  progress: RunProgress,
): string {
  const styleLabel =
    style === "dot" ? "DOT占主导" : style === "proc" ? "触发链占主导" : "直伤占主导";
  return `${archetype} 流派，${styleLabel}，累计选择 ${progress.selectedRewards.length} 个奖励。`;
}

function cloneRunProgress(progress: RunProgress): RunProgress {
  return {
    ...progress,
    statBonuses: { ...progress.statBonuses },
    skillUpgrades: { ...progress.skillUpgrades },
    passiveEffects: [...progress.passiveEffects],
    relicIds: [...progress.relicIds],
    selectedRewards: [...progress.selectedRewards],
    damageByStyle: { ...progress.damageByStyle },
  };
}
