import type {
  ArchetypeKey,
  BattleReport,
  DiagnosisEntry,
  FloorGuidance,
  ItemDef,
  Loadout,
  TuningBottleneckTag,
} from "@/core/battle/types";

export interface ItemRecommendation {
  tags: string[];
  recommendedToTry: boolean;
  helpsLastIssue: boolean;
  priorityLabel: "优先尝试" | "可尝试" | "暂非优先";
  score: number;
}

interface BuildItemRecommendationInput {
  item: ItemDef;
  archetype: ArchetypeKey;
  loadout: Loadout;
  lastReport?: BattleReport;
  floorGuidance?: FloorGuidance;
  reportCandidateItemIds?: string[];
}

type RecommendationDimension =
  | "startup"
  | "clear"
  | "single"
  | "survival"
  | "resource"
  | "mechanic";

const DIMENSION_TAG: Record<RecommendationDimension, string> = {
  startup: "改善首杀",
  clear: "改善清场",
  single: "改善单体",
  survival: "改善生存",
  resource: "改善资源兑现",
  mechanic: "强化机制兑现",
};

export function recommendItemForBuild(input: BuildItemRecommendationInput): ItemRecommendation {
  const dimensions = inferItemDimensions(input.item, input.archetype);
  const tags = new Set<string>();
  let score = 0;

  for (const dimension of dimensions) {
    tags.add(DIMENSION_TAG[dimension]);
    score += 1.4;
  }

  if (dimensions.includes("mechanic")) {
    if (input.archetype === "dot") {
      tags.add("强化DOT引爆");
      score += 1.2;
    } else if (input.archetype === "crit") {
      tags.add("强化暴击收尾");
      score += 1.2;
    } else {
      tags.add("强化引擎兑现");
      score += 1.2;
    }
  }

  const issueCodes = input.lastReport?.diagnosis.map((entry) => entry.code) ?? [];
  const helpsLastIssue = issueCodes.some((code) => canAddressIssue(code, dimensions));
  if (helpsLastIssue) {
    tags.add("对症");
    score += 2.4;
  }

  if (input.floorGuidance && fitsFloor(input.floorGuidance.bottleneckTags, dimensions)) {
    tags.add("适合当前层");
    score += 2.2;
  }

  const topPriorityId = input.lastReport?.guidance?.priorityAdjustment.topPriorityCandidateItemId;
  if (topPriorityId && topPriorityId === input.item.id) {
    tags.add("优先尝试");
    score += 3.2;
  } else if (input.reportCandidateItemIds?.includes(input.item.id)) {
    score += 1.6;
  }

  if (input.item.archetypeBias === input.archetype) {
    score += 1.4;
  }
  if (isEquippedTemplate(input.item, input.loadout)) {
    score -= 1.1;
  }

  const priorityLabel = resolvePriorityLabel(score);
  const recommendedToTry = priorityLabel === "优先尝试";

  return {
    tags: pickTopTags(tags),
    recommendedToTry,
    helpsLastIssue,
    priorityLabel,
    score,
  };
}

function inferItemDimensions(item: ItemDef, archetype: ArchetypeKey): RecommendationDimension[] {
  const dimensions = new Set<RecommendationDimension>();
  const effects = item.mechanicEffects ?? [];

  if ((item.stats.speed ?? 0) > 0 || (item.stats.cdr ?? 0) > 0 || (item.stats.resourceRegen ?? 0) > 2) {
    dimensions.add("startup");
  }
  if (
    (item.stats.dotPower ?? 0) > 0.1 ||
    (item.stats.procPower ?? 0) > 0.12 ||
    effects.some((effect) => effect.id === "DOT_FULLSTACK_ECHO")
  ) {
    dimensions.add("clear");
    dimensions.add("mechanic");
  }
  if (
    (item.stats.atk ?? 0) > 22 ||
    (item.stats.crit ?? 0) > 0.1 ||
    (item.stats.critDamage ?? 0) > 0.2 ||
    effects.some((effect) => effect.id === "CRIT_FINISHER_REFUND" || effect.id === "CRIT_FINISHER_VALUE")
  ) {
    dimensions.add("single");
  }
  if (
    (item.stats.hp ?? 0) >= 160 ||
    (item.stats.def ?? 0) >= 24 ||
    (item.stats.shieldPower ?? 0) > 0 ||
    (item.stats.resist ?? 0) > 0
  ) {
    dimensions.add("survival");
  }
  if (
    (item.stats.resourceMax ?? 0) > 0 ||
    (item.stats.resourceRegen ?? 0) > 0 ||
    effects.some(
      (effect) =>
        effect.id === "ENGINE_HIGH_RESOURCE_CHAIN" ||
        effect.id === "LOW_RESOURCE_CYCLE_SURGE" ||
        effect.id === "SPEND_EMPOWER_NEXT_PROC",
    )
  ) {
    dimensions.add("resource");
  }

  if (archetype === "dot" && ((item.stats.dotPower ?? 0) > 0 || effects.some((effect) => effect.id.includes("DOT")))) {
    dimensions.add("mechanic");
  }
  if (
    archetype === "crit" &&
    ((item.stats.crit ?? 0) > 0 || effects.some((effect) => effect.id.includes("CRIT_FINISHER")))
  ) {
    dimensions.add("mechanic");
  }
  if (
    archetype === "engine" &&
    ((item.stats.procPower ?? 0) > 0 || effects.some((effect) => effect.id.includes("ENGINE") || effect.id.includes("PROC")))
  ) {
    dimensions.add("mechanic");
  }

  return [...dimensions];
}

function fitsFloor(floorTags: TuningBottleneckTag[], dimensions: RecommendationDimension[]): boolean {
  const tagToDimension: Partial<Record<TuningBottleneckTag, RecommendationDimension>> = {
    startup: "startup",
    clear: "clear",
    single: "single",
    survival: "survival",
    resource: "resource",
    mechanic: "mechanic",
    throughput: "single",
  };
  return floorTags.some((tag) => {
    const mapped = tagToDimension[tag];
    return mapped ? dimensions.includes(mapped) : false;
  });
}

function canAddressIssue(code: DiagnosisEntry["code"], dimensions: RecommendationDimension[]): boolean {
  switch (code) {
    case "SLOW_STARTUP":
      return dimensions.includes("startup");
    case "LOW_CLEAR_EFFICIENCY":
      return dimensions.includes("clear");
    case "LOW_SINGLE_TARGET_FINISH":
      return dimensions.includes("single");
    case "LOW_SURVIVAL":
      return dimensions.includes("survival");
    case "RESOURCE_WASTE":
    case "RESOURCE_STARVED":
    case "RESOURCE_OVERFLOW":
      return dimensions.includes("resource");
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return dimensions.includes("mechanic");
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return dimensions.includes("single") || dimensions.includes("clear");
  }
}

function resolvePriorityLabel(score: number): ItemRecommendation["priorityLabel"] {
  if (score >= 7) {
    return "优先尝试";
  }
  if (score >= 4.2) {
    return "可尝试";
  }
  return "暂非优先";
}

function pickTopTags(tags: Set<string>): string[] {
  const ordered = [...tags];
  const priorityOrder = [
    "优先尝试",
    "适合当前层",
    "对症",
    "改善首杀",
    "改善清场",
    "改善单体",
    "改善生存",
    "改善资源兑现",
    "强化DOT引爆",
    "强化暴击收尾",
    "强化引擎兑现",
  ];
  ordered.sort((left, right) => priorityOrder.indexOf(left) - priorityOrder.indexOf(right));
  return ordered.slice(0, 3);
}

function isEquippedTemplate(item: ItemDef, loadout: Loadout): boolean {
  return [loadout.weapon, loadout.helm, loadout.armor, loadout.ring1, loadout.ring2, loadout.core]
    .filter(Boolean)
    .some((entry) => entry?.id === item.id);
}
