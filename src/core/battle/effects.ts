import type { DotInstance, EnemyState, SkillDef } from "@/core/battle/types";

interface ApplyDotInput {
  enemy: EnemyState;
  skill: SkillDef;
  now: number;
  damagePerTick: number;
  extraStacks: number;
}

export function applyDotToEnemy(input: ApplyDotInput): void {
  const { enemy, skill, now, damagePerTick, extraStacks } = input;
  if (!skill.dot) {
    return;
  }
  const dotId = `${skill.id}:${skill.dot.name}`;
  const maxStacks = skill.dot.maxStacks + extraStacks;

  const existing = enemy.dots.find((dot) => dot.id === dotId);
  if (!existing) {
    enemy.dots.push({
      id: dotId,
      name: skill.dot.name,
      sourceId: skill.id,
      sourceName: skill.name,
      remaining: skill.dot.duration,
      nextTickAt: now + 1,
      tickInterval: 1,
      damagePerTick,
      stacks: 1,
    });
    return;
  }

  existing.remaining = skill.dot.duration;
  existing.damagePerTick = damagePerTick;
  existing.stacks = Math.min(maxStacks, existing.stacks + 1);
}

export function tickDots(
  enemy: EnemyState,
  now: number,
  onDotDamage: (dot: DotInstance, totalDamage: number) => void,
): void {
  for (const dot of enemy.dots) {
    while (dot.remaining > 0 && dot.nextTickAt <= now) {
      const tickDamage = dot.damagePerTick * dot.stacks;
      onDotDamage(dot, tickDamage);
      dot.nextTickAt += dot.tickInterval;
      dot.remaining -= dot.tickInterval;
    }
  }
  enemy.dots = enemy.dots.filter((dot) => dot.remaining > 0);
}

export function burstDotDamage(enemy: EnemyState, percent: number): number {
  let total = 0;
  for (const dot of enemy.dots) {
    const remainingTicks = Math.ceil(dot.remaining / dot.tickInterval);
    const remainingPotential = dot.damagePerTick * dot.stacks * remainingTicks;
    total += remainingPotential * percent;
    dot.remaining *= 1 - percent;
  }
  enemy.dots = enemy.dots.filter((dot) => dot.remaining > 0.05);
  return total;
}

