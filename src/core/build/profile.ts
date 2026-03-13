import type {
  ArchetypeKey,
  BattleReport,
  BuildComparisonHint,
  BuildProfileSummary,
  Loadout,
  ResourceProfile,
  SkillDef,
  StartupProfile,
  Stats,
  StrengthProfile,
} from "@/core/battle/types";

interface BuildProfileInput {
  archetype: ArchetypeKey;
  finalStats: Stats;
  loadout: Loadout;
  skills: SkillDef[];
  lastReport?: BattleReport;
}

export function estimateBuildProfile(input: BuildProfileInput): BuildProfileSummary {
  if (input.lastReport) {
    return profileFromReport(input.archetype, input.lastReport);
  }

  const startupScore =
    input.finalStats.speed * 26 +
    input.finalStats.cdr * 120 +
    input.finalStats.resourceRegen * 3 -
    averageSkillCost(input.skills) * 0.7;
  const clearScore =
    input.finalStats.atk * 0.14 +
    input.finalStats.dotPower * 85 +
    input.finalStats.procPower * 85 +
    countTaggedSkills(input.skills, "aoe") * 24;
  const singleScore =
    input.finalStats.atk * 0.13 +
    input.finalStats.crit * 160 +
    input.finalStats.critDamage * 95 +
    countTaggedSkills(input.skills, "finisher") * 35;
  const survivalScore =
    input.finalStats.hp * 0.03 +
    input.finalStats.def * 1.15 +
    input.finalStats.resist * 110 +
    input.finalStats.regen * 3.5 +
    input.finalStats.shieldPower * 80;
  const resourceScore =
    (input.finalStats.resourceRegen * 6 + input.finalStats.resourceMax * 0.28) /
    Math.max(1, averageSkillCost(input.skills) * 0.6);
  const mechanicScore = mechanismScore(input.archetype, input.finalStats, input.skills);

  return {
    identity: identityLabel(input.archetype, mechanicScore),
    startupProfile: startupBand(startupScore),
    clearProfile: strengthBand(clearScore, 60, 95),
    singleTargetProfile: strengthBand(singleScore, 62, 100),
    survivalProfile: strengthBand(survivalScore, 75, 120),
    resourceUtilization: resourceBand(resourceScore),
    mechanismContribution: strengthBand(mechanicScore, 52, 88),
    source: "estimated",
    notes: [
      "当前为预估画像，建议结合实战报告修正。",
      "优先观察首杀速度、资源利用率和机制占比变化。",
    ],
  };
}

export function compareBuildProfiles(
  previous: BuildProfileSummary,
  current: BuildProfileSummary,
): BuildComparisonHint[] {
  const hints: BuildComparisonHint[] = [];

  pushHint(hints, compareStartup(previous.startupProfile, current.startupProfile));
  pushHint(hints, compareStrength("clear", "清场效率", previous.clearProfile, current.clearProfile));
  pushHint(
    hints,
    compareStrength("single", "单体收尾", previous.singleTargetProfile, current.singleTargetProfile),
  );
  pushHint(hints, compareStrength("survival", "生存能力", previous.survivalProfile, current.survivalProfile));
  pushHint(
    hints,
    compareResource(previous.resourceUtilization, current.resourceUtilization),
  );
  pushHint(
    hints,
    compareStrength("mechanism", "机制贡献", previous.mechanismContribution, current.mechanismContribution),
  );

  return hints.filter((hint) => hint.direction !== "flat").slice(0, 4);
}

function profileFromReport(archetype: ArchetypeKey, report: BattleReport): BuildProfileSummary {
  const metrics = report.metrics;
  const startupProfile: StartupProfile =
    metrics.startupTime > 8.5 ? "slow" : metrics.startupTime > 4.8 ? "medium" : "fast";
  const clearProfile: StrengthProfile =
    metrics.firstKillTime === null || metrics.firstKillTime > 16
      ? "weak"
      : metrics.firstKillTime > 9
        ? "medium"
        : "strong";
  const singleTargetProfile: StrengthProfile =
    metrics.enemyRemainingHpRatio > 0.35 ? "weak" : metrics.enemyRemainingHpRatio > 0.16 ? "medium" : "strong";
  const survivalProfile: StrengthProfile =
    metrics.remainingHp <= 0 ? "weak" : metrics.remainingHp < 260 ? "medium" : "strong";
  const resourceUtilization: ResourceProfile =
    metrics.resourceOverflowRate > 0.34 || metrics.resourceStarvedRate > 0.3
      ? "poor"
      : metrics.resourceOverflowRate > 0.18 || metrics.resourceStarvedRate > 0.16
        ? "fair"
        : "good";
  const mechanismContribution = mechanismBandByReport(archetype, report);

  return {
    identity: identityLabel(archetype, strengthScore(mechanismContribution)),
    startupProfile,
    clearProfile,
    singleTargetProfile,
    survivalProfile,
    resourceUtilization,
    mechanismContribution,
    source: "lastReport",
    notes: [
      report.win ? "该画像基于最近一次胜利战报。" : "该画像基于最近一次失败战报。",
    ],
  };
}

function mechanismBandByReport(archetype: ArchetypeKey, report: BattleReport): StrengthProfile {
  const metrics = report.metrics;
  if (archetype === "dot") {
    return strengthBand(metrics.dotDamageRatio * 100, 30, 45);
  }
  if (archetype === "engine") {
    return strengthBand((metrics.procDamageRatio + metrics.coreTriggerRatio) * 100, 28, 42);
  }
  return strengthBand(metrics.directDamageRatio * 100, 55, 72);
}

function mechanismScore(archetype: ArchetypeKey, stats: Stats, skills: SkillDef[]): number {
  if (archetype === "dot") {
    return stats.dotPower * 120 + countTaggedSkills(skills, "dot") * 18 + countBurstDot(skills) * 16;
  }
  if (archetype === "engine") {
    return stats.procPower * 115 + countTaggedSkills(skills, "proc") * 18 + stats.resourceRegen * 2.5;
  }
  return stats.crit * 130 + stats.critDamage * 105 + countTaggedSkills(skills, "finisher") * 16;
}

function identityLabel(archetype: ArchetypeKey, mechanismScoreValue: number): string {
  if (mechanismScoreValue >= 88) {
    return archetype === "dot"
      ? "高DOT压制构筑"
      : archetype === "crit"
        ? "高暴击收割构筑"
        : "高强度引擎循环构筑";
  }
  if (mechanismScoreValue >= 52) {
    return archetype === "dot"
      ? "均衡DOT构筑"
      : archetype === "crit"
        ? "均衡暴击构筑"
        : "均衡引擎构筑";
  }
  return archetype === "dot" ? "偏直伤DOT构筑" : archetype === "crit" ? "暴击链不足构筑" : "触发链待成型构筑";
}

function startupBand(score: number): StartupProfile {
  if (score < 48) {
    return "slow";
  }
  if (score < 82) {
    return "medium";
  }
  return "fast";
}

function resourceBand(score: number): ResourceProfile {
  if (score < 1.2) {
    return "poor";
  }
  if (score < 1.9) {
    return "fair";
  }
  return "good";
}

function strengthBand(score: number, mid: number, high: number): StrengthProfile {
  if (score < mid) {
    return "weak";
  }
  if (score < high) {
    return "medium";
  }
  return "strong";
}

function averageSkillCost(skills: SkillDef[]): number {
  if (skills.length === 0) {
    return 0;
  }
  return skills.reduce((sum, skill) => sum + skill.cost, 0) / skills.length;
}

function countTaggedSkills(skills: SkillDef[], tag: string): number {
  return skills.filter((skill) => skill.tags.includes(tag)).length;
}

function countBurstDot(skills: SkillDef[]): number {
  return skills.filter((skill) => (skill.burstDotPercent ?? 0) > 0).length;
}

function compareStartup(from: StartupProfile, to: StartupProfile): BuildComparisonHint {
  const values: StartupProfile[] = ["slow", "medium", "fast"];
  const fromIndex = values.indexOf(from);
  const toIndex = values.indexOf(to);
  return {
    aspect: "startup",
    from,
    to,
    direction: direction(fromIndex, toIndex),
    message: `预计启动节奏：${startupLabel(from)} -> ${startupLabel(to)}`,
  };
}

function compareStrength(
  aspect: BuildComparisonHint["aspect"],
  label: string,
  from: StrengthProfile,
  to: StrengthProfile,
): BuildComparisonHint {
  const values: StrengthProfile[] = ["weak", "medium", "strong"];
  const fromIndex = values.indexOf(from);
  const toIndex = values.indexOf(to);
  return {
    aspect,
    from,
    to,
    direction: direction(fromIndex, toIndex),
    message: `预计${label}：${strengthLabel(from)} -> ${strengthLabel(to)}`,
  };
}

function compareResource(from: ResourceProfile, to: ResourceProfile): BuildComparisonHint {
  const values: ResourceProfile[] = ["poor", "fair", "good"];
  const fromIndex = values.indexOf(from);
  const toIndex = values.indexOf(to);
  return {
    aspect: "resource",
    from,
    to,
    direction: direction(fromIndex, toIndex),
    message: `预计资源利用：${resourceLabel(from)} -> ${resourceLabel(to)}`,
  };
}

function direction(from: number, to: number): "better" | "worse" | "flat" {
  if (to > from) {
    return "better";
  }
  if (to < from) {
    return "worse";
  }
  return "flat";
}

function startupLabel(value: StartupProfile): string {
  if (value === "slow") {
    return "偏慢";
  }
  if (value === "medium") {
    return "中等";
  }
  return "偏快";
}

function strengthLabel(value: StrengthProfile): string {
  if (value === "weak") {
    return "偏弱";
  }
  if (value === "medium") {
    return "中等";
  }
  return "较强";
}

function resourceLabel(value: ResourceProfile): string {
  if (value === "poor") {
    return "较差";
  }
  if (value === "fair") {
    return "一般";
  }
  return "良好";
}

function strengthScore(value: StrengthProfile): number {
  if (value === "weak") {
    return 40;
  }
  if (value === "medium") {
    return 68;
  }
  return 92;
}

function pushHint(target: BuildComparisonHint[], next: BuildComparisonHint): void {
  target.push(next);
}
