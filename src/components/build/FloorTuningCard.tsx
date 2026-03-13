import type { ReportGuidance } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ITEM_BY_ID } from "@/data/items";
import { RELIC_BY_ID } from "@/data/relics";

interface FloorTuningCardProps {
  floor: number;
  guidance: ReportGuidance;
}

export function FloorTuningCard({ floor, guidance }: FloorTuningCardProps): JSX.Element {
  const topCandidateName = guidance.priorityAdjustment.topPriorityCandidateItemId
    ? ITEM_BY_ID[guidance.priorityAdjustment.topPriorityCandidateItemId]?.name ??
      RELIC_BY_ID[guidance.priorityAdjustment.topPriorityCandidateItemId]?.name ??
      guidance.priorityAdjustment.topPriorityCandidateItemId
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>当前层调优方向（第{floor}层）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">本层主要测试</p>
          <p className="text-sm font-semibold">{guidance.floorObjective.primaryObjective}</p>
          <p className="text-xs text-muted-foreground">{guidance.floorObjective.secondaryObjective}</p>
          <p className="mt-1 text-xs text-muted-foreground">{guidance.floorObjective.dangerWindowSummary}</p>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">本构筑在本层目标</p>
          <p className="text-sm">{guidance.floorBuildGoal.floorBuildGoal}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">最高优先调整</p>
            <p className="text-sm font-semibold">{guidance.priorityAdjustment.topPriorityAdjustment}</p>
            <p className="text-xs text-muted-foreground">目标：{guidance.priorityAdjustment.topPriorityTarget}</p>
          </div>
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs text-muted-foreground">优先尝试物品</p>
            <p className="text-sm font-semibold">{topCandidateName ?? "暂无"}</p>
            <p className="text-xs text-muted-foreground">{guidance.priorityAdjustment.reasoning}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
