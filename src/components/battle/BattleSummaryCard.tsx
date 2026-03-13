import type { BattleReport } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatSeconds } from "@/lib/format";
import { tPressure } from "@/lib/i18n";

interface BattleSummaryCardProps {
  report?: BattleReport;
}

export function BattleSummaryCard({ report }: BattleSummaryCardProps): JSX.Element {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>最近一场战斗</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">还没有战斗记录。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最近一场战斗</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant={report.win ? "default" : "outline"}>{report.win ? "胜利" : "失败"}</Badge>
          <span>第 {report.floor} 层</span>
          <span className="text-muted-foreground">[{tPressure(report.pressure)}]</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="战斗时长" value={formatSeconds(report.metrics.duration)} />
          <MiniStat label="总伤害" value={formatNumber(report.metrics.totalDamage)} />
          <MiniStat label="承受伤害" value={formatNumber(report.metrics.damageTaken)} />
          <MiniStat label="剩余生命" value={formatNumber(report.metrics.remainingHp)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
