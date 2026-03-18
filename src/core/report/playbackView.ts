import type {
  ArchetypeKey,
  BattleReport,
  BattleTimelineEntry,
  CombatEvent,
  CombatSnapshot,
} from "@/core/battle/types";

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
  stageAlert?: string;
  enemyHpRatio: number;
  enemyShield: number;
  enemyAliveCount: number;
  summonCount: number;
  mainTargetLabel: string;
  enemyStateLabel: string;
  enemyPressureReason: string;
  visibleEvents: BattleTimelineEntry[];
  dotStageLabel: string;
  dotStageHighlighted: boolean;
  targetDotStacks: number;
  dotPressureLabel: string;
  dotAccumulatedDamage: number;
  dotBurstReadiness: number;
  dotWindowHint?: string;
  bossSignalLabel?: string;
  bossSignalSeverity?: "normal" | "warning" | "critical";
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

interface StageContext {
  report: BattleReport;
  elapsed: number;
  playerEnergyRatio: number;
  snapshot?: CombatSnapshot;
  dotTelemetry: DotTelemetry;
  enemyHpRatio: number;
}

export function buildPlaybackView(report: BattleReport, elapsed: number): PlaybackViewModel {
  const safeElapsed = Math.max(0, elapsed);
  const timeline = report.timeline ?? [];
  const visibleEvents = timeline.filter((entry) => entry.time <= safeElapsed).slice(-16);
  const snapshot = pickSnapshot(report.combatSnapshots ?? [], safeElapsed);
  const playerMaxHp = Math.max(1, report.context?.finalStats.hp ?? 1);
  const resourceMax = Math.max(1, report.context?.finalStats.resourceMax ?? 100);

  const phaseSwitchAt =
    report.combatEvents?.find(
      (event) => event.type === "BOSS_MECHANIC" && (event.tags ?? []).includes("phase_shift"),
    )?.time ?? Number.POSITIVE_INFINITY;
  const phaseLabel = safeElapsed >= phaseSwitchAt ? "阶段2" : "阶段1";

  const playerHp = Math.max(0, snapshot?.playerHp ?? playerMaxHp);
  const playerShield = Math.max(0, snapshot?.playerShield ?? 0);
  const playerEnergy = Math.max(0, snapshot?.playerEnergy ?? 0);
  const enemyHpRatio = clamp01(snapshot?.enemyRemainingHpRatio ?? 1);
  const enemyAliveCount = Math.max(0, snapshot?.aliveEnemies ?? report.context?.floor.enemyCount ?? 1);
  const summonCount = estimateSummonCount(report, safeElapsed);
  const mainTarget = resolveMainTarget(report, safeElapsed);
  const dotTelemetry = computeDotTelemetry({
    report,
    elapsed: safeElapsed,
    mainTargetId: mainTarget.id,
    snapshot,
  });
  const bossSignal = resolveBossSignal(report, safeElapsed);

  const stageContext: StageContext = {
    report,
    elapsed: safeElapsed,
    playerEnergyRatio: clamp01(playerEnergy / resourceMax),
    snapshot,
    dotTelemetry,
    enemyHpRatio,
  };

  return {
    elapsed: safeElapsed,
    elapsedLabel: formatBattleClock(safeElapsed),
    phaseLabel,
    isBossFight: report.context?.floor.boss ?? false,
    playerHp,
    playerHpRatio: clamp01(playerHp / playerMaxHp),
    playerShield,
    playerEnergy,
    playerStateLabel: resolvePlayerStage(stageContext),
    stageAlert: resolveStageAlert(stageContext),
    enemyHpRatio,
    enemyShield: estimateEnemyShield(report, safeElapsed),
    enemyAliveCount,
    summonCount,
    mainTargetLabel: mainTarget.label,
    enemyStateLabel: resolveEnemyState({ report, elapsed: safeElapsed, enemyAliveCount, summonCount }),
    enemyPressureReason: resolveEnemyPressureReason({
      report,
      elapsed: safeElapsed,
      enemyAliveCount,
      summonCount,
      enemyHpRatio,
      playerEnergyRatio: stageContext.playerEnergyRatio,
      dotTelemetry,
      bossSignalSeverity: bossSignal.severity,
    }),
    visibleEvents,
    dotStageLabel: dotTelemetry.stageLabel,
    dotStageHighlighted: dotTelemetry.highlighted,
    targetDotStacks: dotTelemetry.targetDotStacks,
    dotPressureLabel: dotTelemetry.dotPressureLabel,
    dotAccumulatedDamage: dotTelemetry.accumulatedDotDamage,
    dotBurstReadiness: dotTelemetry.burstReadiness,
    dotWindowHint: dotTelemetry.windowHint,
    bossSignalLabel: bossSignal.label,
    bossSignalSeverity: bossSignal.severity,
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
  elapsed: number,
): {
  id?: number | string;
  label: string;
} {
  const event = [...(report.combatEvents ?? [])]
    .filter((entry) => entry.time <= elapsed)
    .reverse()
    .find(
      (entry) =>
        entry.targetName &&
        (entry.type === "SKILL_CAST" ||
          entry.type === "BASIC_ATTACK" ||
          entry.type === "DOT_BURST" ||
          entry.type === "ENEMY_HIT"),
    );

  if (event?.targetName) {
    return { id: event.targetId, label: event.targetName };
  }
  if (report.context?.floor.boss) {
    return { label: "首领目标" };
  }
  return { label: "前排目标" };
}

function estimateSummonCount(report: BattleReport, elapsed: number): number {
  const events = report.combatEvents ?? [];
  const summonAdds = events
    .filter((event) => event.time <= elapsed && event.type === "ENEMY_SUMMON")
    .reduce((sum, event) => sum + Number(event.amount ?? 1), 0);
  const summonDeaths = events
    .filter(
      (event) =>
        event.time <= elapsed &&
        event.type === "ENEMY_KILL" &&
        ((event.tags ?? []).includes("summon") || (event.tags ?? []).includes("kill")),
    )
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
      (event.sourceName ?? "").includes("敌人") ||
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

function resolvePlayerStage(input: StageContext): string {
  const archetype = input.report.context?.archetype ?? "dot";
  if (archetype === "dot") {
    return input.dotTelemetry.stageLabel;
  }

  if (archetype === "crit") {
    if (input.enemyHpRatio <= 0.35 || hasRecentEvent(input.report, input.elapsed, 1.4, isCritExecuteEvent)) {
      return "斩杀窗口";
    }
    if (hasRecentEvent(input.report, input.elapsed, 1.6, isCritProcEvent)) {
      return "暴击窗口";
    }
    if (input.elapsed < input.report.metrics.startupTime) {
      return "蓄势中";
    }
    return "收尾推进";
  }

  if (hasRecentEvent(input.report, input.elapsed, 1.4, (event) => event.type === "RESOURCE_OVERFLOW")) {
    return "过载风险";
  }
  if (hasRecentEvent(input.report, input.elapsed, 1.6, (event) => event.type === "PROC_TRIGGER")) {
    return "兑现窗口";
  }
  if (input.playerEnergyRatio >= 0.72) {
    return "资源充盈";
  }
  if (input.elapsed < input.report.metrics.startupTime) {
    return "回路建立中";
  }
  return "回路建立";
}

function resolveStageAlert(input: StageContext): string | undefined {
  const archetype = input.report.context?.archetype ?? "dot";
  if (hasRecentEvent(input.report, input.elapsed, 1.2, isBossPhaseShiftEvent)) {
    return "首领进入新阶段，场压提升";
  }

  if (archetype === "dot") {
    if (input.dotTelemetry.highlighted && input.dotTelemetry.stageLabel === "引爆窗口") {
      return "引爆窗口开启，优先执行转化技能";
    }
    if (hasRecentEvent(input.report, input.elapsed, 1.2, isHarvestKillEvent)) {
      return "收割击杀达成，敌方压力下降";
    }
    return undefined;
  }

  if (archetype === "crit") {
    if (hasRecentEvent(input.report, input.elapsed, 1.2, isCritProcEvent)) {
      return "暴击命中，进入收割节奏";
    }
    if (input.enemyHpRatio <= 0.35) {
      return "目标已入斩杀线，优先终结";
    }
    return undefined;
  }

  if (hasRecentEvent(input.report, input.elapsed, 1.2, (event) => event.type === "RESOURCE_OVERFLOW")) {
    return "资源溢出，尽快转化为伤害";
  }
  if (hasRecentEvent(input.report, input.elapsed, 1.2, (event) => event.type === "PROC_TRIGGER")) {
    return "触发链启动，保持高频兑现";
  }
  return undefined;
}

function resolveEnemyState(input: {
  report: BattleReport;
  elapsed: number;
  enemyAliveCount: number;
  summonCount: number;
}): string {
  const events = input.report.combatEvents ?? [];
  const hasBossRage = events.some(
    (event) =>
      event.type === "BOSS_MECHANIC" &&
      event.time <= input.elapsed &&
      ((event.tags ?? []).includes("phase_shift") || (event.tags ?? []).includes("rage")),
  );
  const hasRecentCleanse = events.some(
    (event) => event.type === "DOT_CLEANSE" && event.time <= input.elapsed && input.elapsed - event.time <= 2.5,
  );

  if (hasBossRage) {
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

function resolveEnemyPressureReason(input: {
  report: BattleReport;
  elapsed: number;
  enemyAliveCount: number;
  summonCount: number;
  enemyHpRatio: number;
  playerEnergyRatio: number;
  dotTelemetry: DotTelemetry;
  bossSignalSeverity?: "normal" | "warning" | "critical";
}): string {
  if (input.bossSignalSeverity === "critical") {
    return "主要压力：首领机制节点";
  }
  if (input.enemyAliveCount >= 4 || input.summonCount >= 2) {
    return "主要压力：敌方数量压制";
  }

  const archetype = input.report.context?.archetype as ArchetypeKey | undefined;
  if (archetype === "dot") {
    if (input.dotTelemetry.targetDotStacks >= 4) {
      return "压制来源：DOT高层持续压血";
    }
    return "当前问题：DOT尚未成型，清场偏慢";
  }

  if (archetype === "crit") {
    if (input.enemyHpRatio <= 0.35) {
      return "压制来源：目标已进入斩杀线";
    }
    return "当前问题：中段暴击节奏不稳";
  }

  if (hasRecentEvent(input.report, input.elapsed, 1.8, (event) => event.type === "RESOURCE_OVERFLOW")) {
    return "当前问题：资源溢出，价值未兑现";
  }
  if (input.playerEnergyRatio >= 0.75) {
    return "压制来源：高资源循环推进中";
  }
  return "当前问题：回路尚未完全建立";
}

function computeDotTelemetry(input: {
  report: BattleReport;
  elapsed: number;
  mainTargetId?: number | string;
  snapshot?: CombatSnapshot;
}): DotTelemetry {
  if (input.report.context?.archetype !== "dot") {
    return {
      stageLabel: "非DOT路线",
      highlighted: false,
      targetDotStacks: 0,
      dotPressureLabel: "无DOT压制",
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
    (input.snapshot
      ? input.snapshot.dotCoveredEnemies >= 2 && input.elapsed >= input.report.metrics.startupTime
      : false);

  let stageLabel = "铺层中";
  let windowHint = "优先覆盖多个目标并堆到关键层数";
  if (harvesting) {
    stageLabel = "收割中";
    windowHint = "优先点杀残血，快速降低场压";
  } else if (inBurstWindow) {
    stageLabel = "引爆窗口";
    windowHint = "窗口已开，优先释放引爆或转化技能";
  } else if (loopReady) {
    stageLabel = "循环成型";
    windowHint = "保持覆盖，等待下一次引爆窗口";
  }

  const dotPressureLabel =
    mainTargetStacks >= keyThreshold
      ? "高压持续中"
      : mainTargetStacks >= 2
        ? "持续压制"
        : mainTargetStacks > 0
          ? "低压铺层"
          : "尚未压制";

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

function resolveBossSignal(
  report: BattleReport,
  elapsed: number,
): { label?: string; severity?: "normal" | "warning" | "critical" } {
  if (!report.context?.floor.boss) {
    return {};
  }
  const events = report.combatEvents ?? [];
  const latestBossEvent = [...events]
    .filter((event) => event.time <= elapsed && ((event.tags ?? []).includes("boss") || event.type === "BOSS_MECHANIC"))
    .reverse()[0];

  if (!latestBossEvent) {
    return { label: "首领持续施压", severity: "normal" };
  }

  if (latestBossEvent.type === "BOSS_MECHANIC" && (latestBossEvent.tags ?? []).includes("entry")) {
    return { label: "首领登场", severity: "warning" };
  }
  if (latestBossEvent.type === "BOSS_MECHANIC" && (latestBossEvent.tags ?? []).includes("phase_shift")) {
    return { label: "首领转阶段", severity: "critical" };
  }
  if (latestBossEvent.type === "ENEMY_HEAVY_HIT" && (latestBossEvent.tags ?? []).includes("boss_skill")) {
    return { label: "首领关键技能命中", severity: "critical" };
  }
  if (latestBossEvent.type === "ENEMY_SUMMON") {
    return { label: "首领召唤增压", severity: "warning" };
  }
  if (latestBossEvent.type === "ENEMY_KILL" && (latestBossEvent.tags ?? []).includes("boss")) {
    return { label: "首领被击败", severity: "critical" };
  }
  return { label: "首领机制运转中", severity: "normal" };
}

function hasRecentEvent(
  report: BattleReport,
  elapsed: number,
  seconds: number,
  predicate: (event: CombatEvent) => boolean,
): boolean {
  const events = report.combatEvents ?? [];
  const from = Math.max(0, elapsed - Math.max(seconds, 0));
  return events.some((event) => event.time >= from && event.time <= elapsed && predicate(event));
}

function isBossPhaseShiftEvent(event: CombatEvent): boolean {
  return event.type === "BOSS_MECHANIC" && (event.tags ?? []).includes("phase_shift");
}

function isHarvestKillEvent(event: CombatEvent): boolean {
  return event.type === "ENEMY_KILL" && (event.tags ?? []).includes("harvest");
}

function isCritProcEvent(event: CombatEvent): boolean {
  return (
    event.type === "SKILL_CAST" &&
    ((event.tags ?? []).includes("crit") || ((event.sourceName ?? "").includes("处决") && event.amount !== undefined))
  );
}

function isCritExecuteEvent(event: CombatEvent): boolean {
  return event.type === "ENEMY_KILL" && ((event.sourceName ?? "").includes("处决") || (event.tags ?? []).includes("finisher"));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

