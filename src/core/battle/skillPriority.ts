import type { ArchetypeKey, SkillDef } from "@/core/battle/types";

export const PRIORITY_THRESHOLDS = {
  targetLowHp: 0.35,
  playerLowHp: 0.45,
  unstableResourceStarvedRate: 0.2,
  unstableResourceOverflowRate: 0.2,
  earlyWindowSeconds: 8,
};

export interface SkillDecisionContext {
  archetype: ArchetypeKey;
  elapsedTime: number;
  resource: number;
  resourceMax: number;
  playerHpRatio: number;
  targetHpRatio: number;
  targetDotStacks: number;
  enemyCount: number;
  resourceStarvedRate: number;
  resourceOverflowRate: number;
}

export interface SkillPriorityResult {
  score: number;
  reasons: string[];
}

export interface RankedSkill {
  index: number;
  score: number;
  reasons: string[];
}

export function evaluateSkillPriority(
  skill: SkillDef,
  context: SkillDecisionContext,
): SkillPriorityResult {
  let score = 0;
  const reasons: string[] = [];
  const canAfford = context.resource >= skill.cost;
  const isSpender = skill.tags.includes("spender") || skill.cost >= context.resourceMax * 0.45;
  const isDefensive = (skill.shieldRatio ?? 0) > 0 || (skill.healRatio ?? 0) > 0;
  const isEarly = context.elapsedTime <= PRIORITY_THRESHOLDS.earlyWindowSeconds;
  const unstableResource =
    context.resourceStarvedRate >= PRIORITY_THRESHOLDS.unstableResourceStarvedRate ||
    context.resourceOverflowRate >= PRIORITY_THRESHOLDS.unstableResourceOverflowRate;

  if (!canAfford) {
    score -= 1000 + (skill.cost - context.resource) * 2;
    reasons.push("资源不足");
  }

  if (skill.tags.includes("finisher") && context.targetHpRatio <= PRIORITY_THRESHOLDS.targetLowHp) {
    score += 120;
    reasons.push("斩杀窗口");
  }

  if ((skill.burstDotPercent ?? 0) > 0 && context.targetDotStacks >= 2) {
    score += 96 + Math.min(30, context.targetDotStacks * 6);
    reasons.push("DOT层数可引爆");
  }

  if (isDefensive && context.playerHpRatio <= PRIORITY_THRESHOLDS.playerLowHp) {
    score += 105;
    reasons.push("低血保命");
  }

  if (isSpender && !canAfford) {
    score -= 140;
    reasons.push("高费技能延后");
  } else if (isSpender && unstableResource) {
    score -= 32;
    reasons.push("资源不稳定");
  }

  if (skill.tags.includes("cycle") && context.resource <= context.resourceMax * 0.38) {
    score += 42;
    reasons.push("回能循环");
  }

  if (isEarly) {
    const setupBonus = setupPriorityBonus(skill, context.archetype);
    if (setupBonus > 0) {
      score += setupBonus;
      reasons.push("开局铺垫");
    }
  }

  if (skill.tags.includes("aoe") && context.enemyCount > 1) {
    score += 12;
    reasons.push("多目标收益");
  }

  if (context.enemyCount === 1 && skill.tags.includes("single")) {
    score += 8;
  }

  return { score, reasons };
}

export function rankReadySkills(skills: SkillDef[], context: SkillDecisionContext): RankedSkill[] {
  const ranked = skills.map((skill, index) => {
    const result = evaluateSkillPriority(skill, context);
    return {
      index,
      score: result.score,
      reasons: result.reasons,
    };
  });
  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  });
  return ranked;
}

function setupPriorityBonus(skill: SkillDef, archetype: ArchetypeKey): number {
  switch (archetype) {
    case "dot":
      if (skill.tags.includes("starter") || (skill.dot && !skill.burstDotPercent)) {
        return 44;
      }
      return 0;
    case "engine":
      if (skill.tags.includes("cycle") || (skill.shieldRatio ?? 0) > 0) {
        return 36;
      }
      return 0;
    case "crit":
      if (skill.tags.includes("burst") && !skill.tags.includes("finisher")) {
        return 24;
      }
      return 0;
    default:
      return 0;
  }
}

