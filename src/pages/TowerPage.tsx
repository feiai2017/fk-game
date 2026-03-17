import { Link } from "react-router-dom";
import { useMemo } from "react";
import { BattleSummaryCard } from "@/components/battle/BattleSummaryCard";
import { FloorGoalCard } from "@/components/battle/FloorGoalCard";
import { FloorPreviewCard } from "@/components/battle/FloorPreviewCard";
import { TowerPressureCard } from "@/components/battle/TowerPressureCard";
import { buildFloorGuidance } from "@/core/tower/floorGuidance";
import { buildFloorPreview } from "@/core/tower/floorPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_RUN_TARGET_FLOOR } from "@/data/constants";
import { TOWER_FLOORS } from "@/data/tower";
import { useGameState } from "@/hooks/useGameState";

export function TowerPage(): JSX.Element {
  const { state, runFloor, continueRun, startNewRun } = useGameState();

  const activeFloor = state.run.currentFloor;
  const currentFloor = useMemo(
    () => TOWER_FLOORS.find((floor) => floor.floor === activeFloor),
    [activeFloor],
  );
  const currentFloorGuidance = useMemo(
    () => (currentFloor ? buildFloorGuidance(currentFloor) : undefined),
    [currentFloor],
  );
  const currentFloorPreview = useMemo(
    () => (currentFloor ? buildFloorPreview(currentFloor) : undefined),
    [currentFloor],
  );

  const canBattle = state.run.status === "in_progress" && !state.run.isOver;
  const pendingReward = state.run.status === "reward_pending";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>爬塔流程（最小奖励版）</span>
            <Badge variant="outline">
              第 {activeFloor} / {DEMO_RUN_TARGET_FLOOR} 层
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            流程：开始新局 → 战斗 → 胜利后三选一奖励 → 下一层；失败则本局结束。
          </p>
          <p>
            当前状态：
            <span className="font-semibold">
              {canBattle ? "可战斗" : pendingReward ? "待选奖励" : "已结束"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {canBattle ? (
              <Button size="sm" onClick={continueRun}>
                开始战斗（当前层）
              </Button>
            ) : pendingReward ? (
              <Button asChild size="sm">
                <Link to="/report">去选择奖励</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={startNewRun}>
                开始新局
              </Button>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link to="/build">返回构筑</Link>
            </Button>
            {state.lastReport ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/report">查看战报</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {currentFloorPreview ? <FloorPreviewCard preview={currentFloorPreview} /> : null}

      {currentFloor && currentFloorGuidance ? (
        <FloorGoalCard floor={currentFloor} guidance={currentFloorGuidance} />
      ) : null}

      <BattleSummaryCard report={state.lastReport} />

      {currentFloor ? (
        <TowerPressureCard floor={currentFloor} unlocked={canBattle} onChallenge={runFloor} />
      ) : null}
    </div>
  );
}
