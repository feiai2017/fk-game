import type { FloorDef } from "@/core/battle/types";
import { PRESSURE_SEQUENCE, pressureEnemyCount, pressureMultipliers } from "@/core/tower/floorRules";

export function generateTowerFloors(totalFloors: number): FloorDef[] {
  return Array.from({ length: totalFloors }, (_, index) => {
    const floor = index + 1;
    const pressure = PRESSURE_SEQUENCE[index] ?? "baseline";
    const baseHp = 700 + floor * 140;
    const baseAtk = 56 + floor * 8;
    const baseDef = 26 + floor * 5;
    const multipliers = pressureMultipliers(pressure);
    const boss = floor >= 13 && floor % 2 === 0;

    return {
      floor,
      pressure,
      enemyHp: Math.round(baseHp * multipliers.hp * (boss ? 1.18 : 1)),
      enemyAtk: Math.round(baseAtk * multipliers.atk * (boss ? 1.12 : 1)),
      enemyDef: Math.round(baseDef * multipliers.def),
      enemyResist: Math.min(0.6, multipliers.resist + floor * 0.006),
      enemyCount: boss ? 1 : pressureEnemyCount(pressure),
      boss,
      notes:
        pressure === "antiMechanic"
          ? "高抗性环境，用于验证机制完整性。"
          : undefined,
    };
  });
}
