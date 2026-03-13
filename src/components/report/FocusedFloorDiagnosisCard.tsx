import type { FocusedFloorDiagnosis } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatSeconds } from "@/lib/format";
import { tArchetype } from "@/lib/i18n";

interface FocusedFloorDiagnosisCardProps {
  diagnosis: FocusedFloorDiagnosis;
}

export function FocusedFloorDiagnosisCard({
  diagnosis,
}: FocusedFloorDiagnosisCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Floor {diagnosis.floor} 聚焦诊断（开发视角）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">本层主要测试</p>
          <p className="font-semibold">{diagnosis.mainTest}</p>
          <p className="text-xs text-muted-foreground">{diagnosis.overallConclusion}</p>
          <p className="text-xs text-muted-foreground">
            第一建议动作：{diagnosis.recommendedFirstAction}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {diagnosis.archetypeFindings.map((entry) => (
            <div key={entry.archetype} className="rounded-md border bg-background p-2">
              <p className="text-xs text-muted-foreground">{tArchetype(entry.archetype)}</p>
              <p className="font-semibold">胜率 {formatPercent(entry.winRate)}</p>
              <p className="text-xs text-muted-foreground">
                启动 {formatSeconds(entry.avgStartupTime)} / 首杀{" "}
                {entry.avgFirstKillTime === null ? "无" : formatSeconds(entry.avgFirstKillTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                剩余血量比 {formatPercent(entry.avgEnemyRemainingHpRatio)}
              </p>
              <p className="mt-1 text-xs">{entry.finding}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
