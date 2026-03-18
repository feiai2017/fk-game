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
          <CardTitle>终局总结 · 第10层短程演示</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-3">
          <Stat label="结果" value={summary.outcome === "victory" ? "通关" : "失败"} />
          <Stat label="最高通关层" value={String(summary.highestClearedFloor)} />
          <Stat label="到达层数" value={String(summary.reachedFloor)} />
          <Stat label="累计总伤害" value={formatNumber(summary.totalDamage)} />
          <Stat label="累计承受伤害" value={formatNumber(summary.totalDamageTaken)} />
          <Stat label="流派倾向" value={tArchetype(state.archetype)} />
          <Stat label="主导伤害风格" value={styleLabel(summary.dominantDamageStyle)} />
          <Stat label="核心路线" value={summary.coreRoute || "未成型"} />
          <Stat label="最危险层" value={summary.mostDangerousFloor ? String(summary.mostDangerousFloor) : "-"} />
          <Stat label="奖励数量" value={String(summary.selectedRewards.length)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关键强化</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(summary.keyBonuses ?? []).length > 0 ? (
            (summary.keyBonuses ?? []).map((row) => (
              <p key={row}>- {row}</p>
            ))
          ) : (
            <p className="text-muted-foreground">本次无可追踪强化。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>本局旅程节点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {summary.selectedRewards.length > 0 ? (
            summary.selectedRewards.slice(-6).map((reward) => (
              <div key={`${reward.floor}-${reward.optionId}`} className="rounded-md border bg-background p-2">
                <p className="font-medium">第 {reward.floor} 层 · {reward.title}</p>
                <p className="text-xs text-muted-foreground">类型：{reward.category}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">本局未记录到可展示的旅程节点。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>本局总结</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">{summary.runTakeaway || "本局已结束，建议针对压力段复盘后再开新局。"}</p>
          <p className="text-sm">{summary.shortBuildSummary}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={startNewRun}>
              再来一局
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/run">返回爬塔</Link>
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
