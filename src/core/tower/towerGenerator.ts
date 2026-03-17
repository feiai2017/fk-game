import type { FloorDef } from "@/core/battle/types";
import { PRESSURE_SEQUENCE, pressureEnemyCount, pressureMultipliers } from "@/core/tower/floorRules";
import {
  buildFloorEnemyConfig,
  resolveFloorEnemyUnits,
  summarizeEnemyUnits,
} from "@/core/tower/enemyTemplates";

export function generateTowerFloors(totalFloors: number): FloorDef[] {
  return Array.from({ length: totalFloors }, (_, index) => {
    const floor = index + 1;
    const pressure = PRESSURE_SEQUENCE[index] ?? "baseline";
    const baseHp = 700 + floor * 140;
    const baseAtk = 56 + floor * 8;
    const baseDef = 26 + floor * 5;
    const multipliers = pressureMultipliers(pressure);
    const boss = isBossFloor(floor);
    const baseSpeed = 1 + floor * 0.012;
    const enemyCount = boss ? 1 : pressureEnemyCount(pressure);

    const enemyConfig = buildFloorEnemyConfig({
      pressure,
      enemyCount,
      boss,
    });
    const enemyUnits = resolveFloorEnemyUnits({
      config: enemyConfig,
      baseHp: Math.round(baseHp * multipliers.hp * (boss ? 1.2 : 1)),
      baseAtk: Math.round(baseAtk * multipliers.atk * (boss ? 1.15 : 1)),
      baseDef: Math.round(baseDef * multipliers.def * (boss ? 1.1 : 1)),
      baseResist: Math.min(0.62, multipliers.resist + floor * 0.006 + (boss ? 0.03 : 0)),
      baseSpeed: boss ? baseSpeed * 1.04 : baseSpeed,
    });
    const summary = summarizeEnemyUnits(enemyUnits);

    return {
      floor,
      pressure,
      enemyHp: summary.averageHp,
      enemyAtk: summary.averageAtk,
      enemyDef: summary.averageDef,
      enemyResist: summary.averageResist,
      enemySpeed: summary.averageSpeed,
      enemyCount: enemyUnits.length,
      boss,
      enemyConfig,
      enemyUnits,
      notes:
        pressure === "antiMechanic"
          ? "机制压制层：敌方抗性更高，考验机制兑现能力。"
          : boss
            ? "首领层：单体高压 + 阶段机制触发。"
            : undefined,
    };
  });
}

function isBossFloor(floor: number): boolean {
  // 演示节奏：第5层首次首领，之后每5层一个首领层。
  return floor % 5 === 0;
}
