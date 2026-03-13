import type { TowerPressureTag } from "@/core/battle/types";

export const PRESSURE_SEQUENCE: TowerPressureTag[] = [
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "swarm",
  "swarm",
  "swarm",
  "burst",
  "swarm",
  "burst",
  "single",
  "single",
  "burst",
  "single",
  "sustain",
  "antiMechanic",
  "sustain",
  "antiMechanic",
];

export function pressureEnemyCount(pressure: TowerPressureTag): number {
  switch (pressure) {
    case "swarm":
      return 4;
    case "single":
      return 1;
    case "burst":
      return 2;
    case "sustain":
      return 3;
    case "antiMechanic":
      return 2;
    case "baseline":
    default:
      return 3;
  }
}

export function pressureMultipliers(pressure: TowerPressureTag): {
  hp: number;
  atk: number;
  def: number;
  resist: number;
} {
  switch (pressure) {
    case "swarm":
      return { hp: 0.9, atk: 0.92, def: 0.9, resist: 0.1 };
    case "burst":
      return { hp: 1.05, atk: 1.2, def: 1, resist: 0.15 };
    case "single":
      return { hp: 1.35, atk: 1.05, def: 1.15, resist: 0.2 };
    case "sustain":
      return { hp: 1.2, atk: 1.1, def: 1.05, resist: 0.18 };
    case "antiMechanic":
      return { hp: 1.25, atk: 1.15, def: 1.2, resist: 0.3 };
    case "baseline":
    default:
      return { hp: 1, atk: 1, def: 1, resist: 0.12 };
  }
}
