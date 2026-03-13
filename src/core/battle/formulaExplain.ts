import type {
  BattleInput,
  BattleMetrics,
  DamageFormulaBreakdown,
  DamageEntry,
  SkillDef,
} from "@/core/battle/types";
import { clamp, critMultiplier, pressureDamageModifier } from "@/core/battle/formulas";
import { ratio } from "@/core/report/breakdown";

interface BuildFormulaBreakdownsInput {
  input: BattleInput;
  metrics: BattleMetrics;
  topN?: number;
}

export function buildTopDamageFormulaBreakdowns(
  input: BuildFormulaBreakdownsInput,
): DamageFormulaBreakdown[] {
  const topN = Math.max(1, Math.min(5, input.topN ?? 3));
  return [...input.metrics.damageBySource]
    .sort((left, right) => right.total - left.total)
    .slice(0, topN)
    .map((entry) => explainDamageEntry(entry, input.input, input.metrics.totalDamage));
}

function explainDamageEntry(
  entry: DamageEntry,
  battleInput: BattleInput,
  totalDamage: number,
): DamageFormulaBreakdown {
  const skill = battleInput.skills.find((candidate) => candidate.id === entry.sourceId);
  const sourceRatio = resolveSourceRatio(entry, skill);
  const powerMultiplier = resolvePowerMultiplier(entry.category, battleInput.finalStats, skill);
  const pressureMultiplier = pressureDamageModifier(entry.category, battleInput.floor.pressure);
  const critExpectation = resolveCritExpectation(entry, battleInput, skill);
  const defenseMultiplier = 100 / (100 + Math.max(0, battleInput.floor.enemyDef));
  const resistMultiplier = 1 - clamp(battleInput.floor.enemyResist, 0, 0.75);
  const basePreMitigation =
    battleInput.finalStats.atk *
    sourceRatio *
    powerMultiplier *
    pressureMultiplier *
    critExpectation;
  const finalApproxPerHit = basePreMitigation * defenseMultiplier * resistMultiplier;
  const mitigationLoss = clamp(1 - defenseMultiplier * resistMultiplier, 0, 0.95);

  return {
    sourceId: entry.sourceId,
    sourceName: entry.sourceName,
    category: entry.category,
    totalDamage: entry.total,
    ratioToTotal: ratio(entry.total, totalDamage),
    baseTerm: `ATK(${round2(battleInput.finalStats.atk)})`,
    sourceRatioTerm: `系数(${round2(sourceRatio)})`,
    majorModifiers: compactModifiers([
      `威力(${round2(powerMultiplier)})`,
      `压力修正(${round2(pressureMultiplier)})`,
      critExpectation > 1 ? `暴击期望(${round2(critExpectation)})` : undefined,
    ]),
    defenseMultiplier,
    resistMultiplier,
    finalApproxPerHit,
    reductionSummary: `防御+抗性约削减 ${(mitigationLoss * 100).toFixed(1)}%`,
  };
}

function resolveSourceRatio(entry: DamageEntry, skill?: SkillDef): number {
  if (entry.sourceId === "basic_attack") {
    return 1;
  }
  if (skill) {
    if (entry.category === "dot") {
      return skill.dot?.tickRatio ?? skill.burstDotPercent ?? 0.4;
    }
    if (entry.category === "proc") {
      return skill.procRatio ?? 0.3;
    }
    return skill.directRatio ?? 1;
  }
  if (entry.sourceId.startsWith("trigger:")) {
    return 0.3;
  }
  if (entry.sourceId.startsWith("core_")) {
    return 0.3;
  }
  return 0.5;
}

function resolvePowerMultiplier(
  category: DamageEntry["category"],
  stats: BattleInput["finalStats"],
  skill?: SkillDef,
): number {
  if (category === "dot") {
    const burstBonus = (skill?.burstDotPercent ?? 0) > 0 ? 0.12 : 0;
    return 1 + stats.dotPower + burstBonus;
  }
  if (category === "proc") {
    return 1 + stats.procPower;
  }
  return 1 + stats.skillPower;
}

function resolveCritExpectation(
  entry: DamageEntry,
  battleInput: BattleInput,
  skill?: SkillDef,
): number {
  if (entry.category !== "direct") {
    return 1;
  }
  const baseChance = battleInput.finalStats.crit + (skill?.critBonus ?? 0);
  const chance = clamp(baseChance, 0, 0.95);
  const critMulti = critMultiplier(battleInput.finalStats.critDamage);
  return 1 - chance + chance * critMulti;
}

function compactModifiers(entries: Array<string | undefined>): string[] {
  return entries.filter((entry): entry is string => Boolean(entry));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
