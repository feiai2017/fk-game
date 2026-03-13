import type { TowerPressureTag } from "@/core/battle/types";

export interface SeededRng {
  next: () => number;
}

export function createSeededRng(seedInput: string): SeededRng {
  let seed = 0;
  for (let index = 0; index < seedInput.length; index += 1) {
    seed = (seed * 31 + seedInput.charCodeAt(index)) >>> 0;
  }
  if (seed === 0) {
    seed = 0x6d2b79f5;
  }

  return {
    next: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    },
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function reducedByDefense(damage: number, defense: number): number {
  const safeDefense = Math.max(0, defense);
  return damage * (100 / (100 + safeDefense));
}

export function reducedByResist(damage: number, resist: number): number {
  return damage * (1 - clamp(resist, 0, 0.75));
}

export function calcAttackInterval(speed: number): number {
  return Math.max(0.45, 1.2 / Math.max(0.2, speed));
}

export function scaleCooldown(cooldown: number, cdr: number): number {
  return Math.max(0.4, cooldown * (1 - clamp(cdr, 0, 0.5)));
}

export function critMultiplier(critDamage: number): number {
  return 1.5 + Math.max(0, critDamage);
}

export function rollCrit(chance: number, rng: SeededRng): boolean {
  return rng.next() < clamp(chance, 0, 0.95);
}

export function pressureDamageModifier(
  category: "direct" | "dot" | "proc",
  pressure: TowerPressureTag,
): number {
  switch (pressure) {
    case "swarm":
      return category === "direct" ? 1.05 : 0.95;
    case "burst":
      return category === "direct" ? 0.95 : 1;
    case "single":
      return 1;
    case "sustain":
      return category === "dot" ? 0.9 : 0.95;
    case "antiMechanic":
      if (category === "dot") {
        return 0.75;
      }
      if (category === "proc") {
        return 0.78;
      }
      return 0.92;
    case "baseline":
    default:
      return 1;
  }
}

export function enemyPressureAttackModifier(pressure: TowerPressureTag): number {
  switch (pressure) {
    case "burst":
      return 1.18;
    case "swarm":
      return 1;
    case "single":
      return 1.1;
    case "sustain":
      return 1.08;
    case "antiMechanic":
      return 1.12;
    case "baseline":
    default:
      return 1;
  }
}
