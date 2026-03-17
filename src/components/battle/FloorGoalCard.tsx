import type { FloorDef, FloorGuidance } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FloorGoalCardProps {
  floor: FloorDef;
  guidance: FloorGuidance;
}

export function FloorGoalCard({ floor, guidance }: FloorGoalCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>第 {floor.floor} 层目标说明</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">主要目标</p>
          <p className="text-sm font-semibold">{guidance.primaryObjective}</p>
          <p className="text-xs text-muted-foreground">{guidance.secondaryObjective}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">常见失败原因</p>
          <p className="text-sm text-muted-foreground">{guidance.failurePatternSummary}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">建议关注指标</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {guidance.recommendedMetricFocus.map((metric) => (
              <span
                key={metric}
                className="rounded border border-border bg-background px-2 py-0.5 text-[11px]"
              >
                {metric}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">危险压力窗口</p>
          <p className="text-sm text-muted-foreground">{guidance.dangerWindowSummary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{guidance.likelyCauseLine}</p>
        </div>
      </CardContent>
    </Card>
  );
}
