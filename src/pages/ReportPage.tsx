import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { recommendItemForBuild } from "@/core/build/itemRecommendations";
import { CombatLogPanel } from "@/components/report/CombatLogPanel";
import { DamageBreakdown } from "@/components/report/DamageBreakdown";
import { DiagnosisPanel } from "@/components/report/DiagnosisPanel";
import { FocusedFloorDiagnosisCard } from "@/components/report/FocusedFloorDiagnosisCard";
import { GuidancePanel } from "@/components/report/GuidancePanel";
import { ReportOverview } from "@/components/report/ReportOverview";
import { RewardSelectionCard } from "@/components/report/RewardSelectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameState } from "@/hooks/useGameState";
import { tDiagnosisCode } from "@/lib/i18n";

export function ReportPage(): JSX.Element {
  const { state, continueRun, selectRunReward, startNewRun } = useGameState();
  const [showDevDetails, setShowDevDetails] = useState(false);
  const report = state.lastReport;
  const rewardPending = state.run.status === "reward_pending" && report?.win;

  const lootWithHints = useMemo(
    () =>
      report
        ? report.loot.map((item) => ({
            item,
            rec: recommendItemForBuild({
              item,
              archetype: state.archetype,
              loadout: state.loadout,
              lastReport: report,
              floorGuidance: report.guidance?.floorObjective,
              reportCandidateItemIds: report.guidance?.candidateItemIds,
            }),
          }))
        : [],
    [report, state.archetype, state.loadout],
  );

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>战斗报告</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">暂无报告，请先前往爬塔挑战。</p>
          {state.run.endSummary ? (
            <Button asChild size="sm" variant="secondary">
              <Link to="/run-summary">查看跑局结算</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/tower">去挑战当前层</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{report.win ? "本层通过" : "本层失败"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.guidance ? (
            <>
              <p className="text-sm">
                本层重点：<span className="font-semibold">{report.guidance.floorObjective.primaryObjective}</span>
              </p>
              <p className="text-sm text-muted-foreground">{report.guidance.floorObjective.likelyCauseLine}</p>
              <p className="text-sm text-muted-foreground">
                下一步建议：{report.guidance.priorityAdjustment.topPriorityAdjustment}
              </p>
            </>
          ) : null}
          {report.diagnosis[0] ? (
            <div className="rounded-md border bg-background p-2">
              <p className="text-xs font-semibold">{tDiagnosisCode(report.diagnosis[0].code)}</p>
              <p className="text-sm text-muted-foreground">{report.diagnosis[0].message}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <GuidancePanel report={report} />

      {rewardPending && state.run.pendingRewards ? (
        <RewardSelectionCard
          floor={report.floor}
          rewards={state.run.pendingRewards}
          onSelect={selectRunReward}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>下一步</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!report.win ? (
            <>
              <Button size="sm" onClick={startNewRun}>
                快速重开跑局
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/build">返回构筑</Link>
              </Button>
            </>
          ) : rewardPending ? (
            <p className="text-sm text-muted-foreground">先完成三选一奖励，再继续挑战下一层。</p>
          ) : state.run.isOver ? (
            <>
              <Button asChild size="sm">
                <Link to="/run-summary">查看 floor 10 结算</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={startNewRun}>
                开始新跑局
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={continueRun}>
                继续挑战第 {state.run.currentFloor} 层
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/build">返回构筑</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>开发细节</span>
            <Button size="sm" variant="ghost" onClick={() => setShowDevDetails((value) => !value)}>
              {showDevDetails ? "收起" : "展开"}
            </Button>
          </CardTitle>
        </CardHeader>
        {showDevDetails ? (
          <CardContent className="space-y-4">
            {report.focusedFloorDiagnosis ? (
              <FocusedFloorDiagnosisCard diagnosis={report.focusedFloorDiagnosis} />
            ) : null}
            <ReportOverview report={report} />
            <div className="grid gap-4 lg:grid-cols-2">
              <DamageBreakdown report={report} />
              <DiagnosisPanel report={report} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>本次掉落（开发参考）</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {lootWithHints.length > 0 ? (
                  lootWithHints.map(({ item, rec }) => (
                    <div key={item.instanceId ?? item.id} className="rounded-md border bg-background p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.name}</Badge>
                        <Badge
                          variant={
                            rec.priorityLabel === "优先尝试"
                              ? "default"
                              : rec.priorityLabel === "可尝试"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {rec.priorityLabel}
                        </Badge>
                        {rec.helpsLastIssue ? <Badge variant="secondary">对症</Badge> : null}
                      </div>
                      {rec.tags.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {rec.tags.map((tag) => (
                            <Badge key={`${item.id}-${tag}`} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">本次无掉落（失败）。</p>
                )}
              </CardContent>
            </Card>
            <CombatLogPanel report={report} />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
