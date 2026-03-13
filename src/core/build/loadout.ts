import type { EquipmentSlot, ItemDef, Loadout } from "@/core/battle/types";

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "weapon",
  "helm",
  "armor",
  "ring1",
  "ring2",
  "core",
];

export function equipItem(loadout: Loadout, slot: EquipmentSlot, item?: ItemDef): Loadout {
  if (!item) {
    const next: Loadout = { ...loadout };
    delete next[slot];
    return next;
  }
  return { ...loadout, [slot]: item };
}

export function updateSkillSlot(loadout: Loadout, index: number, skillId: string): Loadout {
  const skillIds = [...loadout.skillIds];
  skillIds[index] = skillId;
  return { ...loadout, skillIds: skillIds.slice(0, 3) };
}

