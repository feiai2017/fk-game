import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameState } from "@/hooks/useGameState";
import { formatNumber } from "@/lib/format";
import { tArchetype } from "@/lib/i18n";

export function RunSummaryPage(): JSX.Element {
  const { state, startNewRun } = useGameState();
  const summary = state.run.endSummary;

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>本局结算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">当前没有可展示的结算信息。</p>
          <Button asChild size="sm" variant="secondary">
            <Link to="/tower">返回爬塔</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>短流程结算（第10层）</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-3">
          <Stat label="结果" value={summary.outcome === "victory" ? "通关" : "失败"} />
          <Stat label="最高通关层" value={String(summary.highestClearedFloor)} />
          <Stat label="到达层数" value={String(summary.reachedFloor)} />
          <Stat label="累计总伤害" value={formatNumber(summary.totalDamage)} />
          <Stat label="累计承受伤害" value={formatNumber(summary.totalDamageTaken)} />
          <Stat label="流派倾向" value={tArchetype(state.archetype)} />
          <Stat label="主导伤害风格" value={styleLabel(summary.dominantDamageStyle)} />
          <Stat label="最危险层" value={summary.mostDangerousFloor ? String(summary.mostDangerousFloor) : "-"} />
          <Stat label="奖励数量" value={String(summary.selectedRewards.length)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>奖励记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {summary.selectedRewards.length > 0 ? (
            summary.selectedRewards.map((reward) => (
              <p key={`${reward.floor}-${reward.optionId}`}>
                - 第 {reward.floor} 层：{reward.title}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">本次未选择奖励。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>构筑摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{summary.shortBuildSummary}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={startNewRun}>
              开始新局
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/build">返回构筑</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function styleLabel(style: "direct" | "dot" | "proc"): string {
  if (style === "dot") {
    return "DOT";
  }
  if (style === "proc") {
    return "触发";
  }
  return "直伤";
}
