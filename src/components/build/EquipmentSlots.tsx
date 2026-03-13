import type { EquipmentSlot, Loadout } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "武器",
  helm: "头盔",
  armor: "护甲",
  ring1: "戒指 1",
  ring2: "戒指 2",
  core: "核心遗物",
};

const SLOT_ORDER: EquipmentSlot[] = ["weapon", "helm", "armor", "ring1", "ring2", "core"];

interface EquipmentSlotsProps {
  loadout: Loadout;
  onUnequip: (slot: EquipmentSlot) => void;
}

export function EquipmentSlots({ loadout, onUnequip }: EquipmentSlotsProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>装备栏</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {SLOT_ORDER.map((slot) => {
          const item = loadout[slot];
          return (
            <div key={slot} className="flex items-center justify-between rounded-md border bg-background p-2">
              <div>
                <p className="text-xs text-muted-foreground">{SLOT_LABELS[slot]}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item?.name ?? "空"}</p>
                  {item ? <Badge variant="secondary">已装备</Badge> : null}
                </div>
              </div>
              {item ? (
                <Button size="sm" variant="ghost" onClick={() => onUnequip(slot)}>
                  卸下
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
