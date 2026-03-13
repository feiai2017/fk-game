import type { FloorDef } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { tPressure } from "@/lib/i18n";

interface TowerPressureCardProps {
  floor: FloorDef;
  unlocked: boolean;
  onChallenge: (floor: number) => void;
}

export function TowerPressureCard({ floor, unlocked, onChallenge }: TowerPressureCardProps): JSX.Element {
  return (
    <Card className={unlocked ? "" : "opacity-70"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>第 {floor.floor} 层</span>
          <Badge variant="outline">{tPressure(floor.pressure)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="敌人生命" value={String(floor.enemyHp)} />
          <MiniStat label="敌人攻击" value={String(floor.enemyAtk)} />
          <MiniStat label="敌人防御" value={String(floor.enemyDef)} />
          <MiniStat label="敌人抗性" value={formatPercent(floor.enemyResist)} />
          <MiniStat label="敌人数" value={String(floor.enemyCount)} />
          <MiniStat label="首领层" value={floor.boss ? "是" : "否"} />
        </div>
        {floor.notes ? <p className="text-xs text-muted-foreground">{floor.notes}</p> : null}
        <Button size="sm" disabled={!unlocked} onClick={() => onChallenge(floor.floor)}>
          挑战
        </Button>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border bg-background p-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
