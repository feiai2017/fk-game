import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InBattleScreen } from "@/components/battle/InBattleScreen";
import { PostBattleScreen } from "@/components/battle/PostBattleScreen";
import { PreBattleScreen } from "@/components/battle/PreBattleScreen";
import type { BattleReport, RunRewardOption } from "@/core/battle/types";
import { buildDemoBuildSummary } from "@/core/build/demoBuildSummary";
import { buildPlaybackView } from "@/core/report/playbackView";
import { buildFloorPreview } from "@/core/tower/floorPreview";
import { TOWER_FLOORS } from "@/data/tower";
import { useGameState } from "@/hooks/useGameState";

type BattleScreenState = "preparing" | "battling" | "resolved";

export function RunPage(): JSX.Element {
  const navigate = useNavigate();
  const { state, continueRun, selectRunReward, startNewRun } = useGameState();

  const [screenState, setScreenState] = useState<BattleScreenState>(
    state.lastReport ? "resolved" : "preparing",
  );
  const [activeReport, setActiveReport] = useState<BattleReport | undefined>(state.lastReport);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [showDetailRecap, setShowDetailRecap] = useState(false);
  const [recentReward, setRecentReward] = useState<
    | {
        title: string;
        summary: string;
        routeHint?: string;
      }
    | undefined
  >(undefined);

  const canStart = state.run.status === "in_progress" && !state.run.isOver;
  const rewardPending = state.run.status === "reward_pending" && activeReport?.win;

  const currentFloor = useMemo(
    () => TOWER_FLOORS.find((entry) => entry.floor === state.run.currentFloor),
    [state.run.currentFloor],
  );
  const floorPreview = useMemo(
    () => (currentFloor ? buildFloorPreview(currentFloor) : undefined),
    [currentFloor],
  );

  const buildSummary = useMemo(
    () =>
      buildDemoBuildSummary({
        archetype: state.archetype,
        skillIds: state.loadout.skillIds,
        progress: state.run.progress,
      }),
    [state.archetype, state.loadout.skillIds, state.run.progress],
  );

  const strengths = useMemo(() => {
    if (!state.lastReport?.recap) {
      return [];
    }
    const rows: string[] = [];
    if (state.lastReport.win) {
      rows.push(state.lastReport.recap.keyWinOrFailPoint);
    }
    if ((state.lastReport.metrics.firstKillTime ?? 99) <= 10) {
      rows.push("首杀节奏较快，前期压制力尚可");
    }
    return rows.slice(0, 2);
  }, [state.lastReport]);

  const weaknesses = useMemo(() => {
    if (!state.lastReport) {
      return [];
    }
    const rows: string[] = [];
    if (!state.lastReport.win) {
      rows.push(state.lastReport.recap?.reasonSummary ?? state.lastReport.diagnosis[0]?.message ?? "上次挑战失败");
    }
    if ((state.lastReport.metrics.firstKillTime ?? 0) > 12) {
      rows.push("首杀偏慢，清杂节奏可能不足");
    }
    if (state.lastReport.metrics.enemyRemainingHpRatio > 0.35) {
      rows.push("后段收尾不足，残血目标处理偏慢");
    }
    return rows.slice(0, 2);
  }, [state.lastReport]);

  const playback = useMemo(
    () => (activeReport ? buildPlaybackView(activeReport, playbackTime) : undefined),
    [activeReport, playbackTime],
  );

  const rewardNote = useMemo(() => {
    if (!activeReport?.win) {
      return "失败无奖励。";
    }
    if (rewardPending) {
      return "已掉落3选1奖励，选择后立即生效。";
    }
    const selected = [...state.run.progress.selectedRewards]
      .reverse()
      .find((entry) => entry.floor === activeReport.floor)?.title;
    return selected ? `已选择奖励：${selected}` : "本层奖励记录暂不可用。";
  }, [activeReport, rewardPending, state.run.progress.selectedRewards]);

  useEffect(() => {
    if (screenState !== "battling" || !activeReport || paused) {
      return;
    }
    const tickMs = 120;
    const timer = window.setInterval(() => {
      setPlaybackTime((prev) => {
        const next = prev + (tickMs / 1000) * playbackSpeed;
        return Math.min(activeReport.metrics.duration, next);
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [activeReport, paused, playbackSpeed, screenState]);

  useEffect(() => {
    if (screenState !== "battling" || !activeReport) {
      return;
    }
    if (playbackTime < activeReport.metrics.duration) {
      return;
    }
    const timer = window.setTimeout(() => {
      setScreenState("resolved");
      setPaused(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [activeReport, playbackTime, screenState]);

  const handleStartBattle = () => {
    const report = continueRun();
    if (!report) {
      return;
    }
    setActiveReport(report);
    setRecentReward(undefined);
    setPlaybackTime(0);
    setPlaybackSpeed(1);
    setPaused(false);
    setShowDetailRecap(false);
    setScreenState("battling");
  };

  const handleSkipPlayback = () => {
    if (!activeReport) {
      return;
    }
    setPlaybackTime(activeReport.metrics.duration);
    setScreenState("resolved");
    setPaused(false);
  };

  const handlePrepareNext = () => {
    setScreenState("preparing");
    setShowDetailRecap(false);
    setPaused(false);
    setPlaybackTime(0);
  };

  const handleRestart = () => {
    startNewRun();
    setActiveReport(undefined);
    setRecentReward(undefined);
    setScreenState("preparing");
    setPlaybackTime(0);
    setPlaybackSpeed(1);
    setPaused(false);
    setShowDetailRecap(false);
  };

  const handleSelectReward = (optionId: string) => {
    const selected = state.run.pendingRewards?.find((entry) => entry.id === optionId);
    selectRunReward(optionId);
    if (selected) {
      setRecentReward({
        title: selected.title,
        summary: buildRewardAppliedSummary(selected),
        routeHint: selected.routeHint,
      });
    }
    setScreenState("preparing");
    setShowDetailRecap(false);
  };

  if (screenState === "preparing") {
    return (
      <PreBattleScreen
        floorPreview={floorPreview}
        buildSummary={buildSummary}
        recentReward={recentReward}
        canStart={canStart}
        strengths={strengths}
        weaknesses={weaknesses}
        onStartBattle={handleStartBattle}
        onOpenBuild={() => navigate("/build")}
        onOpenReport={() => navigate("/report")}
      />
    );
  }

  if (screenState === "battling" && activeReport && playback) {
    return (
      <InBattleScreen
        report={activeReport}
        playback={playback}
        status={paused ? "暂停" : "进行中"}
        speed={playbackSpeed}
        canPause={!paused}
        onTogglePause={() => setPaused((value) => !value)}
        onSetSpeed={setPlaybackSpeed}
        onSkip={handleSkipPlayback}
      />
    );
  }

  if (screenState === "resolved" && activeReport) {
    return (
      <PostBattleScreen
        report={activeReport}
        rewardPending={Boolean(rewardPending)}
        pendingRewards={state.run.pendingRewards}
        rewardNote={rewardNote}
        showDetails={showDetailRecap}
        onToggleDetails={() => setShowDetailRecap((value) => !value)}
        onSelectReward={handleSelectReward}
        onRetry={handleRestart}
        onBackBuild={() => navigate("/build")}
        onPrepareNext={handlePrepareNext}
        onOpenRunSummary={() => navigate("/run-summary")}
        runEnded={state.run.isOver}
      />
    );
  }

  return (
    <PreBattleScreen
      floorPreview={floorPreview}
      buildSummary={buildSummary}
      recentReward={recentReward}
      canStart={canStart}
      strengths={strengths}
      weaknesses={weaknesses}
      onStartBattle={handleStartBattle}
      onOpenBuild={() => navigate("/build")}
      onOpenReport={() => navigate("/report")}
    />
  );
}

function buildRewardAppliedSummary(option: RunRewardOption): string {
  const effects: string[] = [];
  const stats = option.effect.stats;
  if (stats) {
    if ((stats.dotPower ?? 0) > 0) {
      effects.push(`DOT+${Math.round((stats.dotPower ?? 0) * 100)}%`);
    }
    if ((stats.crit ?? 0) > 0) {
      effects.push(`暴击+${Math.round((stats.crit ?? 0) * 100)}%`);
    }
    if ((stats.procPower ?? 0) > 0) {
      effects.push(`触发+${Math.round((stats.procPower ?? 0) * 100)}%`);
    }
    if ((stats.resourceRegen ?? 0) > 0) {
      effects.push(`回能+${(stats.resourceRegen ?? 0).toFixed(1)}`);
    }
    if ((stats.hp ?? 0) > 0) {
      effects.push(`生命+${Math.round(stats.hp ?? 0)}`);
    }
    if ((stats.cdr ?? 0) > 0) {
      effects.push(`冷却-${Math.round((stats.cdr ?? 0) * 100)}%`);
    }
  }
  if (option.effect.skillUpgrade) {
    effects.push(`技能强化：${option.effect.skillUpgrade.skillId}`);
  }
  if (option.effect.passiveEffect) {
    effects.push(`机制：${option.effect.passiveEffect.id}`);
  }
  if (effects.length <= 0) {
    return option.description;
  }
  return `已生效：${effects.slice(0, 3).join("，")}`;
}
