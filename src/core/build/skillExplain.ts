import type { ArchetypeKey, FloorDef, SkillDef, Stats } from "@/core/battle/types";
import {
  clamp,
  critMultiplier,
  pressureDamageModifier,
  reducedByDefense,
  reducedByResist,
} from "@/core/battle/formulas";

export type SkillRoleLabel = "setup" | "burst" | "finisher" | "cycle" | "defense";

export interface SkillPracticalExplain {
  skillId: string;
  name: string;
  cooldown: number;
  cost: number;
  tags: string[];
  role: SkillRoleLabel;
  effectDescription: string;
  strongWhen: string;
  estimated: {
    directPerHit?: number;
    directPerCast?: number;
    dotTick?: number;
    dotFullMaxStacks?: number;
    procPerTrigger?: number;
    shieldGain?: number;
    healGain?: number;
  };
}

interface ExplainSkillInput {
  skill: SkillDef;
  archetype: ArchetypeKey;
  stats: Stats;
  floor?: FloorDef;
}

export function explainSkillForBuild(input: ExplainSkillInput): SkillPracticalExplain {
  const defense = input.floor?.enemyDef ?? 80;
  const resist = input.floor?.enemyResist ?? 0.2;
  const directPressure = pressureDamageModifier("direct", input.floor?.pressure ?? "baseline");
  const dotPressure = pressureDamageModifier("dot", input.floor?.pressure ?? "baseline");
  const procPressure = pressureDamageModifier("proc", input.floor?.pressure ?? "baseline");
  const role = resolveRole(input.skill);
  const hits = Math.max(1, input.skill.hits ?? 1);

  const directPerCastRaw =
    input.stats.atk *
    (input.skill.directRatio ?? 0) *
    (1 + input.stats.skillPower) *
    directPressure *
    expectedCritMultiplier(input.skill, input.stats);
  const directPerCast = reduce(directPerCastRaw, defense, resist);
  const directPerHit = directPerCast / hits;

  const dotTickRaw = input.skill.dot
    ? input.stats.atk * input.skill.dot.tickRatio * (1 + input.stats.dotPower) * dotPressure
    : 0;
  const dotTick = reduce(dotTickRaw, defense, resist);
  const dotFullMaxStacks =
    input.skill.dot && dotTick > 0
      ? dotTick * input.skill.dot.maxStacks * Math.max(1, Math.floor(input.skill.dot.duration))
      : 0;

  const procRaw =
    input.stats.atk * (input.skill.procRatio ?? 0) * (1 + input.stats.procPower) * procPressure;
  const procPerTrigger = reduce(procRaw, defense, resist);
  const shieldGain =
    (input.skill.shieldRatio ?? 0) > 0
      ? input.stats.atk * (input.skill.shieldRatio ?? 0) * (1 + input.stats.shieldPower)
      : 0;
  const healGain =
    (input.skill.healRatio ?? 0) > 0
      ? input.stats.atk * (input.skill.healRatio ?? 0) * (1 + input.stats.skillPower * 0.6)
      : 0;

  return {
    skillId: input.skill.id,
    name: input.skill.name,
    cooldown: input.skill.cooldown,
    cost: input.skill.cost,
    tags: input.skill.tags,
    role,
    effectDescription: buildEffectDescription(input.skill),
    strongWhen: buildStrongWhen(input.skill, input.archetype),
    estimated: {
      directPerHit: directPerCast > 0 ? directPerHit : undefined,
      directPerCast: directPerCast > 0 ? directPerCast : undefined,
      dotTick: dotTick > 0 ? dotTick : undefined,
      dotFullMaxStacks: dotFullMaxStacks > 0 ? dotFullMaxStacks : undefined,
      procPerTrigger: procPerTrigger > 0 ? procPerTrigger : undefined,
      shieldGain: shieldGain > 0 ? shieldGain : undefined,
      healGain: healGain > 0 ? healGain : undefined,
    },
  };
}

function buildEffectDescription(skill: SkillDef): string {
  const parts: string[] = [];
  if ((skill.directRatio ?? 0) > 0) {
    const hitText = skill.hits && skill.hits > 1 ? `，${skill.hits} 段` : "";
    parts.push(`造成直接伤害（系数 ${(skill.directRatio ?? 0).toFixed(2)}${hitText}）`);
  }
  if (skill.dot) {
    parts.push(
      `附加 ${skill.dot.name}（${skill.dot.duration}s，tick系数 ${skill.dot.tickRatio.toFixed(
        2,
      )}，最大 ${skill.dot.maxStacks} 层）`,
    );
  }
  if ((skill.burstDotPercent ?? 0) > 0) {
    parts.push(`引爆剩余 DOT（${Math.round((skill.burstDotPercent ?? 0) * 100)}%）`);
  }
  if ((skill.procRatio ?? 0) > 0) {
    parts.push(`触发追加伤害（系数 ${skill.procRatio?.toFixed(2)}）`);
  }
  if ((skill.shieldRatio ?? 0) > 0) {
    parts.push(`获得护盾（系数 ${skill.shieldRatio?.toFixed(2)}）`);
  }
  if ((skill.healRatio ?? 0) > 0) {
    parts.push(`恢复生命（系数 ${skill.healRatio?.toFixed(2)}）`);
  }
  if (skill.id === "toxic_lance") {
    parts.push("命中后会向另一名目标扩散弱化DOT，用于开局压低多目标血线");
  }
  if (skill.id === "rupture_bloom") {
    parts.push("对已有DOT层数目标会额外增伤，定位是DOT转化收割");
  }
  if (parts.length === 0) {
    return "功能型技能";
  }
  return parts.join("；");
}

function buildStrongWhen(skill: SkillDef, archetype: ArchetypeKey): string {
  if (skill.id === "rupture_bloom") {
    return "先铺DOT再释放可明显提高斩杀效率，并通过击杀回能/护盾稳定节奏。";
  }
  if (skill.id === "contagion_wave") {
    return "敌人数较多或开局窗口时优先释放，尽快建立全体DOT覆盖。";
  }
  if (skill.id === "toxic_lance") {
    return "用于开局快速铺层和维持DOT覆盖，保证后续引爆有目标可吃满收益。";
  }
  if (skill.tags.includes("finisher")) {
    return "目标低血时价值最高，建议留给斩杀窗口。";
  }
  if ((skill.burstDotPercent ?? 0) > 0) {
    return "目标已有 DOT 层数时价值显著提升。";
  }
  if (skill.tags.includes("shield") || skill.tags.includes("heal")) {
    return "中段承伤升高时优先级上升。";
  }
  if (skill.tags.includes("cycle")) {
    return "资源偏低时用于回能并维持循环。";
  }
  if (archetype === "dot" && skill.tags.includes("dot")) {
    return "开局优先铺层可提升后续引爆收益。";
  }
  if (archetype === "engine" && skill.tags.includes("proc")) {
    return "资源稳定时触发链收益更高。";
  }
  return "建议按冷却节奏循环释放，避免资源空转。";
}

function resolveRole(skill: SkillDef): SkillRoleLabel {
  if (skill.tags.includes("finisher")) {
    return "finisher";
  }
  if (skill.tags.includes("shield") || skill.tags.includes("heal")) {
    return "defense";
  }
  if (skill.tags.includes("cycle")) {
    return "cycle";
  }
  if ((skill.burstDotPercent ?? 0) > 0 || skill.tags.includes("burst")) {
    return "burst";
  }
  return "setup";
}

function expectedCritMultiplier(skill: SkillDef, stats: Stats): number {
  const chance = clamp(stats.crit + (skill.critBonus ?? 0), 0, 0.95);
  const multi = critMultiplier(stats.critDamage);
  return 1 - chance + chance * multi;
}

function reduce(raw: number, def: number, resist: number): number {
  return reducedByResist(reducedByDefense(raw, def), resist);
}
