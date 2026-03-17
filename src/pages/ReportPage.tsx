import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { FloorPreviewCard } from "@/components/battle/FloorPreviewCard";
import { recommendItemForBuild } from "@/core/build/itemRecommendations";
import { BattleRecapCard } from "@/components/report/BattleRecapCard";
import { CombatLogPanel } from "@/components/report/CombatLogPanel";
import { DamageBreakdown } from "@/components/report/DamageBreakdown";
import { DiagnosisPanel } from "@/components/report/DiagnosisPanel";
import { ExportReportButton } from "@/components/report/ExportReportButton";
import { FocusedFloorDiagnosisCard } from "@/components/report/FocusedFloorDiagnosisCard";
import { GuidancePanel } from "@/components/report/GuidancePanel";
import { KeyTimelineCard } from "@/components/report/KeyTimelineCard";
import { ReportOverview } from "@/components/report/ReportOverview";
import { RewardSelectionCard } from "@/components/report/RewardSelectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildFloorPreview } from "@/core/tower/floorPreview";
import { useGameState } from "@/hooks/useGameState";
import { tDiagnosisCode } from "@/lib/i18n";

export function ReportPage(): JSX.Element {
  const { state, continueRun, selectRunReward, startNewRun } = useGameState();
  const [showDevDetails, setShowDevDetails] = useState(false);
  const report = state.lastReport;
  const rewardPending = state.run.status === "reward_pending" && report?.win;

  const floorPreview = useMemo(
    () => (report?.context?.floor ? buildFloorPreview(report.context.floor) : undefined),
    [report?.context?.floor],
  );

  const deathTime = useMemo(
    () => report?.combatEvents?.find((event) => event.type === "PLAYER_DEATH")?.time,
    [report?.combatEvents],
  );

  const selectedRewardTitle = useMemo(() => {
    if (!report) {
      return undefined;
    }
    return [...state.run.progress.selectedRewards]
      .reverse()
      .find((reward) => reward.floor === report.floor)?.title;
  }, [report, state.run.progress.selectedRewards]);

  const rewardNote = useMemo(() => {
    if (!report?.win) {
      return "失败无奖励。";
    }
    if (rewardPending) {
      return "已生成3个奖励候选，选择后才可进入下一层。";
    }
    if (selectedRewardTitle) {
      return `本层已选奖励：${selectedRewardTitle}`;
    }
    return "本层奖励记录暂不可用。";
  }, [report?.win, rewardPending, selectedRewardTitle]);

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
          <p className="text-sm text-muted-foreground">暂无报告，请先去挑战楼层。</p>
          <Button asChild size="sm">
            <Link to="/tower">前往爬塔</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{report.win ? "本层通过" : "本层失败"}</span>
            <ExportReportButton report={report} run={state.run} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.diagnosis[0] ? (
            <div className="rounded-md border bg-background p-2">
              <p className="text-xs font-semibold">主诊断：{tDiagnosisCode(report.diagnosis[0].code)}</p>
              <p className="text-sm text-muted-foreground">{report.diagnosis[0].message}</p>
            </div>
          ) : null}
          {report.guidance ? (
            <p className="text-sm text-muted-foreground">
              本层重点：{report.guidance.floorObjective.primaryObjective}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {floorPreview ? <FloorPreviewCard preview={floorPreview} compact /> : null}
      {report.recap ? <BattleRecapCard recap={report.recap} rewardNote={rewardNote} /> : null}
      {report.timeline && report.timeline.length > 0 ? (
        <KeyTimelineCard entries={report.timeline} deathTime={deathTime} />
      ) : null}

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
                快速重开
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/build">返回构筑</Link>
              </Button>
            </>
          ) : rewardPending ? (
            <p className="text-sm text-muted-foreground">请先从 3 个奖励中选择 1 个，随后才能进入下一层。</p>
          ) : state.run.isOver ? (
            <>
              <Button asChild size="sm">
                <Link to="/run-summary">查看 floor 10 结算</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={startNewRun}>
                开始新局
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
            <GuidancePanel report={report} />
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
