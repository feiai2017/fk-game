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
  const routeLabel = detectRoute(archetype, progress);

  if (archetype === "dot") {
    return {
      archetypeLabel: "持续伤害",
      routeLabel,
      coreSkills,
      keyBonuses,
      summaryText: buildDotSummary(routeLabel),
    };
  }

  if (archetype === "crit") {
    return {
      archetypeLabel: "暴击直伤",
      routeLabel,
      coreSkills,
      keyBonuses,
      summaryText: buildCritSummary(routeLabel),
    };
  }

  return {
    archetypeLabel: "资源引擎",
    routeLabel,
    coreSkills,
    keyBonuses,
    summaryText: buildEngineSummary(routeLabel),
  };
}

function detectRoute(archetype: ArchetypeKey, progress: RunProgress): string {
  const rewardTitles = progress.selectedRewards.map((reward) => reward.title).join("|").toLowerCase();
  if (archetype === "dot") {
    if (rewardTitles.includes("扩散") || rewardTitles.includes("spread") || rewardTitles.includes("传染")) {
      return "DOT扩散";
    }
    if (rewardTitles.includes("引爆") || rewardTitles.includes("rupture") || rewardTitles.includes("burst")) {
      return "DOT引爆";
    }
    return "DOT续航";
  }

  if (archetype === "crit") {
    if (rewardTitles.includes("处决") || rewardTitles.includes("execute")) {
      return "处决压缩";
    }
    if (rewardTitles.includes("收割") || rewardTitles.includes("finisher")) {
      return "暴击收割";
    }
    return "暴击推进";
  }

  if (rewardTitles.includes("过载") || rewardTitles.includes("overflow")) {
    return "过载导流";
  }
  if (rewardTitles.includes("循环") || rewardTitles.includes("convert")) {
    return "循环兑现";
  }
  return "稳定回路";
}

function collectKeyBonuses(progress: RunProgress): string[] {
  const rows: string[] = [];
  if ((progress.statBonuses.dotPower ?? 0) > 0) {
    rows.push(`DOT+${Math.round((progress.statBonuses.dotPower ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.crit ?? 0) > 0) {
    rows.push(`暴击+${Math.round((progress.statBonuses.crit ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.critDamage ?? 0) > 0) {
    rows.push(`暴伤+${Math.round((progress.statBonuses.critDamage ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.procPower ?? 0) > 0) {
    rows.push(`触发+${Math.round((progress.statBonuses.procPower ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.resourceRegen ?? 0) > 0) {
    rows.push(`回能+${(progress.statBonuses.resourceRegen ?? 0).toFixed(1)}`);
  }
  if ((progress.statBonuses.cdr ?? 0) > 0) {
    rows.push(`冷却-${Math.round((progress.statBonuses.cdr ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.hp ?? 0) > 0) {
    rows.push(`生命+${Math.round(progress.statBonuses.hp ?? 0)}`);
  }
  if ((progress.statBonuses.shieldPower ?? 0) > 0) {
    rows.push(`护盾强度+${Math.round((progress.statBonuses.shieldPower ?? 0) * 100)}%`);
  }
  if ((progress.statBonuses.atk ?? 0) > 0) {
    rows.push(`攻击+${Math.round(progress.statBonuses.atk ?? 0)}`);
  }
  if (progress.passiveEffects.length > 0) {
    rows.push(`机制效果 x${progress.passiveEffects.length}`);
  }
  return rows.length > 0 ? rows.slice(0, 5) : ["暂无关键增益"];
}

function buildDotSummary(route: string): string {
  if (route === "DOT扩散") {
    return "优先建立多目标覆盖，尽快压低全场血线并创造首杀。";
  }
  if (route === "DOT引爆") {
    return "先叠层再引爆，尽快拿到首杀以降低群体压力。";
  }
  return "优先保障循环稳定与生存，持续兑现DOT价值。";
}

function buildCritSummary(route: string): string {
  if (route === "处决压缩") {
    return "尽早压入斩杀线，依靠处决窗口连续收割。";
  }
  if (route === "暴击收割") {
    return "维持中段暴击频率，在后段快速终结关键目标。";
  }
  return "先稳住中前段输出，再在窗口期打出高额终结。";
}

function buildEngineSummary(route: string): string {
  if (route === "过载导流") {
    return "重点减少溢出，把高资源状态转为护盾与触发收益。";
  }
  if (route === "循环兑现") {
    return "围绕技能消耗与触发链，稳定兑现每轮资源循环。";
  }
  return "先建立稳定回路，再逐步提升资源转化效率。";
}

