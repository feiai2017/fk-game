import type { ArchetypeKey, RunProgress } from "@/core/battle/types";
import { SKILL_BY_ID } from "@/data/skills";

export interface DemoBuildSummary {
  archetypeLabel: string;
  routeLabel: string;
  coreSkills: string[];
  keyBonuses: string[];
  summaryText: string;
}

export function buildDemoBuildSummary(input: {
  archetype: ArchetypeKey;
  skillIds: string[];
  progress: RunProgress;
}): DemoBuildSummary {
  const { archetype, skillIds, progress } = input;
  const coreSkills = skillIds.map((id) => SKILL_BY_ID[id]?.name ?? id).slice(0, 3);
  const keyBonuses = collectKeyBonuses(progress);

  if (archetype === "dot") {
    const routeLabel = detectDotRoute(progress);
    return {
      archetypeLabel: "持续伤害",
      routeLabel,
      coreSkills,
      keyBonuses,
      summaryText: dotSummary(routeLabel),
    };
  }
  if (archetype === "crit") {
    return {
      archetypeLabel: "暴击直伤",
      routeLabel: "暴击收割",
      coreSkills,
      keyBonuses,
      summaryText: "优先保证中期稳定输出，再利用斩杀窗口完成收尾。",
    };
  }
  return {
    archetypeLabel: "资源引擎",
    routeLabel: "循环兑现",
    coreSkills,
    keyBonuses,
    summaryText: "把资源循环稳定转化为触发伤害，避免溢出浪费。",
  };
}

function detectDotRoute(progress: RunProgress): string {
  const rewardTitles = progress.selectedRewards.map((reward) => reward.title).join("|").toLowerCase();
  if (
    rewardTitles.includes("spread") ||
    rewardTitles.includes("扩散") ||
    rewardTitles.includes("传染")
  ) {
    return "DOT扩散";
  }
  if (
    rewardTitles.includes("rupture") ||
    rewardTitles.includes("burst") ||
    rewardTitles.includes("引爆") ||
    rewardTitles.includes("爆发")
  ) {
    return "DOT引爆";
  }
  return "DOT续航";
}

function collectKeyBonuses(progress: RunProgress): string[] {
  const rows: string[] = [];
  if ((progress.statBonuses.dotPower ?? 0) > 0) {
    rows.push(`DOT+${Math.round((progress.statBonuses.dotPower ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.resourceRegen ?? 0) > 0) {
    rows.push(`能量回复+${(progress.statBonuses.resourceRegen ?? 0).toFixed(1)}`);
  }
  if ((progress.statBonuses.cdr ?? 0) > 0) {
    rows.push(`冷却缩减+${Math.round((progress.statBonuses.cdr ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.hp ?? 0) > 0) {
    rows.push(`生命+${Math.round(progress.statBonuses.hp ?? 0)}`);
  }
  if (progress.passiveEffects.length > 0) {
    rows.push(`机制效果 x${progress.passiveEffects.length}`);
  }
  return rows.length > 0 ? rows : ["暂无关键增益"];
}

function dotSummary(route: string): string {
  if (route === "DOT扩散") {
    return "优先建立多目标覆盖，尽快压低全场血线并创造首杀。";
  }
  if (route === "DOT引爆") {
    return "先叠层再引爆，尽快拿到首杀以降低群体压力。";
  }
  return "优先保障循环稳定与生存，持续兑现DOT价值。";
}
