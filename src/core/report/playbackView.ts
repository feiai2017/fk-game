import type { BattleReport, BattleTimelineEntry, CombatSnapshot } from "@/core/battle/types";

export interface PlaybackViewModel {
  elapsed: number;
  elapsedLabel: string;
  phaseLabel: string;
  isBossFight: boolean;
  playerHp: number;
  playerHpRatio: number;
  playerShield: number;
  playerEnergy: number;
  playerStateLabel: string;
  enemyHpRatio: number;
  enemyShield: number;
  enemyAliveCount: number;
  summonCount: number;
  mainTargetLabel: string;
  enemyStateLabel: string;
  visibleEvents: BattleTimelineEntry[];
  dotStageLabel: string;
  dotStageHighlighted: boolean;
  targetDotStacks: number;
  dotPressureLabel: string;
  dotAccumulatedDamage: number;
  dotBurstReadiness: number;
  dotWindowHint?: string;
}

export function buildPlaybackView(report: BattleReport, elapsed: number): PlaybackViewModel {
  const safeElapsed = Math.max(0, elapsed);
  const timeline = report.timeline ?? [];
  const visibleEvents = timeline.filter((entry) => entry.time <= safeElapsed).slice(-14);
  const snapshot = pickSnapshot(report.combatSnapshots ?? [], safeElapsed);
  const playerMaxHp = Math.max(1, report.context?.finalStats.hp ?? 1);
  const resourceMax = Math.max(1, report.context?.finalStats.resourceMax ?? 100);

  const bossMechanicAt =
    report.combatEvents?.find((event) => event.type === "BOSS_MECHANIC")?.time ?? Number.POSITIVE_INFINITY;
  const phaseLabel = safeElapsed >= bossMechanicAt ? "Phase 2" : "Phase 1";

  const playerHp = Math.max(0, snapshot?.playerHp ?? playerMaxHp);
  const playerShield = Math.max(0, snapshot?.playerShield ?? 0);
  const playerEnergy = Math.max(0, snapshot?.playerEnergy ?? 0);
  const enemyHpRatio = clamp01(snapshot?.enemyRemainingHpRatio ?? 1);
  const enemyAliveCount = Math.max(0, snapshot?.aliveEnemies ?? report.context?.floor.enemyCount ?? 1);
  const summonCount = estimateSummonCount(report, safeElapsed);
  const mainTarget = resolveMainTarget(report, visibleEvents);
  const dotTelemetry = computeDotTelemetry({
    report,
    elapsed: safeElapsed,
    mainTargetId: mainTarget.id,
    snapshot,
  });

  return {
    elapsed: safeElapsed,
    elapsedLabel: formatBattleClock(safeElapsed),
    phaseLabel,
    isBossFight: report.context?.floor.boss ?? false,
    playerHp,
    playerHpRatio: clamp01(playerHp / playerMaxHp),
    playerShield,
    playerEnergy,
    playerStateLabel: resolvePlayerState({
      playerShield,
      playerEnergyRatio: clamp01(playerEnergy / resourceMax),
      report,
      elapsed: safeElapsed,
      dotStageLabel: dotTelemetry.stageLabel,
    }),
    enemyHpRatio,
    enemyShield: estimateEnemyShield(report, safeElapsed),
    enemyAliveCount,
    summonCount,
    mainTargetLabel: mainTarget.label,
    enemyStateLabel: resolveEnemyState({ report, elapsed: safeElapsed, enemyAliveCount, summonCount }),
    visibleEvents,
    dotStageLabel: dotTelemetry.stageLabel,
    dotStageHighlighted: dotTelemetry.highlighted,
    targetDotStacks: dotTelemetry.targetDotStacks,
    dotPressureLabel: dotTelemetry.dotPressureLabel,
    dotAccumulatedDamage: dotTelemetry.accumulatedDotDamage,
    dotBurstReadiness: dotTelemetry.burstReadiness,
    dotWindowHint: dotTelemetry.windowHint,
  };
}

export function formatBattleClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function pickSnapshot(snapshots: CombatSnapshot[], elapsed: number): CombatSnapshot | undefined {
  if (snapshots.length === 0) {
    return undefined;
  }
  let picked = snapshots[0];
  for (const snapshot of snapshots) {
    if (snapshot.time <= elapsed) {
      picked = snapshot;
      continue;
    }
    break;
  }
  return picked;
}

function resolveMainTarget(
  report: BattleReport,
  visibleEvents: BattleTimelineEntry[],
): {
  id?: number | string;
  label: string;
} {
  const lastVisible = visibleEvents.length > 0 ? visibleEvents[visibleEvents.length - 1] : undefined;
  const event = [...(report.combatEvents ?? [])]
    .filter((entry) => entry.time <= (lastVisible?.time ?? 0))
    .reverse()
    .find((entry) => entry.targetName && (entry.type === "SKILL_CAST" || entry.type === "BASIC_ATTACK" || entry.type === "DOT_BURST"));

  if (event?.targetName) {
    return { id: event.targetId, label: event.targetName };
  }
  if (report.context?.floor.boss) {
    return { label: "首领" };
  }
  return { label: "前排目标" };
}

function estimateSummonCount(report: BattleReport, elapsed: number): number {
  const events = report.combatEvents ?? [];
  const summonAdds = events
    .filter((event) => event.time <= elapsed && event.type === "ENEMY_SUMMON")
    .reduce((sum, event) => sum + Number(event.amount ?? 1), 0);
  const summonDeaths = events
    .filter((event) => event.time <= elapsed && event.type === "ENEMY_KILL" && (event.tags ?? []).includes("summon"))
    .reduce((sum) => sum + 1, 0);
  return Math.max(0, summonAdds - summonDeaths);
}

function estimateEnemyShield(report: BattleReport, elapsed: number): number {
  const events = report.combatEvents ?? [];
  let value = 0;
  for (const event of events) {
    if (event.time > elapsed) {
      break;
    }
    const isEnemySide =
      (event.sourceName ?? "").includes("Boss") ||
      (event.sourceName ?? "").includes("敌") ||
      (event.tags ?? []).includes("enemy");
    if (!isEnemySide) {
      continue;
    }
    if (event.type === "SHIELD_GAIN") {
      value += event.amount ?? 0;
    }
    if (event.type === "SHIELD_LOSS") {
      value -= event.amount ?? 0;
    }
  }
  return Math.max(0, Math.round(value));
}

function resolvePlayerState(input: {
  playerShield: number;
  playerEnergyRatio: number;
  report: BattleReport;
  elapsed: number;
  dotStageLabel: string;
}): string {
  if (input.report.context?.archetype === "dot") {
    return input.dotStageLabel;
  }
  if (input.playerShield > 0) {
    return "护盾维持中";
  }
  if (input.playerEnergyRatio >= 0.72) {
    return "爆发窗口";
  }
  if (input.playerEnergyRatio <= 0.24) {
    return "回能中";
  }
  if (input.elapsed >= input.report.metrics.startupTime) {
    return "循环成型";
  }
  return "循环建立中";
}

function resolveEnemyState(input: {
  report: BattleReport;
  elapsed: number;
  enemyAliveCount: number;
  summonCount: number;
}): string {
  const events = input.report.combatEvents ?? [];
  const hasBossMechanic = events.some(
    (event) => event.type === "BOSS_MECHANIC" && event.time <= input.elapsed,
  );
  const hasRecentCleanse = events.some(
    (event) => event.type === "DOT_CLEANSE" && event.time <= input.elapsed && input.elapsed - event.time <= 2.5,
  );

  if (hasBossMechanic) {
    return "狂怒阶段";
  }
  if (hasRecentCleanse) {
    return "净化刚触发";
  }
  if (input.summonCount > 0) {
    return "召唤压场中";
  }
  if (input.enemyAliveCount > 1) {
    return "敌群压制";
  }
  return "单体对峙";
}

interface ComputeDotTelemetryInput {
  report: BattleReport;
  elapsed: number;
  mainTargetId?: number | string;
  snapshot?: CombatSnapshot;
}

interface DotTelemetry {
  stageLabel: string;
  highlighted: boolean;
  targetDotStacks: number;
  dotPressureLabel: string;
  accumulatedDotDamage: number;
  burstReadiness: number;
  windowHint?: string;
}

function computeDotTelemetry(input: ComputeDotTelemetryInput): DotTelemetry {
  if (input.report.context?.archetype !== "dot") {
    return {
      stageLabel: "循环建立中",
      highlighted: false,
      targetDotStacks: 0,
      dotPressureLabel: "非DOT路线",
      accumulatedDotDamage: 0,
      burstReadiness: 0,
      windowHint: undefined,
    };
  }

  const events = input.report.combatEvents ?? [];
  const targetStacks = new Map<string, number>();
  let accumulatedDotDamage = 0;
  let recentMilestoneAt = Number.NEGATIVE_INFINITY;
  let recentBurstAt = Number.NEGATIVE_INFINITY;
  let recentHarvestAt = Number.NEGATIVE_INFINITY;
  let loopReadyAt = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    if (event.time > input.elapsed) {
      break;
    }

    if (event.type === "DOT_TICK" || event.type === "DOT_BURST") {
      accumulatedDotDamage += event.amount ?? event.value ?? 0;
    }

    if (event.type === "DOT_APPLY" && event.targetId !== undefined) {
      const key = String(event.targetId);
      const stacksAfter = Number(event.metadata?.stacksAfter ?? event.meta?.stacksAfter ?? NaN);
      const stackDelta = Number(event.metadata?.stackDelta ?? event.meta?.stackDelta ?? 1);
      if (Number.isFinite(stacksAfter)) {
        targetStacks.set(key, Math.max(0, Math.round(stacksAfter)));
      } else {
        targetStacks.set(key, Math.max(0, (targetStacks.get(key) ?? 0) + Math.round(stackDelta)));
      }
    }

    if (event.type === "DOT_CLEANSE") {
      if (event.targetId !== undefined) {
        const key = String(event.targetId);
        targetStacks.set(key, Math.max(0, (targetStacks.get(key) ?? 0) - Math.round(event.amount ?? 0)));
      } else {
        targetStacks.clear();
      }
    }

    if (event.type === "ENEMY_KILL" && event.targetId !== undefined) {
      targetStacks.delete(String(event.targetId));
      if ((event.tags ?? []).includes("harvest")) {
        recentHarvestAt = event.time;
      }
    }

    if (event.type === "DOT_BURST") {
      recentBurstAt = event.time;
    }

    if (event.type === "BUFF_GAIN") {
      const tags = event.tags ?? [];
      if (tags.includes("dot_milestone")) {
        recentMilestoneAt = event.time;
      }
      if (tags.includes("dot_loop_ready")) {
        loopReadyAt = event.time;
      }
      if (tags.includes("dot_burst_window")) {
        recentBurstAt = event.time;
      }
    }
  }

  const maxStacks = [...targetStacks.values()].reduce((max, value) => Math.max(max, value), 0);
  const mainTargetStacks =
    input.mainTargetId !== undefined ? targetStacks.get(String(input.mainTargetId)) ?? maxStacks : maxStacks;

  const keyThreshold = 4;
  const burstReadiness = clamp01(mainTargetStacks / keyThreshold);
  const justMilestone = input.elapsed - recentMilestoneAt <= 1.8;
  const inBurstWindow = input.elapsed - recentBurstAt <= 2.2;
  const harvesting = input.elapsed - recentHarvestAt <= 2.2;
  const loopReady =
    Number.isFinite(loopReadyAt) ||
    (input.snapshot ? input.snapshot.dotCoveredEnemies >= 2 && input.elapsed >= input.report.metrics.startupTime : false);

  let stageLabel = "铺层中";
  let windowHint = "先覆盖多目标并堆到关键层数。";
  if (harvesting) {
    stageLabel = "收割中";
    windowHint = "优先点杀残血，快速降低压场。";
  } else if (inBurstWindow) {
    stageLabel = "引爆窗口";
    windowHint = "窗口已开，优先释放引爆/转化技能。";
  } else if (loopReady) {
    stageLabel = "循环成型";
    windowHint = "保持覆盖，等待下一次引爆窗口。";
  }

  const dotPressureLabel =
    mainTargetStacks >= keyThreshold ? "高压持续中" : mainTargetStacks >= 2 ? "持续压制" : mainTargetStacks > 0 ? "低压铺层" : "尚未压制";

  return {
    stageLabel,
    highlighted: justMilestone || inBurstWindow,
    targetDotStacks: mainTargetStacks,
    dotPressureLabel,
    accumulatedDotDamage,
    burstReadiness,
    windowHint,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
