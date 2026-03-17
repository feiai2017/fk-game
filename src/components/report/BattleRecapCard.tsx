import type { BattleRecap } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";

interface BattleRecapCardProps {
  recap: BattleRecap;
  rewardNote?: string;
}

export function BattleRecapCard({ recap, rewardNote }: BattleRecapCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>战斗复盘</span>
          <Badge variant={recap.outcomeText === "通关" ? "default" : "outline"}>{recap.outcomeText}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border bg-background p-2">
          <p className="font-semibold">结论：{recap.reasonSummary}</p>
          <p className="mt-1 text-muted-foreground">关键点：{recap.keyWinOrFailPoint}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">输出构成</p>
            <p>总伤害：{formatNumber(recap.outputSummary.totalDamage)}</p>
            <p>直伤占比：{formatPercent(recap.outputSummary.directRatio)}</p>
            <p>DOT占比：{formatPercent(recap.outputSummary.dotRatio)}</p>
            <p>特殊/触发占比：{formatPercent(recap.outputSummary.procRatio)}</p>
          </div>

          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">承伤构成</p>
            <p>主要伤害来源：{recap.intakeSummary.topSourceName}</p>
            <p>来源总伤害：{formatNumber(recap.intakeSummary.topSourceDamage)}</p>
            <p>
              最大单次承伤：{formatNumber(recap.intakeSummary.maxSingleHit)}
              {recap.intakeSummary.maxSingleHitTime !== null
                ? `（${recap.intakeSummary.maxSingleHitTime.toFixed(1)}s）`
                : ""}
            </p>
            <p>最危险单位/技能：{recap.intakeSummary.mostDangerousSource}</p>
          </div>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">危险窗口</p>
          <p>{recap.dangerWindowSummary}</p>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">构筑建议</p>
          <p>{recap.suggestion}</p>
        </div>

        {rewardNote ? (
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">本层奖励/强化</p>
            <p>{rewardNote}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
