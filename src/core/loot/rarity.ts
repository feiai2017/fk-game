export type LootRarity = "common" | "rare" | "legendary";

export function rarityWeightsForFloor(floor: number): Array<{ rarity: LootRarity; weight: number }> {
  if (floor <= 6) {
    return [
      { rarity: "common", weight: 74 },
      { rarity: "rare", weight: 24 },
      { rarity: "legendary", weight: 2 },
    ];
  }
  if (floor <= 12) {
    return [
      { rarity: "common", weight: 56 },
      { rarity: "rare", weight: 36 },
      { rarity: "legendary", weight: 8 },
    ];
  }
  if (floor <= 16) {
    return [
      { rarity: "common", weight: 44 },
      { rarity: "rare", weight: 42 },
      { rarity: "legendary", weight: 14 },
    ];
  }
  return [
    { rarity: "common", weight: 30 },
    { rarity: "rare", weight: 45 },
    { rarity: "legendary", weight: 25 },
  ];
}

