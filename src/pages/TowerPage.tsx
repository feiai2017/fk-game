import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { runBatchValidation } from "@/core/battle/validation";
import type { BatchValidationSummary } from "@/core/battle/types";
import { BattleSummaryCard } from "@/components/battle/BattleSummaryCard";
import { FloorGoalCard } from "@/components/battle/FloorGoalCard";
import { TowerPressureCard } from "@/components/battle/TowerPressureCard";
import { buildFloorGuidance } from "@/core/tower/floorGuidance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_RUN_TARGET_FLOOR } from "@/data/constants";
import { TOWER_FLOORS } from "@/data/tower";
import { useGameState } from "@/hooks/useGameState";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import { tDiagnosisCode } from "@/lib/i18n";

export function TowerPage(): JSX.Element {
  const { state, runFloor, continueRun, finalStats, selectedSkills, startNewRun } = useGameState();
  const [showValidation, setShowValidation] = useState(false);
  const [batchRuns, setBatchRuns] = useState(20);
  const [batchSummary, setBatchSummary] = useState<BatchValidationSummary>();

  const activeFloor = state.run.currentFloor;
  const visibleFloors = useMemo(
    () =>
      TOWER_FLOORS.filter(
        (floor) => floor.floor >= Math.max(1, activeFloor - 1) && floor.floor <= Math.min(activeFloor + 2, DEMO_RUN_TARGET_FLOOR),
      ),
    [activeFloor],
  );
  const currentFloor = useMemo(
    () => TOWER_FLOORS.find((floor) => floor.floor === activeFloor),
    [activeFloor],
  );
  const currentFloorGuidance = useMemo(
    () => (currentFloor ? buildFloorGuidance(currentFloor) : undefined),
    [currentFloor],
  );

  function runBatch(): void {
    if (!currentFloor || selectedSkills.length === 0) {
      return;
    }
    const summary = runBatchValidation({
      battleInput: {
        floor: currentFloor,
        finalStats,
        skills: selectedSkills,
        loadout: state.loadout,
        archetype: state.archetype,
      },
      runCount: batchRuns,
    });
    setBatchSummary(summary);
  }

  const canChallenge = state.run.status === "in_progress" && !state.run.isOver;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>短流程跑局进度</span>
            <Badge variant="outline">
              第 {activeFloor} / {DEMO_RUN_TARGET_FLOOR} 层
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            主循环：构筑 - 挑战 - 短报告 - 三选一奖励 - 继续爬塔。
          </p>
          <p className="text-muted-foreground">
            跑局状态：
            <span className="font-semibold text-foreground">
              {state.run.status === "in_progress"
                ? "进行中"
                : state.run.status === "reward_pending"
                  ? "待选奖励"
                  : "已结束"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {state.run.status === "in_progress" ? (
              <Button size="sm" onClick={continueRun}>
                挑战当前层
              </Button>
            ) : state.run.status === "reward_pending" ? (
              <Button asChild size="sm">
                <Link to="/report">去战报选择奖励</Link>
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={startNewRun}>
                  快速重开跑局
                </Button>
                {state.run.endSummary ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/run-summary">查看结算</Link>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {currentFloor && currentFloorGuidance ? (
        <FloorGoalCard floor={currentFloor} guidance={currentFloorGuidance} />
      ) : null}

      <BattleSummaryCard report={state.lastReport} />
      {state.lastReport ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="secondary">
            <Link to="/report">查看最新战报</Link>
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>批量验证（开发）</span>
            <Button size="sm" variant="ghost" onClick={() => setShowValidation((value) => !value)}>
              {showValidation ? "收起" : "展开"}
            </Button>
          </CardTitle>
        </CardHeader>
        {showValidation ? (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="batchRuns" className="text-sm text-muted-foreground">
                运行次数
              </label>
              <input
                id="batchRuns"
                type="number"
                min={1}
                max={200}
                value={batchRuns}
                onChange={(event) => setBatchRuns(Number(event.target.value))}
                className="w-28 rounded-md border bg-background px-2 py-1 text-sm"
              />
              <Button size="sm" onClick={runBatch} disabled={!currentFloor || selectedSkills.length === 0}>
                对当前层运行批量验证
              </Button>
              <span className="text-xs text-muted-foreground">
                当前层：{currentFloor?.floor ?? "-"}，流派：{state.archetype}
              </span>
            </div>
            {batchSummary ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <Metric label="样本数" value={formatNumber(batchSummary.runCount)} />
                  <Metric label="胜率" value={formatPercent(batchSummary.winRate)} />
                  <Metric label="平均总伤害" value={formatNumber(batchSummary.avgTotalDamage)} />
                  <Metric label="平均启动时间" value={formatSeconds(batchSummary.avgStartupTime)} />
                  <Metric
                    label="平均首杀时间"
                    value={batchSummary.avgFirstKillTime === null ? "无" : formatSeconds(batchSummary.avgFirstKillTime)}
                  />
                  <Metric
                    label="平均剩余血量比"
                    value={formatPercent(batchSummary.avgEnemyRemainingHpRatio)}
                  />
                  <Metric label="平均承伤" value={formatNumber(batchSummary.avgDamageTaken)} />
                  <Metric
                    label="平均资源匮乏率"
                    value={formatPercent(batchSummary.avgResourceStarvedRate)}
                  />
                  <Metric
                    label="平均资源溢出率"
                    value={formatPercent(batchSummary.avgResourceOverflowRate)}
                  />
                </div>
                <div className="rounded-md border bg-background p-2">
                  <p className="text-xs text-muted-foreground">高频诊断趋势</p>
                  {batchSummary.topDiagnosis.length > 0 ? (
                    <div className="mt-1 grid gap-1 text-sm">
                      {batchSummary.topDiagnosis.map((entry) => (
                        <p key={entry.code}>
                          {tDiagnosisCode(entry.code)}：{entry.count} 次（{formatPercent(entry.rate)}）
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">暂无明显共性问题。</p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleFloors.map((floor) => (
          <TowerPressureCard
            key={floor.floor}
            floor={floor}
            unlocked={canChallenge && floor.floor === activeFloor}
            onChallenge={runFloor}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
