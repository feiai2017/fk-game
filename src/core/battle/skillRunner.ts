import type { SkillDef } from "@/core/battle/types";
import { rankReadySkills, type SkillDecisionContext } from "@/core/battle/skillPriority";

export interface SkillSelection {
  index: number;
  score: number;
  reasons: string[];
  readyCount: number;
}

export function selectReadySkillIndex(
  skills: SkillDef[],
  cooldowns: Map<string, number>,
  context: SkillDecisionContext,
): number | undefined {
  const selection = selectReadySkill(skills, cooldowns, context);
  return selection?.index;
}

export function selectReadySkill(
  skills: SkillDef[],
  cooldowns: Map<string, number>,
  context: SkillDecisionContext,
): SkillSelection | undefined {
  const readySkillIndexes: number[] = [];
  for (let index = 0; index < skills.length; index += 1) {
    const skill = skills[index];
    const cooldown = cooldowns.get(skill.id) ?? 0;
    if (cooldown <= 0) {
      readySkillIndexes.push(index);
    }
  }

  if (readySkillIndexes.length === 0) {
    return undefined;
  }

  const readySkills = readySkillIndexes.map((index) => skills[index]);
  const ranked = rankReadySkills(readySkills, context);
  const top = ranked[0];

  return {
    index: readySkillIndexes[top.index],
    score: top.score,
    reasons: top.reasons,
    readyCount: readySkillIndexes.length,
  };
}

export function reduceCooldowns(cooldowns: Map<string, number>, tick: number): void {
  for (const [skillId, cooldown] of cooldowns.entries()) {
    cooldowns.set(skillId, Math.max(0, cooldown - tick));
  }
}

export function reduceAllCooldowns(cooldowns: Map<string, number>, amount: number): void {
  if (amount <= 0) {
    return;
  }
  for (const [skillId, cooldown] of cooldowns.entries()) {
    cooldowns.set(skillId, Math.max(0, cooldown - amount));
  }
}
