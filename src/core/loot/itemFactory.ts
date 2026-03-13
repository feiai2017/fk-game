import type { ItemDef } from "@/core/battle/types";

let serial = 0;

export function createItemInstance(item: ItemDef, seedPrefix: string): ItemDef {
  serial += 1;
  return {
    ...item,
    stats: { ...item.stats },
    affixes: item.affixes ? [...item.affixes] : undefined,
    mechanicEffects: item.mechanicEffects ? item.mechanicEffects.map((effect) => ({ ...effect })) : undefined,
    instanceId: `${seedPrefix}-${item.id}-${serial}`,
  };
}
