import type { ArchetypeKey, FloorDef, ItemDef } from "@/core/battle/types";
import { createSeededRng } from "@/core/battle/formulas";
import { createItemInstance } from "@/core/loot/itemFactory";
import { rarityWeightsForFloor } from "@/core/loot/rarity";
import { ITEMS } from "@/data/items";
import { RELICS } from "@/data/relics";

interface LootInput {
  win: boolean;
  floor: FloorDef;
  archetype: ArchetypeKey;
  seed: string;
}

export function generateLoot(input: LootInput): ItemDef[] {
  if (!input.win) {
    return [];
  }
  const rng = createSeededRng(input.seed);
  const drops = input.floor.boss || input.floor.floor % 5 === 0 ? 2 : 1;
  const pool = [...ITEMS, ...RELICS];
  const result: ItemDef[] = [];

  for (let dropIndex = 0; dropIndex < drops; dropIndex += 1) {
    const rarity = pickRarity(input.floor.floor, rng.next());
    const candidates = pool.filter((item) => item.rarity === rarity);
    const chosen = weightedPick(candidates, input.archetype, rng.next());
    result.push(createItemInstance(chosen, `${input.floor.floor}-${dropIndex}`));
  }

  return result;
}

function pickRarity(floor: number, roll: number): "common" | "rare" | "legendary" {
  const weights = rarityWeightsForFloor(floor);
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = roll * total;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.rarity;
    }
  }
  return "common";
}

function weightedPick(items: ItemDef[], archetype: ArchetypeKey, roll: number): ItemDef {
  if (items.length === 0) {
    return ITEMS[0];
  }
  const weighted = items.map((item) => {
    const bonus = item.archetypeBias === archetype ? 3 : 1;
    return { item, weight: bonus };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = roll * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.item;
    }
  }
  return weighted[0].item;
}

