import type {
  ArchetypeKey,
  BattleReport,
  EquipmentSlot,
  FloorGuidance,
  ItemDef,
  Loadout,
} from "@/core/battle/types";
import { recommendItemForBuild } from "@/core/build/itemRecommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tRarity } from "@/lib/i18n";

interface InventoryPanelProps {
  inventory: ItemDef[];
  archetype: ArchetypeKey;
  loadout: Loadout;
  lastReport?: BattleReport;
  floorGuidance?: FloorGuidance;
  reportCandidateItemIds?: string[];
  onEquip: (slot: EquipmentSlot, instanceId: string) => void;
}

export function InventoryPanel({
  inventory,
  archetype,
  loadout,
  lastReport,
  floorGuidance,
  reportCandidateItemIds,
  onEquip,
}: InventoryPanelProps): JSX.Element {
  const ranked = [...inventory].map((item) => ({
      item,
      recommendation: recommendItemForBuild({
        item,
        archetype,
        loadout,
        lastReport,
        floorGuidance,
        reportCandidateItemIds,
      }),
  }));
  ranked.sort((left, right) => {
    if (right.recommendation.score !== left.recommendation.score) {
      return right.recommendation.score - left.recommendation.score;
    }
    return rarityRank(right.item.rarity) - rarityRank(left.item.rarity);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>背包 / 战利品 ({ranked.length})</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[620px] space-y-2 overflow-auto pr-1">
        {ranked.map(({ item, recommendation }) => (
          <div key={item.instanceId ?? item.id} className="rounded-md border bg-background p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                {recommendation.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {recommendation.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline">{tRarity(item.rarity)}</Badge>
                {isTemplateEquipped(item, loadout) ? <Badge variant="secondary">已装备同款</Badge> : null}
                <Badge
                  variant={
                    recommendation.priorityLabel === "优先尝试"
                      ? "default"
                      : recommendation.priorityLabel === "可尝试"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {recommendation.priorityLabel}
                </Badge>
                {recommendation.helpsLastIssue ? <Badge variant="secondary">对症</Badge> : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {renderEquipButtons(item, onEquip)}
            </div>
          </div>
        ))}
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前无物品。通关楼层可获得战利品。</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function renderEquipButtons(
  item: ItemDef,
  onEquip: (slot: EquipmentSlot, instanceId: string) => void,
): JSX.Element | JSX.Element[] {
  const instanceId = item.instanceId ?? item.id;
  if (item.slot === "ring1" || item.slot === "ring2") {
    return [
      <Button key="ring1" size="sm" variant="secondary" onClick={() => onEquip("ring1", instanceId)}>
        装备到戒指1
      </Button>,
      <Button key="ring2" size="sm" variant="secondary" onClick={() => onEquip("ring2", instanceId)}>
        装备到戒指2
      </Button>,
    ];
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => onEquip(item.slot, instanceId)}>
      装备到{slotLabel(item.slot)}
    </Button>
  );
}

function rarityRank(rarity: ItemDef["rarity"]): number {
  switch (rarity) {
    case "legendary":
      return 3;
    case "rare":
      return 2;
    case "common":
    default:
      return 1;
  }
}

function isTemplateEquipped(item: ItemDef, loadout: Loadout): boolean {
  const equipped = [
    loadout.weapon,
    loadout.helm,
    loadout.armor,
    loadout.ring1,
    loadout.ring2,
    loadout.core,
  ].filter(Boolean);
  return equipped.some((equippedItem) => equippedItem?.id === item.id);
}

function slotLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return "武器";
    case "helm":
      return "头盔";
    case "armor":
      return "护甲";
    case "core":
      return "核心遗物";
    case "ring1":
      return "戒指1";
    case "ring2":
      return "戒指2";
    default:
      return slot;
  }
}
