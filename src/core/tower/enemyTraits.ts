import type { EnemyTemplateKey, FloorDef } from "@/core/battle/types";
import { ENEMY_TRAITS } from "@/core/tower/enemyTemplates";

export interface FloorEnemyTraitSummary {
  template: EnemyTemplateKey;
  count: number;
  title: string;
  gameplay: string;
}

export function getFloorEnemyTraitSummaries(floor: FloorDef): FloorEnemyTraitSummary[] {
  const config = floor.enemyConfig ?? [];
  return config.map((entry) => ({
    template: entry.template,
    count: entry.count,
    title: ENEMY_TRAITS[entry.template].title,
    gameplay: ENEMY_TRAITS[entry.template].gameplay,
  }));
}
