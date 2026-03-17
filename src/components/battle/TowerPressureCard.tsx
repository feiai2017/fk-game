import type { EnemyTemplateKey, FloorDef } from "@/core/battle/types";
import { getFloorEnemyTraitSummaries } from "@/core/tower/enemyTraits";
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
  const enemyMix = floor.enemyConfig
    ?.map((entry) => `${templateLabel(entry.template)}x${entry.count}`)
    .join(" / ");
  const traitSummaries = getFloorEnemyTraitSummaries(floor);

  return (
    <Card className={unlocked ? "" : "opacity-70"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>第 {floor.floor} 层</span>
          <Badge variant={floor.boss ? "default" : "outline"}>
            {floor.boss ? "首领层" : tPressure(floor.pressure)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="敌方生命(均值)" value={String(floor.enemyHp)} />
          <MiniStat label="敌方攻击(均值)" value={String(floor.enemyAtk)} />
          <MiniStat label="敌方防御(均值)" value={String(floor.enemyDef)} />
          <MiniStat label="敌方抗性(均值)" value={formatPercent(floor.enemyResist)} />
          <MiniStat label="敌方速度(均值)" value={floor.enemySpeed.toFixed(2)} />
          <MiniStat label="敌人数" value={String(floor.enemyCount)} />
        </div>
        {enemyMix ? <p className="text-xs text-muted-foreground">敌人构成：{enemyMix}</p> : null}
        {traitSummaries.length > 0 ? (
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">敌人特性</p>
            <div className="mt-1 space-y-1">
              {traitSummaries.map((trait) => (
                <p key={`${trait.template}-${trait.count}`} className="text-xs">
                  - {templateLabel(trait.template)} x{trait.count}: {trait.gameplay}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {floor.notes ? <p className="text-xs text-muted-foreground">{floor.notes}</p> : null}
        <Button size="sm" disabled={!unlocked} onClick={() => onChallenge(floor.floor)}>
          挑战本层
        </Button>
      </CardContent>
    </Card>
  );
}

function templateLabel(template: EnemyTemplateKey): string {
  switch (template) {
    case "fast":
      return "快攻";
    case "tank":
      return "坦克";
    case "balanced":
      return "均衡";
    case "antiDot":
      return "反DOT";
    case "boss":
      return "首领";
    default:
      return template;
  }
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border bg-background p-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
