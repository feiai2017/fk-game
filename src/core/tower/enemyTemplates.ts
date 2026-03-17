import type {
  EnemyTemplateDef,
  EnemyTemplateKey,
  FloorEnemyConfig,
  FloorEnemyUnit,
  TowerPressureTag,
} from "@/core/battle/types";
import { clamp } from "@/core/battle/formulas";

export interface EnemyTraitInfo {
  title: string;
  gameplay: string;
}

export const ENEMY_TEMPLATES: Record<EnemyTemplateKey, EnemyTemplateDef> = {
  fast: {
    key: "fast",
    name: "快攻敌人",
    hpMultiplier: 0.8,
    atkMultiplier: 1.08,
    defMultiplier: 0.84,
    speedMultiplier: 1.3,
    resistMultiplier: 0.92,
  },
  tank: {
    key: "tank",
    name: "坦克敌人",
    hpMultiplier: 1.36,
    atkMultiplier: 0.84,
    defMultiplier: 1.32,
    speedMultiplier: 0.78,
    resistMultiplier: 1.1,
  },
  balanced: {
    key: "balanced",
    name: "均衡敌人",
    hpMultiplier: 1,
    atkMultiplier: 1,
    defMultiplier: 1,
    speedMultiplier: 1,
    resistMultiplier: 1,
  },
  antiDot: {
    key: "antiDot",
    name: "反DOT敌人",
    hpMultiplier: 1.08,
    atkMultiplier: 0.98,
    defMultiplier: 1.08,
    speedMultiplier: 1.02,
    resistMultiplier: 1.35,
  },
  boss: {
    key: "boss",
    name: "首领敌人",
    hpMultiplier: 2.2,
    atkMultiplier: 1.22,
    defMultiplier: 1.22,
    speedMultiplier: 0.92,
    resistMultiplier: 1.12,
  },
};

export const ENEMY_TRAITS: Record<EnemyTemplateKey, EnemyTraitInfo> = {
  fast: {
    title: "快节奏压制",
    gameplay: "攻击频率高，专门惩罚慢启动。",
  },
  tank: {
    title: "高耐久拖时",
    gameplay: "不易快速击杀，会拖慢首杀节奏。",
  },
  balanced: {
    title: "稳定威胁",
    gameplay: "无明显短板，持续给压。",
  },
  antiDot: {
    title: "反DOT机制",
    gameplay: "会周期性清除DOT层数，并提高机制抗性。",
  },
  boss: {
    title: "首领阶段机制",
    gameplay: "半血触发阶段变化（净化DOT并进入狂暴）。",
  },
};

interface BuildEnemyConfigInput {
  pressure: TowerPressureTag;
  enemyCount: number;
  boss: boolean;
}

interface ResolveFloorEnemyUnitsInput {
  config: FloorEnemyConfig[];
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseResist: number;
  baseSpeed: number;
}

export interface EnemyUnitSummary {
  averageHp: number;
  averageAtk: number;
  averageDef: number;
  averageResist: number;
  averageSpeed: number;
}

export function buildFloorEnemyConfig(input: BuildEnemyConfigInput): FloorEnemyConfig[] {
  const { pressure, enemyCount, boss } = input;
  if (boss) {
    return [{ template: "boss", count: 1 }];
  }

  if (enemyCount <= 1) {
    return [{ template: pressure === "single" ? "tank" : "balanced", count: 1 }];
  }

  switch (pressure) {
    case "swarm": {
      const fastCount = Math.max(1, Math.ceil(enemyCount * 0.5));
      const remaining = enemyCount - fastCount;
      return compactConfig([
        { template: "fast", count: fastCount },
        { template: "balanced", count: Math.max(0, remaining - 1) },
        { template: "tank", count: Math.min(1, remaining) },
      ]);
    }
    case "burst":
      return compactConfig([
        { template: "fast", count: 1 },
        { template: "balanced", count: Math.max(0, enemyCount - 1) },
      ]);
    case "single":
      return compactConfig([
        { template: "tank", count: 1 },
        { template: "balanced", count: Math.max(0, enemyCount - 1) },
      ]);
    case "sustain":
      return compactConfig([
        { template: "tank", count: 1 },
        { template: "balanced", count: Math.max(0, enemyCount - 2) },
        { template: "antiDot", count: 1 },
      ]);
    case "antiMechanic":
      return compactConfig([
        { template: "antiDot", count: 1 },
        { template: "tank", count: 1 },
        { template: "balanced", count: Math.max(0, enemyCount - 2) },
      ]);
    case "baseline":
    default:
      return compactConfig([
        { template: "balanced", count: Math.max(1, enemyCount - 2) },
        { template: "fast", count: 1 },
        { template: "tank", count: 1 },
      ]);
  }
}

export function resolveFloorEnemyUnits(input: ResolveFloorEnemyUnitsInput): FloorEnemyUnit[] {
  const { config, baseHp, baseAtk, baseDef, baseResist, baseSpeed } = input;
  const units: FloorEnemyUnit[] = [];
  let id = 1;
  for (const entry of config) {
    const template = ENEMY_TEMPLATES[entry.template];
    for (let index = 0; index < entry.count; index += 1) {
      units.push({
        id,
        template: entry.template,
        hp: Math.max(1, Math.round(baseHp * template.hpMultiplier)),
        atk: Math.max(1, Math.round(baseAtk * template.atkMultiplier)),
        def: Math.max(0, Math.round(baseDef * template.defMultiplier)),
        resist: clamp(baseResist * template.resistMultiplier, 0, 0.75),
        speed: clamp(baseSpeed * template.speedMultiplier, 0.55, 2.2),
      });
      id += 1;
    }
  }
  return units;
}

export function summarizeEnemyUnits(units: FloorEnemyUnit[]): EnemyUnitSummary {
  if (units.length === 0) {
    return {
      averageHp: 0,
      averageAtk: 0,
      averageDef: 0,
      averageResist: 0,
      averageSpeed: 1,
    };
  }
  const count = units.length;
  const sum = units.reduce(
    (acc, unit) => {
      acc.hp += unit.hp;
      acc.atk += unit.atk;
      acc.def += unit.def;
      acc.resist += unit.resist;
      acc.speed += unit.speed;
      return acc;
    },
    { hp: 0, atk: 0, def: 0, resist: 0, speed: 0 },
  );
  return {
    averageHp: Math.round(sum.hp / count),
    averageAtk: Math.round(sum.atk / count),
    averageDef: Math.round(sum.def / count),
    averageResist: sum.resist / count,
    averageSpeed: Number((sum.speed / count).toFixed(2)),
  };
}

function compactConfig(entries: FloorEnemyConfig[]): FloorEnemyConfig[] {
  return entries.filter((entry) => entry.count > 0);
}
