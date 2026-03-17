import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { FloorPreviewCard } from "@/components/battle/FloorPreviewCard";
import { BattleRecapCard } from "@/components/report/BattleRecapCard";
import { KeyTimelineCard } from "@/components/report/KeyTimelineCard";
import { RewardSelectionCard } from "@/components/report/RewardSelectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildDemoBuildSummary } from "@/core/build/demoBuildSummary";
import { getFloorEnemyTraitSummaries } from "@/core/tower/enemyTraits";
import { buildFloorGuidance } from "@/core/tower/floorGuidance";
import { buildFloorPreview } from "@/core/tower/floorPreview";
import { DEMO_RUN_TARGET_FLOOR } from "@/data/constants";
import { TOWER_FLOORS } from "@/data/tower";
import { useGameState } from "@/hooks/useGameState";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import { tPressure } from "@/lib/i18n";

export function RunPage(): JSX.Element {
  const { state, continueRun, selectRunReward, startNewRun } = useGameState();
  const [showDebug, setShowDebug] = useState(false);

  const report = state.lastReport;
  const run = state.run;
  const canBattle = run.status === "in_progress" && !run.isOver;
  const rewardPending = run.status === "reward_pending" && !!run.pendingRewards?.length;
  const runEnded = run.status === "over" || run.isOver;

  const currentFloor = useMemo(
    () => TOWER_FLOORS.find((entry) => entry.floor === run.currentFloor),
    [run.currentFloor],
  );
  const floorGuidance = useMemo(
    () => (currentFloor ? buildFloorGuidance(currentFloor) : undefined),
    [currentFloor],
  );
  const floorPreview = useMemo(
    () => (currentFloor ? buildFloorPreview(currentFloor) : undefined),
    [currentFloor],
  );
  const traitSummaries = useMemo(
    () => (currentFloor ? getFloorEnemyTraitSummaries(currentFloor) : []),
    [currentFloor],
  );

  const buildSummary = useMemo(
    () =>
      buildDemoBuildSummary({
        archetype: state.archetype,
        skillIds: state.loadout.skillIds,
        progress: run.progress,
      }),
    [run.progress, state.archetype, state.loadout.skillIds],
  );

  const topSource = useMemo(() => {
    if (!report) {
      return undefined;
    }
    return [...report.metrics.damageBySource].sort((left, right) => right.total - left.total)[0];
  }, [report]);

  const eventCounts = useMemo(() => {
    if (!report?.combatEvents?.length) {
      return {
        spread: 0,
        rupture: 0,
        cleanse: 0,
        shield: 0,
        bossMechanic: 0,
      };
    }
    const events = report.combatEvents;
    return {
      spread: events.filter((event) => event.type === "DOT_APPLY" && event.tags?.includes("spread")).length,
      rupture: events.filter((event) => event.type === "DOT_BURST").length,
      cleanse: events.filter((event) => event.type === "DOT_CLEANSE").length,
      shield: events.filter((event) => event.type === "SHIELD_GAIN").length,
      bossMechanic: events.filter((event) => event.type === "BOSS_MECHANIC").length,
    };
  }, [report]);

  const rewardForCurrentReport = useMemo(() => {
    if (!report) {
      return undefined;
    }
    return [...run.progress.selectedRewards]
      .reverse()
      .find((reward) => reward.floor === report.floor);
  }, [report, run.progress.selectedRewards]);

  const deathTime = useMemo(
    () => report?.combatEvents?.find((event) => event.type === "PLAYER_DEATH")?.time,
    [report?.combatEvents],
  );

  const rewardNote = useMemo(() => {
    if (!report?.win) {
      return "失败无奖励。";
    }
    if (rewardPending) {
      return "已掉落3选1奖励，选择后生效。";
    }
    if (rewardForCurrentReport?.title) {
      return `已选择：${rewardForCurrentReport.title}`;
    }
    return "本层奖励记录暂不可用。";
  }, [report?.win, rewardForCurrentReport?.title, rewardPending]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>最小可玩爬塔演示</span>
            <Badge variant="outline">
              第 {run.currentFloor} / {DEMO_RUN_TARGET_FLOOR} 层
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {"开始新局 -> 挑战楼层 -> 胜/负 -> 选择奖励 -> 应用奖励 -> 下一层"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={startNewRun}>
              开始新局
            </Button>
            <Button size="sm" disabled={!canBattle} onClick={continueRun}>
              挑战第 {run.currentFloor} 层
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/build">打开构筑页</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/report">查看完整战报</Link>
            </Button>
            {runEnded ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/run-summary">查看结算</Link>
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            状态：{runStatusLabel(run.status)} | 已选奖励：{run.progress.selectedRewards.length}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>当前构筑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              流派：<span className="font-semibold">{buildSummary.archetypeLabel}</span> | 路线：{" "}
              <span className="font-semibold">{buildSummary.routeLabel}</span>
            </p>
            <p>核心技能：{buildSummary.coreSkills.join(" / ")}</p>
            <p>关键加成：{buildSummary.keyBonuses.join("，")}</p>
            <p className="text-muted-foreground">构筑摘要：{buildSummary.summaryText}</p>
          </CardContent>
        </Card>

        {floorPreview ? (
          <FloorPreviewCard preview={floorPreview} compact />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>当前楼层 / 敌人快照</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {currentFloor ? (
                <>
                  <p>
                    第 {currentFloor.floor} 层 | {tPressure(currentFloor.pressure)} |{" "}
                    {currentFloor.boss ? "首领层" : "普通层"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="敌人数" value={String(currentFloor.enemyCount)} />
                    <MiniStat label="敌方速度(均值)" value={currentFloor.enemySpeed.toFixed(2)} />
                    <MiniStat label="敌方生命(均值)" value={String(currentFloor.enemyHp)} />
                    <MiniStat label="敌方攻击(均值)" value={String(currentFloor.enemyAtk)} />
                  </div>
                  {traitSummaries.length > 0 ? (
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-xs text-muted-foreground">敌人特性摘要</p>
                      {traitSummaries.map((trait) => (
                        <p key={`${trait.template}-${trait.count}`} className="text-xs">
                          - {trait.title} x{trait.count}: {trait.gameplay}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {floorGuidance ? (
                    <p className="text-xs text-muted-foreground">
                      本层重点：{floorGuidance.primaryObjective}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">暂无楼层数据。</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {rewardPending && run.pendingRewards && report?.win ? (
        <RewardSelectionCard floor={report.floor} rewards={run.pendingRewards} onSelect={selectRunReward} />
      ) : null}

      {report ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>战斗结果</span>
                <Button size="sm" variant="ghost" onClick={() => setShowDebug((value) => !value)}>
                  {showDebug ? "隐藏调试层" : "显示调试层"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                <MiniStat label="结果" value={report.win ? "胜利" : "失败"} />
                <MiniStat label="战斗时长" value={formatSeconds(report.metrics.duration)} />
                <MiniStat label="总伤害" value={formatNumber(report.metrics.totalDamage)} />
                <MiniStat label="最高伤害技能" value={topSource?.sourceName ?? "-"} />
                <MiniStat label="DOT伤害占比" value={formatPercent(report.metrics.dotDamageRatio)} />
                <MiniStat
                  label="首领机制"
                  value={eventCounts.bossMechanic > 0 ? `已触发(${eventCounts.bossMechanic})` : "未触发"}
                />
                <MiniStat
                  label="本层奖励"
                  value={
                    rewardPending && report.win
                      ? "待选择"
                      : rewardForCurrentReport?.title ?? (report.win ? "暂无记录" : "失败无奖励")
                  }
                />
                <MiniStat
                  label="首杀时间"
                  value={report.metrics.firstKillTime === null ? "-" : `${report.metrics.firstKillTime.toFixed(1)}s`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {!report.win ? (
                  <Button size="sm" onClick={startNewRun}>
                    结束并重开
                  </Button>
                ) : rewardPending ? (
                  <Badge variant="secondary">请先选择1个奖励再继续。</Badge>
                ) : runEnded ? (
                  <Button asChild size="sm">
                    <Link to="/run-summary">查看结算</Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={continueRun}>
                    下一层（第 {run.currentFloor} 层）
                  </Button>
                )}
              </div>

              {showDebug ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border bg-background p-3 text-xs">
                    <p className="mb-1 text-muted-foreground">关键触发统计</p>
                    <p>扩散: {eventCounts.spread}</p>
                    <p>引爆: {eventCounts.rupture}</p>
                    <p>净化: {eventCounts.cleanse}</p>
                    <p>护盾获取: {eventCounts.shield}</p>
                    <p>首领机制: {eventCounts.bossMechanic}</p>
                  </div>
                  <div className="max-h-[260px] overflow-auto rounded-md border bg-background p-3 text-xs">
                    <p className="mb-1 text-muted-foreground">战斗日志（前20行）</p>
                    {report.combatLog.slice(0, 20).map((line, index) => (
                      <p key={`${line}-${index}`} className="font-mono">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {report.recap ? <BattleRecapCard recap={report.recap} rewardNote={rewardNote} /> : null}
          {report.timeline && report.timeline.length > 0 ? (
            <KeyTimelineCard entries={report.timeline} deathTime={deathTime} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function runStatusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "进行中";
    case "reward_pending":
      return "待选奖励";
    case "over":
      return "已结束";
    default:
      return status;
  }
}
