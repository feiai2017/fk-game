import type {
  BossPresentation,
  FloorDef,
  FloorEnemyPresentation,
  FloorPreview,
  FloorWavePresentation,
} from "@/core/battle/types";
import {
  BOSS_PRESENTATION_META,
  ENEMY_PRESENTATION_META,
  FLOOR_PRESENTATION_META,
  fallbackBossPresentation,
  fallbackFloorPresentation,
} from "@/data/floorPresentation";

export function buildFloorPreview(floor: FloorDef): FloorPreview {
  const meta = FLOOR_PRESENTATION_META[floor.floor] ?? fallbackFloorPresentation(floor.floor, floor.pressure);
  const templateCounts = collectTemplateCounts(floor);
  const waves = buildWaves(templateCounts);

  return {
    floor: floor.floor,
    title: meta.name,
    subtitle: meta.subtitle,
    dangerHint: meta.dangerHint,
    waveSummary: floor.boss
      ? "首领战：单目标阶段战斗"
      : "当前为持续单波战斗（无显式分波）",
    waves,
    boss: floor.boss ? buildBossPreview(floor.floor) : undefined,
  };
}

function buildBossPreview(floor: number): BossPresentation {
  return BOSS_PRESENTATION_META[floor] ?? fallbackBossPresentation(floor);
}

function collectTemplateCounts(floor: FloorDef): Array<{ template: keyof typeof ENEMY_PRESENTATION_META; count: number }> {
  if (floor.enemyConfig && floor.enemyConfig.length > 0) {
    return floor.enemyConfig
      .filter((entry) => entry.count > 0)
      .map((entry) => ({ template: entry.template, count: entry.count }));
  }

  if (floor.enemyUnits && floor.enemyUnits.length > 0) {
    const map = new Map<keyof typeof ENEMY_PRESENTATION_META, number>();
    for (const unit of floor.enemyUnits) {
      map.set(unit.template, (map.get(unit.template) ?? 0) + 1);
    }
    return [...map.entries()].map(([template, count]) => ({ template, count }));
  }

  return [{ template: floor.boss ? "boss" : "balanced", count: Math.max(1, floor.enemyCount) }];
}

function buildWaves(
  entries: Array<{ template: keyof typeof ENEMY_PRESENTATION_META; count: number }>,
): FloorWavePresentation[] {
  const enemies: FloorEnemyPresentation[] = entries.map((entry) => {
    const meta = ENEMY_PRESENTATION_META[entry.template];
    return {
      template: entry.template,
      name: meta.name,
      tags: [...meta.tags],
      description: meta.description,
      count: entry.count,
    };
  });

  return [
    {
      index: 1,
      title: "主要敌群",
      enemies,
      note: enemies.length > 0 ? "建议优先处理高压单位，再转火耐久单位。" : undefined,
    },
  ];
}
