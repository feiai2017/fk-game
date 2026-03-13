import type { BattleReport } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ITEM_BY_ID } from "@/data/items";
import { RELIC_BY_ID } from "@/data/relics";
import { tDiagnosisCode } from "@/lib/i18n";

interface GuidancePanelProps {
  report: BattleReport;
}

export function GuidancePanel({ report }: GuidancePanelProps): JSX.Element | null {
  const guidance = report.guidance;
  if (!guidance) {
    return null;
  }
  const topCandidateName = guidance.priorityAdjustment.topPriorityCandidateItemId
    ? itemName(guidance.priorityAdjustment.topPriorityCandidateItemId)
    : "暂无";

  return (
    <Card>
      <CardHeader>
        <CardTitle>楼层定向调优</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">本层主要测试</p>
            <p className="text-sm font-semibold">{guidance.floorObjective.primaryObjective}</p>
            <p className="text-xs text-muted-foreground">{guidance.floorObjective.secondaryObjective}</p>
          </div>
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">常见失败模式</p>
            <p className="text-sm text-muted-foreground">{guidance.floorObjective.failurePatternSummary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              重点指标：{guidance.floorObjective.recommendedMetricFocus.join(" / ")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              危险窗口：{guidance.floorObjective.dangerWindowSummary}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{guidance.floorObjective.likelyCauseLine}</p>
          </div>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">当前构筑在本层目标</p>
          <p className="text-sm">{guidance.floorBuildGoal.floorBuildGoal}</p>
          {guidance.floorBuildGoal.deprioritizedDirections.length > 0 ? (
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              {guidance.floorBuildGoal.deprioritizedDirections.map((entry) => (
                <p key={entry}>- {entry}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">最高优先调整</p>
            <p className="text-sm font-semibold">{guidance.priorityAdjustment.topPriorityAdjustment}</p>
            <p className="text-xs text-muted-foreground">
              优先目标：{guidance.priorityAdjustment.topPriorityTarget}
            </p>
            {guidance.priorityAdjustment.secondaryAdjustment ? (
              <p className="mt-1 text-xs text-muted-foreground">
                次优先：{guidance.priorityAdjustment.secondaryAdjustment}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">优先尝试物品</p>
            <p className="text-sm font-semibold">{topCandidateName}</p>
            <p className="text-xs text-muted-foreground">{guidance.priorityAdjustment.reasoning}</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">主要问题</p>
            <p className="text-sm font-semibold">
              {guidance.primaryIssue === "NONE" ? "暂无明显问题" : tDiagnosisCode(guidance.primaryIssue)}
            </p>
          </div>
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">次要问题</p>
            <p className="text-sm font-semibold">
              {guidance.secondaryIssue ? tDiagnosisCode(guidance.secondaryIssue) : "无"}
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">推荐调整方向</p>
          <div className="mt-1 space-y-1 text-sm">
            {guidance.actionSuggestions.map((entry) => (
              <p key={entry}>- {entry}</p>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">优先调整目标</p>
            <div className="mt-1 space-y-1 text-sm">
              {guidance.recommendedTargets.map((target) => (
                <p key={target}>- {target}</p>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">候选物品</p>
            <div className="mt-1 space-y-1 text-sm">
              {(guidance.candidateItemIds ?? []).length > 0 ? (
                guidance.candidateItemIds?.map((itemId) => <p key={itemId}>- {itemName(itemId)}</p>)
              ) : (
                <p className="text-muted-foreground">- 暂无</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function itemName(itemId: string): string {
  return ITEM_BY_ID[itemId]?.name ?? RELIC_BY_ID[itemId]?.name ?? itemId;
}
