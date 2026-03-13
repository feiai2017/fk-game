import type { Loadout, Stats } from "@/core/battle/types";
import { EQUIPMENT_SLOTS } from "@/core/build/loadout";

const STAT_KEYS: Array<keyof Stats> = [
  "hp",
  "atk",
  "def",
  "speed",
  "crit",
  "critDamage",
  "skillPower",
  "dotPower",
  "procPower",
  "resist",
  "regen",
  "shieldPower",
  "cdr",
  "resourceMax",
  "resourceRegen",
];

export function aggregateStats(base: Stats, loadout: Loadout): Stats {
  const result: Stats = { ...base };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = loadout[slot];
    if (!item) {
      continue;
    }
    for (const key of STAT_KEYS) {
      result[key] += item.stats[key] ?? 0;
    }
  }

  result.crit = clamp(result.crit, 0, 0.95);
  result.critDamage = Math.max(0, result.critDamage);
  result.cdr = clamp(result.cdr, 0, 0.5);
  result.resist = clamp(result.resist, 0, 0.75);
  result.resourceMax = Math.max(20, result.resourceMax);
  result.speed = Math.max(0.4, result.speed);
  result.hp = Math.max(1, result.hp);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

