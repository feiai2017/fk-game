import type {
  ArchetypeKey,
  BattleMetrics,
  DiagnosisEntry,
  FloorBuildGoal,
  FloorDef,
  FloorGuidance,
  Loadout,
  PriorityAdjustment,
  ReportGuidance,
  TuningBottleneckTag,
} from "@/core/battle/types";
import { buildFloorGuidance } from "@/core/tower/floorGuidance";

interface ReportGuidanceInput {
  floor: FloorDef;
  archetype: ArchetypeKey;
  metrics: BattleMetrics;
  diagnosis: DiagnosisEntry[];
  loadout: Loadout;
}

interface PreviewGuidanceInput {
  floor: FloorDef;
  archetype: ArchetypeKey;
  loadout: Loadout;
  metrics?: BattleMetrics;
  diagnosis?: DiagnosisEntry[];
}

const ISSUE_TARGETS: Record<DiagnosisEntry["code"], string[]> = {
  LOW_RAW_DAMAGE: ["weapon", "ring2", "core"],
  LOW_DAMAGE: ["weapon", "ring2", "core"],
  SLOW_STARTUP: ["weapon", "skill槽位1", "ring2"],
  LOW_CLEAR_EFFICIENCY: ["skill槽位2", "ring1", "core"],
  LOW_SINGLE_TARGET_FINISH: ["skill槽位3", "weapon", "core"],
  RESOURCE_WASTE: ["core", "skill槽位3", "ring1"],
  LOW_MECHANIC_CONTRIBUTION: ["core", "ring1", "skill槽位2"],
  RESOURCE_STARVED: ["ring2", "skill槽位1", "core"],
  RESOURCE_OVERFLOW: ["core", "ring1", "skill槽位3"],
  LOW_SURVIVAL: ["armor", "helm", "core"],
  LOW_DOT_RATIO: ["core", "ring2", "skill槽位2"],
  LOW_PROC_RATIO: ["core", "ring1", "skill槽位2"],
};

const BASE_ISSUE_PRIORITY: Record<DiagnosisEntry["code"], number> = {
  LOW_SURVIVAL: 95,
  LOW_SINGLE_TARGET_FINISH: 89,
  LOW_CLEAR_EFFICIENCY: 86,
  SLOW_STARTUP: 84,
  LOW_RAW_DAMAGE: 82,
  LOW_DAMAGE: 80,
  RESOURCE_WASTE: 78,
  LOW_MECHANIC_CONTRIBUTION: 76,
  LOW_DOT_RATIO: 75,
  LOW_PROC_RATIO: 75,
  RESOURCE_STARVED: 73,
  RESOURCE_OVERFLOW: 70,
};

export function buildReportGuidance(input: ReportGuidanceInput): ReportGuidance {
  const floorObjective = buildFloorGuidance(input.floor);
  const floorBuildGoal = buildFloorBuildGoal({
    floorObjective,
    archetype: input.archetype,
    metrics: input.metrics,
    diagnosis: input.diagnosis,
  });
  const priorityAdjustment = rankPriorityAdjustment({
    floorObjective,
    archetype: input.archetype,
    diagnosis: input.diagnosis,
    metrics: input.metrics,
    loadout: input.loadout,
  });
  const actionSuggestions = buildActionSuggestions({
    diagnosis: input.diagnosis,
    archetype: input.archetype,
    floorObjective,
    priorityAdjustment,
  });
  const candidateItemIds = collectCandidateItems(input.diagnosis, input.archetype, input.loadout);
  const primaryIssue: ReportGuidance["primaryIssue"] =
    input.diagnosis.length > 0 ? input.diagnosis[0].code : "NONE";
  const secondaryIssue = input.diagnosis.length > 1 ? input.diagnosis[1].code : undefined;

  return {
    primaryIssue,
    secondaryIssue,
    actionSuggestions,
    recommendedTargets: buildRecommendedTargets(input.diagnosis, priorityAdjustment.topPriorityTarget),
    candidateItemIds,
    floorObjective,
    floorBuildGoal,
    priorityAdjustment,
  };
}

export function buildFloorPreviewGuidance(input: PreviewGuidanceInput): ReportGuidance {
  const diagnosis = input.diagnosis ?? [];
  const floorObjective = buildFloorGuidance(input.floor);
  const floorBuildGoal = buildFloorBuildGoal({
    floorObjective,
    archetype: input.archetype,
    metrics: input.metrics,
    diagnosis,
  });
  const priorityAdjustment = rankPriorityAdjustment({
    floorObjective,
    archetype: input.archetype,
    diagnosis,
    metrics: input.metrics,
    loadout: input.loadout,
  });
  const actionSuggestions = buildActionSuggestions({
    diagnosis,
    archetype: input.archetype,
    floorObjective,
    priorityAdjustment,
  });

  return {
    primaryIssue: diagnosis.length > 0 ? diagnosis[0].code : "NONE",
    secondaryIssue: diagnosis.length > 1 ? diagnosis[1].code : undefined,
    actionSuggestions,
    recommendedTargets: buildRecommendedTargets(diagnosis, priorityAdjustment.topPriorityTarget),
    candidateItemIds: priorityAdjustment.topPriorityCandidateItemId
      ? [priorityAdjustment.topPriorityCandidateItemId]
      : [],
    floorObjective,
    floorBuildGoal,
    priorityAdjustment,
  };
}

interface BuildGoalInput {
  floorObjective: FloorGuidance;
  archetype: ArchetypeKey;
  metrics?: BattleMetrics;
  diagnosis: DiagnosisEntry[];
}

export function buildFloorBuildGoal(input: BuildGoalInput): FloorBuildGoal {
  const topTag = input.floorObjective.bottleneckTags[0];
  const floorBuildGoal = describeFloorBuildGoal(input.archetype, topTag, input.metrics);
  const focusMetrics = [...input.floorObjective.recommendedMetricFocus];
  if (input.metrics) {
    if (input.metrics.firstKillTime === null || input.metrics.firstKillTime > 12) {
      focusMetrics.unshift("首杀时间");
    }
    if (input.metrics.enemyRemainingHpRatio > 0.3) {
      focusMetrics.unshift("敌方剩余血量比");
    }
    if (input.metrics.resourceOverflowRate > 0.35 || input.metrics.resourceStarvedRate > 0.3) {
      focusMetrics.unshift("资源利用率");
    }
  }

  return {
    floorBuildGoal,
    focusMetrics: uniqueStrings(focusMetrics).slice(0, 4),
    deprioritizedDirections: deprioritizedDirections(input.floorObjective, input.archetype, input.diagnosis),
  };
}

interface RankPriorityInput {
  floorObjective: FloorGuidance;
  archetype: ArchetypeKey;
  diagnosis: DiagnosisEntry[];
  metrics?: BattleMetrics;
  loadout: Loadout;
}

export function rankPriorityAdjustment(input: RankPriorityInput): PriorityAdjustment {
  const rankedIssues = rankIssuesForFloor(input.diagnosis, input.floorObjective);
  const topIssue = rankedIssues[0];
  const secondIssue = rankedIssues[1];

  if (!topIssue) {
    const fallbackIssue = fallbackIssueByFloor(input.floorObjective, input.archetype);
    const fallbackTarget = (ISSUE_TARGETS[fallbackIssue][0] ?? "core");
    const fallbackCandidate = firstUnequippedCandidate(
      mapIssueToCandidates(fallbackIssue, input.archetype),
      input.loadout,
    );
    return {
      topPriorityAdjustment: mapIssueToAdjustment(fallbackIssue, input.archetype),
      secondaryAdjustment: undefined,
      topPriorityTarget: fallbackTarget,
      topPriorityCandidateItemId: fallbackCandidate,
      reasoning: `当前层重点是${input.floorObjective.primaryObjective}，先从${fallbackTarget}补足最短板。`,
    };
  }

  const topTarget = pickTopTarget(topIssue.code, input.floorObjective.bottleneckTags);
  const topCandidate = firstUnequippedCandidate(
    mapIssueToCandidates(topIssue.code, input.archetype),
    input.loadout,
  );

  return {
    topPriorityAdjustment: mapIssueToAdjustment(topIssue.code, input.archetype),
    secondaryAdjustment: secondIssue ? mapIssueToAdjustment(secondIssue.code, input.archetype) : undefined,
    topPriorityTarget: topTarget,
    topPriorityCandidateItemId: topCandidate,
    reasoning: buildReasoningLine({
      floorObjective: input.floorObjective,
      issueCode: topIssue.code,
      metrics: input.metrics,
      target: topTarget,
    }),
  };
}

function rankIssuesForFloor(diagnosis: DiagnosisEntry[], floorObjective: FloorGuidance): DiagnosisEntry[] {
  return [...diagnosis].sort((left, right) => {
    const leftScore = issuePriorityScore(left.code, floorObjective.bottleneckTags);
    const rightScore = issuePriorityScore(right.code, floorObjective.bottleneckTags);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return BASE_ISSUE_PRIORITY[right.code] - BASE_ISSUE_PRIORITY[left.code];
  });
}

function issuePriorityScore(code: DiagnosisEntry["code"], floorTags: TuningBottleneckTag[]): number {
  const base = BASE_ISSUE_PRIORITY[code] ?? 60;
  const tag = issueToTag(code);
  const tagBonus = floorTags.includes(tag) ? 8 : 0;
  const antiMechanicBonus = code === "LOW_MECHANIC_CONTRIBUTION" && floorTags.includes("mechanic") ? 6 : 0;
  return base + tagBonus + antiMechanicBonus;
}

function issueToTag(code: DiagnosisEntry["code"]): TuningBottleneckTag {
  switch (code) {
    case "SLOW_STARTUP":
      return "startup";
    case "LOW_CLEAR_EFFICIENCY":
      return "clear";
    case "LOW_SINGLE_TARGET_FINISH":
      return "single";
    case "LOW_SURVIVAL":
      return "survival";
    case "RESOURCE_WASTE":
    case "RESOURCE_STARVED":
    case "RESOURCE_OVERFLOW":
      return "resource";
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return "mechanic";
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return "throughput";
  }
}

function fallbackIssueByFloor(
  floorObjective: FloorGuidance,
  archetype: ArchetypeKey,
): DiagnosisEntry["code"] {
  const tag = floorObjective.bottleneckTags[0];
  if (tag === "startup") {
    return "SLOW_STARTUP";
  }
  if (tag === "clear") {
    return "LOW_CLEAR_EFFICIENCY";
  }
  if (tag === "single") {
    return "LOW_SINGLE_TARGET_FINISH";
  }
  if (tag === "survival") {
    return "LOW_SURVIVAL";
  }
  if (tag === "resource") {
    return "RESOURCE_WASTE";
  }
  if (tag === "mechanic") {
    return archetype === "dot" ? "LOW_DOT_RATIO" : archetype === "engine" ? "LOW_PROC_RATIO" : "LOW_MECHANIC_CONTRIBUTION";
  }
  return "LOW_RAW_DAMAGE";
}

function pickTopTarget(code: DiagnosisEntry["code"], floorTags: TuningBottleneckTag[]): string {
  const targets = ISSUE_TARGETS[code] ?? ["core"];
  if (floorTags.includes("survival")) {
    const survivability = targets.find((target) => target === "armor" || target === "helm");
    if (survivability) {
      return survivability;
    }
  }
  if (floorTags.includes("single") || floorTags.includes("throughput")) {
    const offense = targets.find((target) => target === "weapon" || target === "skill槽位3");
    if (offense) {
      return offense;
    }
  }
  return targets[0] ?? "core";
}

function mapIssueToAdjustment(code: DiagnosisEntry["code"], archetype: ArchetypeKey): string {
  switch (code) {
    case "SLOW_STARTUP":
      return "优先压缩起手节奏，确保首轮核心技能更早释放。";
    case "LOW_CLEAR_EFFICIENCY":
      return "优先补清场效率，让首杀后尽快进入滚雪球节奏。";
    case "LOW_SINGLE_TARGET_FINISH":
      return "优先加强单体收尾，把关键伤害留在低血窗口。";
    case "LOW_SURVIVAL":
      return "优先补生存，让输出循环至少稳定跑完一轮。";
    case "RESOURCE_WASTE":
      return "优先改善资源兑现，减少高资源空转。";
    case "RESOURCE_STARVED":
      return "优先补回能/返还能量，避免技能长时间空转。";
    case "LOW_MECHANIC_CONTRIBUTION":
      return archetype === "dot"
        ? "优先强化DOT覆盖与引爆联动。"
        : archetype === "crit"
          ? "优先强化暴击与终结的协同价值。"
          : "优先强化资源到触发伤害的转换链。";
    case "LOW_DOT_RATIO":
      return "优先提高DOT占比，减少纯直伤占比过高的问题。";
    case "LOW_PROC_RATIO":
      return "优先提高触发占比，保证引擎构筑的核心兑现。";
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return "优先提高单位时间有效伤害，先补最短板输出位。";
  }
}

function buildActionSuggestions(input: {
  diagnosis: DiagnosisEntry[];
  archetype: ArchetypeKey;
  floorObjective: FloorGuidance;
  priorityAdjustment: PriorityAdjustment;
}): string[] {
  const suggestions = new Set<string>();
  suggestions.add(input.priorityAdjustment.topPriorityAdjustment);

  for (const entry of input.diagnosis) {
    suggestions.add(mapIssueToAdjustment(entry.code, input.archetype));
  }
  suggestions.add(`本层优先关注：${input.floorObjective.primaryObjective}。`);
  if (input.floorObjective.bottleneckTags.includes("resource")) {
    suggestions.add("资源相关调整优先于纯面板堆叠。");
  }
  if (input.floorObjective.bottleneckTags.includes("single")) {
    suggestions.add("将终结技能留给低血窗口，避免提前空放。");
  }

  return [...suggestions].slice(0, 4);
}

function buildRecommendedTargets(diagnosis: DiagnosisEntry[], topPriorityTarget: string): string[] {
  const targets = new Set<string>();
  targets.add(topPriorityTarget);
  for (const entry of diagnosis) {
    for (const target of ISSUE_TARGETS[entry.code] ?? []) {
      targets.add(target);
    }
  }
  return [...targets].slice(0, 3);
}

function collectCandidateItems(
  diagnosis: DiagnosisEntry[],
  archetype: ArchetypeKey,
  loadout: Loadout,
): string[] {
  const candidates = new Set<string>();
  for (const entry of diagnosis) {
    for (const itemId of mapIssueToCandidates(entry.code, archetype)) {
      candidates.add(itemId);
    }
  }
  return [...candidates].filter((itemId) => !isEquipped(itemId, loadout)).slice(0, 4);
}

function describeFloorBuildGoal(
  archetype: ArchetypeKey,
  topTag: TuningBottleneckTag,
  metrics?: BattleMetrics,
): string {
  const archetypeGoal =
    archetype === "dot"
      ? "DOT流应优先更早叠层并在窗口期引爆。"
      : archetype === "crit"
        ? "暴击流应先保证中段直伤，再依赖终结收割。"
        : "引擎流应优先提升资源到伤害的兑现效率。";

  const tagGoal =
    topTag === "startup"
      ? "本层先解决起手速度。"
      : topTag === "clear"
        ? "本层先解决清场效率。"
        : topTag === "single"
          ? "本层先解决单体收尾。"
          : topTag === "survival"
            ? "本层先保证生存稳定。"
            : topTag === "resource"
              ? "本层先修复资源稳定与兑现。"
              : topTag === "mechanic"
                ? "本层先提升机制贡献占比。"
                : "本层先补单位时间伤害。";

  if (!metrics) {
    return `${tagGoal}${archetypeGoal}`;
  }
  if (metrics.firstKillTime === null || metrics.firstKillTime > 14) {
    return `${tagGoal}${archetypeGoal} 你的首杀偏慢，应先让前10秒输出更有效。`;
  }
  if (metrics.enemyRemainingHpRatio > 0.35) {
    return `${tagGoal}${archetypeGoal} 当前后段压血不足，应优先补收尾强度。`;
  }
  return `${tagGoal}${archetypeGoal}`;
}

function deprioritizedDirections(
  floorObjective: FloorGuidance,
  archetype: ArchetypeKey,
  diagnosis: DiagnosisEntry[],
): string[] {
  const directions = new Set<string>();
  if (floorObjective.bottleneckTags.includes("survival")) {
    directions.add("暂不优先继续堆纯爆发面板。");
  }
  if (floorObjective.bottleneckTags.includes("single")) {
    directions.add("暂不优先追求泛AOE，先补单体收尾。");
  }
  if (floorObjective.bottleneckTags.includes("resource")) {
    directions.add("暂不优先提高资源获取上限，先提高资源兑现。");
  }
  if (archetype === "dot" && diagnosis.some((entry) => entry.code === "LOW_DOT_RATIO")) {
    directions.add("暂不优先堆直伤，先保证DOT与引爆联动。");
  }
  if (archetype === "engine" && diagnosis.some((entry) => entry.code === "RESOURCE_WASTE")) {
    directions.add("暂不优先加回能，先补高费消耗或溢出转收益。");
  }

  if (directions.size === 0) {
    directions.add("不建议同时改太多部位，优先验证一处关键调整。");
  }
  return [...directions].slice(0, 3);
}

function buildReasoningLine(input: {
  floorObjective: FloorGuidance;
  issueCode: DiagnosisEntry["code"];
  metrics?: BattleMetrics;
  target: string;
}): string {
  const metricHint = metricHintByIssue(input.issueCode, input.metrics);
  return `当前层主要考验${input.floorObjective.primaryObjective}，你在${metricHint}上落后，先从${input.target}调整最有效。`;
}

function metricHintByIssue(code: DiagnosisEntry["code"], metrics?: BattleMetrics): string {
  if (!metrics) {
    return "关键指标";
  }
  switch (code) {
    case "SLOW_STARTUP":
      return `启动时间(${metrics.startupTime.toFixed(1)}秒)`;
    case "LOW_CLEAR_EFFICIENCY":
      return `首杀时间(${metrics.firstKillTime === null ? "无" : `${metrics.firstKillTime.toFixed(1)}秒`})`;
    case "LOW_SINGLE_TARGET_FINISH":
    case "LOW_RAW_DAMAGE":
    case "LOW_DAMAGE":
      return `敌方剩余血量比(${(metrics.enemyRemainingHpRatio * 100).toFixed(1)}%)`;
    case "RESOURCE_WASTE":
    case "RESOURCE_OVERFLOW":
      return `资源溢出率(${(metrics.resourceOverflowRate * 100).toFixed(1)}%)`;
    case "RESOURCE_STARVED":
      return `资源匮乏率(${(metrics.resourceStarvedRate * 100).toFixed(1)}%)`;
    case "LOW_SURVIVAL":
      return `剩余生命(${metrics.remainingHp.toFixed(0)})`;
    default:
      return "机制贡献";
  }
}

function mapIssueToCandidates(code: DiagnosisEntry["code"], archetype: ArchetypeKey): string[] {
  switch (code) {
    case "SLOW_STARTUP":
      return archetype === "engine" ? ["core_feedback_prism", "w_threshold_accumulator"] : ["r_venom_timer"];
    case "LOW_CLEAR_EFFICIENCY":
      return archetype === "dot" ? ["r_plague_resonator", "core_spore_hive"] : ["r_engine_loop"];
    case "LOW_SINGLE_TARGET_FINISH":
      return archetype === "crit" ? ["r_mercy_trigger", "w_execution_scope"] : ["core_assassin_relay"];
    case "LOW_RAW_DAMAGE":
    case "LOW_DAMAGE":
      return archetype === "dot"
        ? ["w_serrated_reaper", "r_rupture_sigil"]
        : archetype === "crit"
          ? ["w_predator_rifle", "r_guillotine_coil"]
          : ["w_reactor_lance", "core_singularity_drive"];
    case "RESOURCE_WASTE":
    case "RESOURCE_OVERFLOW":
      return ["core_feedback_prism", "core_overflow_matrix", "w_threshold_accumulator"];
    case "RESOURCE_STARVED":
      return ["r_rupture_sigil", "core_singularity_drive", "r_engine_loop"];
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return archetype === "dot"
        ? ["core_spore_hive", "r_plague_resonator"]
        : archetype === "crit"
          ? ["r_mercy_trigger", "core_assassin_relay"]
          : ["core_feedback_prism", "w_threshold_accumulator"];
    case "LOW_SURVIVAL":
      return ["a_reactive_shell", "core_overflow_matrix", "h_flux_reservoir"];
    default:
      return [];
  }
}

function firstUnequippedCandidate(candidates: string[], loadout: Loadout): string | undefined {
  return candidates.find((itemId) => !isEquipped(itemId, loadout));
}

function isEquipped(itemId: string, loadout: Loadout): boolean {
  return [loadout.weapon, loadout.helm, loadout.armor, loadout.ring1, loadout.ring2, loadout.core]
    .filter(Boolean)
    .some((item) => item?.id === itemId);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
