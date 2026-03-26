import { useMemo } from "react";
import type {
  BattleReport,
  BattleTimelineEntry,
  CombatEvent,
  EnemyTemplateKey,
  FloorEnemyUnit,
} from "@/core/battle/types";
import type { PlaybackViewModel } from "@/core/report/playbackView";
import { tSkillId } from "@/lib/i18n";

type FocusSide = "player" | "enemy";
type EnemyRole = "boss" | "elite" | "normal" | "summon";
type EnemySize = "xl" | "lg" | "md" | "sm";
type ActionKind =
  | "single"
  | "aoe"
  | "dot"
  | "burst"
  | "spread"
  | "cleanse"
  | "summon"
  | "kill"
  | "phase"
  | "enemyAttack"
  | "other";

interface InternalEnemyState {
  id: number;
  key: string;
  name: string;
  template: EnemyTemplateKey | "summon";
  role: EnemyRole;
  hpMax: number;
  hpCurrent: number;
  shield: number;
  dotStacks: number;
  alive: boolean;
  lastHitAt?: number;
  summonedAt?: number;
  deathAt?: number;
}

export interface DirectedAction {
  key: string;
  startAt: number;
  endAt: number;
  actorSide: FocusSide;
  actorLabel: string;
  actorEnemyId?: number;
  title: string;
  summary: string;
  tags: string[];
  targetSide: FocusSide;
  targetLabel: string;
  targetEnemyIds: number[];
  targetLabels: string[];
  activeSkillId?: string;
  kind: ActionKind;
}

export interface TurnOrderItem {
  key: string;
  label: string;
  side: FocusSide;
  current: boolean;
}

export interface FloatingTextItem {
  key: string;
  side: FocusSide;
  tone: "damage" | "dot" | "heal" | "shield" | "system";
  text: string;
}

export interface EnemyFormationUnit {
  key: string;
  id: number;
  name: string;
  role: EnemyRole;
  size: EnemySize;
  x: number;
  y: number;
  hpCurrent: number;
  hpMax: number;
  hpRatio: number;
  shield: number;
  statuses: string[];
  acting: boolean;
  targeted: boolean;
  justHit: boolean;
  justSummoned: boolean;
  justDefeated: boolean;
  alive: boolean;
}

export interface ActionLink {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone: "single" | "aoe" | "spread" | "danger";
}

export interface BattlePresentationModel {
  activeAction: DirectedAction;
  turnOrder: TurnOrderItem[];
  ticker: BattleTimelineEntry[];
  detailFeed: BattleTimelineEntry[];
  floatingTexts: FloatingTextItem[];
  recommendedSkillId?: string;
  enemyUnits: EnemyFormationUnit[];
  actionLinks: ActionLink[];
}

export interface StatusBadgeModel {
  visible: string[];
  overflow: number;
}

const ACTION_WINDOW_SECONDS = 0.14;
const PRIMARY_TYPES = new Set([
  "SKILL_CAST",
  "DOT_BURST",
  "ENEMY_HEAVY_HIT",
  "ENEMY_HIT",
  "ENEMY_SUMMON",
  "BOSS_MECHANIC",
  "ENEMY_KILL",
  "DOT_CLEANSE",
]);

export function useBattlePresentation(input: {
  report: BattleReport;
  playback: PlaybackViewModel;
  speed: 1 | 2;
}): BattlePresentationModel {
  const { report, playback, speed } = input;

  return useMemo(() => {
    const events = (report.combatEvents ?? []).filter((event) => event.time <= playback.elapsed);
    const directedTimeline = buildDirectedTimeline(events, report, speed);
    const activeAction = resolveActiveAction(directedTimeline, events, report, playback.elapsed);

    const enemyStates = buildEnemyStates(report, events, playback.elapsed);
    const enemyUnits = buildEnemyFormation(enemyStates, activeAction, playback.elapsed);

    return {
      activeAction,
      turnOrder: buildTurnOrder(events, activeAction, report),
      ticker: buildLiveTicker(events, playback.elapsed),
      detailFeed: buildDetailFeed(events, playback.elapsed),
      floatingTexts: buildFloatingTexts(events, playback.elapsed),
      recommendedSkillId: resolveRecommendedSkillId(events, playback.elapsed),
      enemyUnits,
      actionLinks: buildActionLinks(activeAction, enemyUnits),
    };
  }, [report, playback, speed]);
}

export function derivePriorityStatusBadges(values: string[], max = 5): StatusBadgeModel {
  const clean = values
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index);

  const sorted = clean
    .map((entry) => ({ entry, score: statusScore(entry) }))
    .sort((a, b) => b.score - a.score || a.entry.localeCompare(b.entry, "zh-Hans-CN"));

  return {
    visible: sorted.slice(0, max).map((item) => item.entry),
    overflow: Math.max(0, sorted.length - max),
  };
}

function statusScore(status: string): number {
  if (status.includes("当前行动")) return 120;
  if (status.includes("当前目标")) return 118;
  if (status.includes("Boss")) return 116;
  if (status.includes("阶段")) return 112;
  if (status.includes("引爆")) return 110;
  if (status.includes("收割")) return 106;
  if (status.includes("DOT")) return 102;
  if (status.includes("危险")) return 98;
  if (status.includes("净化")) return 94;
  if (status.includes("召唤")) return 92;
  return 70;
}

function buildDirectedTimeline(events: CombatEvent[], report: BattleReport, speed: 1 | 2): DirectedAction[] {
  const primaryEvents = events.filter((event) => isPrimaryEvent(event) && !isMinorEvent(event));
  const rows: DirectedAction[] = [];
  let cursor = 0;
  const maxLag = speed === 1 ? 0.95 : 0.58;

  for (const event of primaryEvents) {
    const related = collectRelatedEvents(events, event);
    const action = eventToAction(event, related, report);
    const duration = calcActionDuration(action.kind, speed);
    if (cursor - event.time > maxLag) {
      cursor = event.time + maxLag;
    }
    const startAt = Math.max(event.time, cursor);
    const endAt = startAt + duration;
    cursor = endAt;
    rows.push({ ...action, startAt, endAt });
  }
  return rows;
}

function resolveActiveAction(
  directedTimeline: DirectedAction[],
  events: CombatEvent[],
  report: BattleReport,
  elapsed: number,
): DirectedAction {
  const inWindow = [...directedTimeline]
    .reverse()
    .find((row) => row.startAt <= elapsed && elapsed < row.endAt);
  if (inWindow) return inWindow;

  const fromRecentEvent = buildLiveActionFromRecentEvent(events, elapsed, report);
  if (fromRecentEvent) return fromRecentEvent;

  return [...directedTimeline].reverse().find((row) => row.startAt <= elapsed) ?? buildFallbackAction(report, elapsed);
}

function buildLiveActionFromRecentEvent(
  events: CombatEvent[],
  elapsed: number,
  report: BattleReport,
): DirectedAction | undefined {
  const event = [...events]
    .reverse()
    .find((row) => row.time <= elapsed && row.time >= Math.max(0, elapsed - 1.4) && isLiveActionEvent(row));
  if (!event) return undefined;

  const action = eventToAction(event, [event], report);
  return {
    ...action,
    startAt: event.time,
    endAt: Math.max(event.time + 0.5, elapsed + 0.05),
  };
}

function isLiveActionEvent(event: CombatEvent): boolean {
  return (
    event.type === "SKILL_CAST" ||
    event.type === "DOT_BURST" ||
    event.type === "DOT_TICK" ||
    event.type === "BASIC_ATTACK" ||
    event.type === "ENEMY_HIT" ||
    event.type === "ENEMY_HEAVY_HIT" ||
    event.type === "ENEMY_SUMMON" ||
    event.type === "BOSS_MECHANIC" ||
    event.type === "ENEMY_KILL"
  );
}

function collectRelatedEvents(events: CombatEvent[], primary: CombatEvent): CombatEvent[] {
  if (primary.type === "SKILL_CAST" && (primary.tags ?? []).includes("cast")) {
    return events.filter((event) => {
      if (event.time < primary.time || event.time > primary.time + ACTION_WINDOW_SECONDS) return false;
      if (event.sourceId !== primary.sourceId) return false;
      return (
        event.type === "SKILL_CAST" ||
        event.type === "DOT_APPLY" ||
        event.type === "DOT_BURST" ||
        event.type === "ENEMY_KILL" ||
        event.type === "PROC_TRIGGER"
      );
    });
  }

  return events.filter((event) => {
    if (event.time < primary.time || event.time > primary.time + ACTION_WINDOW_SECONDS) return false;
    if (event.type !== primary.type) return false;
    if (primary.sourceId && event.sourceId !== primary.sourceId) return false;
    return true;
  });
}

function eventToAction(primary: CombatEvent, related: CombatEvent[], report: BattleReport): Omit<DirectedAction, "startAt" | "endAt"> {
  const actorSide = inferActorSide(primary);
  const kind = resolveActionKind(primary, related);
  const group = related.length > 0 ? related : [primary];
  const targetEnemyIds = collectTargetEnemyIds(group);
  const targetLabels = collectTargetLabels(group);
  const targetSide: FocusSide = actorSide === "player" ? "enemy" : "player";

  return {
    key: `${primary.time}-${primary.type}-${primary.sourceId ?? primary.sourceName ?? "none"}`,
    actorSide,
    actorLabel: resolveActorLabel(primary, actorSide),
    actorEnemyId: actorSide === "enemy" ? parseEnemyId(primary) : undefined,
    title: resolveActionTitle(primary),
    summary: deriveActionSummary(primary, group),
    tags: resolveActionTags(primary, group),
    targetSide,
    targetLabel: resolveTargetDisplayLabel(targetSide, targetLabels, report),
    targetEnemyIds,
    targetLabels,
    activeSkillId: primary.type === "SKILL_CAST" ? primary.sourceId : undefined,
    kind,
  };
}

function deriveActionSummary(primary: CombatEvent, related: CombatEvent[]): string {
  const targets = collectTargetLabels(related);
  const damageTotal = Math.round(
    related
      .filter((event) => isDamageToEnemyEvent(event) || event.type === "ENEMY_HIT" || event.type === "ENEMY_HEAVY_HIT")
      .reduce((sum, event) => sum + Number(event.amount ?? event.value ?? 0), 0),
  );
  const killCount = related.filter((event) => event.type === "ENEMY_KILL").length;

  if (primary.type === "ENEMY_SUMMON") {
    const count = Math.max(1, Math.round(Number(primary.amount ?? 1)));
    return `召唤增援 x${count}`;
  }
  if (primary.type === "BOSS_MECHANIC") {
    return "Boss 机制触发，战场压力上升";
  }
  if (primary.type === "DOT_CLEANSE") {
    const stacks = Math.max(1, Math.round(Number(primary.amount ?? 1)));
    return `净化移除 ${stacks} 层 DOT`;
  }
  if (killCount > 0) {
    return killCount === 1 ? "完成击杀" : `完成 ${killCount} 次击杀`;
  }
  if (targets.length > 1 && damageTotal > 0) {
    return `命中 ${targets.length} 个目标，总伤害 ${damageTotal}`;
  }
  if (damageTotal > 0 && targets.length > 0) {
    return `命中 ${targets[0]}，造成 ${damageTotal}`;
  }
  return primary.summary;
}

function calcActionDuration(kind: ActionKind, speed: 1 | 2): number {
  const base =
    kind === "phase" || kind === "summon"
      ? 0.96
      : kind === "kill" || kind === "burst"
        ? 0.9
        : kind === "enemyAttack"
          ? 0.82
          : 0.76;
  return speed === 1 ? base : Math.max(0.42, base * 0.62);
}

function buildFallbackAction(report: BattleReport, elapsed: number): DirectedAction {
  return {
    key: `fallback-${elapsed}`,
    startAt: 0,
    endAt: Number.MAX_SAFE_INTEGER,
    actorSide: "player",
    actorLabel: "我方主角",
    title: "等待下一次动作",
    summary: "自动战斗进行中，正在寻找下一次技能窗口。",
    tags: ["观战中"],
    targetSide: "enemy",
    targetLabel: report.context?.floor.boss ? "首领目标" : "敌方主目标",
    targetEnemyIds: [],
    targetLabels: [],
    kind: "other",
  };
}

function buildEnemyStates(report: BattleReport, events: CombatEvent[], elapsed: number): InternalEnemyState[] {
  const baseUnits = report.context?.floor.enemyUnits ?? [];
  const avgHp =
    baseUnits.length > 0
      ? baseUnits.reduce((sum, unit) => sum + unit.hp, 0) / baseUnits.length
      : Math.max(1, report.context?.floor.enemyHp ?? 1000);
  const states = new Map<number, InternalEnemyState>();

  for (const unit of baseUnits) states.set(unit.id, mapFloorUnit(unit));

  const ensure = (enemyId: number, name?: string): InternalEnemyState => {
    const existing = states.get(enemyId);
    if (existing) {
      if (name && existing.name.startsWith("敌人")) existing.name = name;
      return existing;
    }
    const created: InternalEnemyState = {
      id: enemyId,
      key: `enemy-${enemyId}`,
      name: name ?? `敌人${enemyId}`,
      template: "summon",
      role: "summon",
      hpMax: Math.max(1, Math.round(avgHp * 0.52)),
      hpCurrent: Math.max(1, Math.round(avgHp * 0.52)),
      shield: 0,
      dotStacks: 0,
      alive: true,
    };
    states.set(enemyId, created);
    return created;
  };

  for (const event of events) {
    const enemyId = parseEnemyId(event);
    if (enemyId === undefined) continue;
    const target = ensure(enemyId, event.targetName);

    if (event.type === "ENEMY_SUMMON") {
      target.role = target.role === "boss" ? "boss" : "summon";
      target.template = "summon";
      target.alive = true;
      target.summonedAt = event.time;
      target.hpCurrent = Math.max(1, target.hpCurrent);
    }

    if (isDamageToEnemyEvent(event)) {
      const amount = Math.max(0, Number(event.amount ?? event.value ?? 0));
      target.hpCurrent = Math.max(0, target.hpCurrent - amount);
      target.lastHitAt = event.time;
      if (target.hpCurrent <= 0.1) target.alive = false;
    }

    if (event.type === "SHIELD_GAIN") target.shield += Math.max(0, Number(event.amount ?? 0));
    if (event.type === "SHIELD_LOSS") target.shield = Math.max(0, target.shield - Math.max(0, Number(event.amount ?? 0)));

    if (event.type === "DOT_APPLY") {
      const stacksAfter = Number(event.metadata?.stacksAfter ?? event.meta?.stacksAfter ?? NaN);
      if (Number.isFinite(stacksAfter)) {
        target.dotStacks = Math.max(0, Math.round(stacksAfter));
      } else {
        target.dotStacks += Math.max(1, Math.round(Number(event.metadata?.stackDelta ?? event.meta?.stackDelta ?? 1)));
      }
    }
    if (event.type === "DOT_CLEANSE") {
      const removed = Math.max(0, Math.round(Number(event.amount ?? 0)));
      target.dotStacks = Math.max(0, target.dotStacks - removed);
    }
    if (event.type === "ENEMY_KILL") {
      target.hpCurrent = 0;
      target.alive = false;
      target.deathAt = event.time;
    }
  }

  return [...states.values()]
    .filter((state) => state.alive || (state.deathAt !== undefined && elapsed - state.deathAt <= 0.9))
    .sort((a, b) => roleOrder(b.role) - roleOrder(a.role) || a.id - b.id);
}

function buildEnemyFormation(states: InternalEnemyState[], activeAction: DirectedAction, elapsed: number): EnemyFormationUnit[] {
  if (states.length === 0) return [];
  const placements = resolveEnemyFormationLayout(states, activeAction.targetEnemyIds);

  return placements.map((placement) => {
    const targeted = activeAction.targetEnemyIds.includes(placement.state.id);
    const acting =
      activeAction.actorSide === "enemy" &&
      activeAction.actorEnemyId !== undefined &&
      activeAction.actorEnemyId === placement.state.id;
    const statuses = [
      placement.state.role === "boss" ? "Boss" : placement.state.role === "summon" ? "召唤物" : "敌方单位",
      placement.state.dotStacks > 0 ? `DOT ${placement.state.dotStacks}` : "",
      placement.state.shield > 0 ? "护盾中" : "",
    ].filter(Boolean);

    return {
      key: placement.state.key,
      id: placement.state.id,
      name: placement.state.name,
      role: placement.state.role,
      size: placement.size,
      x: placement.x,
      y: placement.y,
      hpCurrent: Math.max(0, Math.round(placement.state.hpCurrent)),
      hpMax: Math.max(1, Math.round(placement.state.hpMax)),
      hpRatio: clamp01(placement.state.hpCurrent / Math.max(1, placement.state.hpMax)),
      shield: Math.max(0, Math.round(placement.state.shield)),
      statuses,
      acting,
      targeted,
      justHit: placement.state.lastHitAt !== undefined && elapsed - placement.state.lastHitAt <= 0.28,
      justSummoned: placement.state.summonedAt !== undefined && elapsed - placement.state.summonedAt <= 0.55,
      justDefeated: placement.state.deathAt !== undefined && elapsed - placement.state.deathAt <= 0.55,
      alive: placement.state.alive,
    };
  });
}

function resolveEnemyFormationLayout(
  states: InternalEnemyState[],
  targetIds: number[],
): Array<{ state: InternalEnemyState; x: number; y: number; size: EnemySize }> {
  const ordered = [...states].sort((a, b) => {
    const aTarget = targetIds.includes(a.id) ? 1 : 0;
    const bTarget = targetIds.includes(b.id) ? 1 : 0;
    return bTarget - aTarget || roleOrder(b.role) - roleOrder(a.role) || a.id - b.id;
  });

  const count = ordered.length;
  const hasBoss = ordered.some((state) => state.role === "boss");

  if (count === 1) return [{ state: ordered[0], x: 70, y: 52, size: "xl" }];

  if (hasBoss) {
    const boss = ordered.find((state) => state.role === "boss") ?? ordered[0];
    const others = ordered.filter((state) => state.id !== boss.id);
    const rows: Array<{ state: InternalEnemyState; x: number; y: number; size: EnemySize }> = [{ state: boss, x: 66, y: 52, size: "xl" }];
    const slots = [
      { x: 86, y: 30, size: "sm" as EnemySize },
      { x: 86, y: 50, size: "sm" as EnemySize },
      { x: 86, y: 70, size: "sm" as EnemySize },
      { x: 78, y: 78, size: "sm" as EnemySize },
    ];
    others.forEach((state, index) => {
      const slot = slots[index] ?? { x: 84, y: 24 + index * 14, size: "sm" as EnemySize };
      rows.push({ state, x: slot.x, y: slot.y, size: slot.size });
    });
    return rows;
  }

  if (count === 3) {
    return [
      { state: ordered[0], x: 66, y: 48, size: "lg" },
      { state: ordered[1], x: 84, y: 34, size: "md" },
      { state: ordered[2], x: 84, y: 66, size: "md" },
    ];
  }

  if (count >= 5) {
    const slots = [
      { x: 66, y: 38, size: "lg" as EnemySize },
      { x: 66, y: 68, size: "md" as EnemySize },
      { x: 84, y: 24, size: "sm" as EnemySize },
      { x: 84, y: 50, size: "sm" as EnemySize },
      { x: 84, y: 76, size: "sm" as EnemySize },
    ];
    return ordered.slice(0, 5).map((state, index) => ({ state, ...slots[index] }));
  }

  return ordered.map((state, index) => ({
    state,
    x: index === 0 ? 66 : 84,
    y: index === 0 ? 52 : index === 1 ? 36 : 68,
    size: index === 0 ? "lg" : "md",
  }));
}

function buildActionLinks(action: DirectedAction, enemyUnits: EnemyFormationUnit[]): ActionLink[] {
  const links: ActionLink[] = [];
  const playerAnchor = { x: 22, y: 52 };
  const enemyActor = enemyUnits.find((unit) => unit.id === action.actorEnemyId);
  const enemyTargets = enemyUnits.filter((unit) => action.targetEnemyIds.includes(unit.id));

  if (action.actorSide === "player" && enemyTargets.length > 0) {
    const primaryTarget = enemyTargets[0];
    links.push({
      key: `player-${primaryTarget.id}-primary`,
      x1: playerAnchor.x,
      y1: playerAnchor.y,
      x2: primaryTarget.x,
      y2: primaryTarget.y,
      tone: action.kind === "spread" ? "single" : enemyTargets.length > 1 ? "aoe" : "single",
    });

    if (action.kind === "spread" && enemyTargets.length > 1) {
      enemyTargets.slice(1).forEach((target, index) => {
        links.push({
          key: `spread-${primaryTarget.id}-${target.id}-${index}`,
          x1: primaryTarget.x,
          y1: primaryTarget.y,
          x2: target.x,
          y2: target.y,
          tone: "spread",
        });
      });
    } else if (enemyTargets.length > 1) {
      enemyTargets.slice(1).forEach((target, index) => {
        links.push({
          key: `player-${target.id}-${index}`,
          x1: playerAnchor.x,
          y1: playerAnchor.y,
          x2: target.x,
          y2: target.y,
          tone: "aoe",
        });
      });
    }
  } else if (action.actorSide === "enemy" && enemyActor) {
    links.push({
      key: `enemy-${enemyActor.id}`,
      x1: enemyActor.x,
      y1: enemyActor.y,
      x2: playerAnchor.x,
      y2: playerAnchor.y,
      tone: "danger",
    });
  }

  return links;
}

function buildTurnOrder(events: CombatEvent[], active: DirectedAction, report: BattleReport): TurnOrderItem[] {
  const rows: TurnOrderItem[] = [];
  const seen = new Set<string>();
  const push = (row: TurnOrderItem) => {
    if (seen.has(row.key)) return;
    seen.add(row.key);
    rows.push(row);
  };

  push({ key: `${active.actorSide}:${active.actorLabel}`, label: active.actorLabel, side: active.actorSide, current: true });

  for (const event of [...events].reverse()) {
    if (!isPrimaryEvent(event)) continue;
    const side = inferActorSide(event);
    const label = resolveActorLabel(event, side);
    push({ key: `${side}:${label}`, label, side, current: false });
    if (rows.length >= 6) break;
  }

  if (rows.length < 6) push({ key: "player:hero", label: "我方主角", side: "player", current: false });
  if (rows.length < 6) push({ key: "enemy:main", label: report.context?.floor.boss ? "首领目标" : "敌方主目标", side: "enemy", current: false });

  return rows.slice(0, 6);
}

function buildLiveTicker(events: CombatEvent[], elapsed: number): BattleTimelineEntry[] {
  const rows = events
    .filter((event) => event.time <= elapsed && event.time >= Math.max(0, elapsed - 10))
    .filter((event) => isTickerEvent(event))
    .slice(-10);
  return rows.map((event) => ({
    time: event.time,
    timeLabel: toClock(event.time),
    category: event.category,
    severity:
      event.type === "PLAYER_DEATH" || event.type === "ENEMY_HEAVY_HIT" || event.type === "DOT_BURST"
        ? "critical"
        : event.type === "RESOURCE_OVERFLOW" || event.type === "DOT_CLEANSE" || event.type === "ENEMY_SUMMON"
          ? "warning"
          : "normal",
    typeLabel: tickerTypeLabel(event),
    text: event.summary,
  }));
}

function buildDetailFeed(events: CombatEvent[], elapsed: number): BattleTimelineEntry[] {
  return events
    .filter((event) => event.time <= elapsed)
    .filter((event) => isDetailEvent(event))
    .slice(-80)
    .map((event) => ({
      time: event.time,
      timeLabel: toClock(event.time),
      category: event.category,
      severity:
        event.type === "PLAYER_DEATH" || event.type === "ENEMY_HEAVY_HIT" || event.type === "DOT_BURST"
          ? "critical"
          : event.type === "RESOURCE_OVERFLOW" || event.type === "DOT_CLEANSE" || event.type === "ENEMY_SUMMON"
            ? "warning"
            : "normal",
      typeLabel: tickerTypeLabel(event),
      text: event.summary,
    }));
}

function isTickerEvent(event: CombatEvent): boolean {
  return (
    event.type === "SKILL_CAST" ||
    event.type === "DOT_BURST" ||
    event.type === "DOT_APPLY" ||
    event.type === "DOT_TICK" ||
    event.type === "BASIC_ATTACK" ||
    event.type === "ENEMY_HIT" ||
    event.type === "ENEMY_HEAVY_HIT" ||
    event.type === "ENEMY_SUMMON" ||
    event.type === "BOSS_MECHANIC" ||
    event.type === "ENEMY_KILL" ||
    event.type === "DOT_CLEANSE" ||
    event.type === "RESOURCE_OVERFLOW" ||
    event.type === "PLAYER_DEATH" ||
    event.type === "BATTLE_END"
  );
}

function isDetailEvent(event: CombatEvent): boolean {
  if (event.type === "DOT_TICK") {
    return Number(event.amount ?? 0) >= 18;
  }
  if (event.type === "BASIC_ATTACK") {
    return Number(event.amount ?? 0) >= 20;
  }
  return isTickerEvent(event);
}

function tickerTypeLabel(event: CombatEvent): string {
  switch (event.type) {
    case "SKILL_CAST":
      return "技能";
    case "DOT_BURST":
      return "引爆";
    case "DOT_APPLY":
      return "附加";
    case "DOT_TICK":
      return "DOT";
    case "BASIC_ATTACK":
      return "普攻";
    case "ENEMY_HIT":
      return "受击";
    case "ENEMY_HEAVY_HIT":
      return "重击";
    case "ENEMY_SUMMON":
      return "召唤";
    case "BOSS_MECHANIC":
      return "机制";
    case "ENEMY_KILL":
      return "击杀";
    case "DOT_CLEANSE":
      return "净化";
    case "RESOURCE_OVERFLOW":
      return "溢出";
    case "PLAYER_DEATH":
      return "失败";
    case "BATTLE_END":
      return "结束";
    default:
      return "事件";
  }
}

function buildFloatingTexts(events: CombatEvent[], elapsed: number): FloatingTextItem[] {
  const from = Math.max(0, elapsed - 1.25);
  const rows = events
    .filter((event) => event.time >= from && event.time <= elapsed)
    .filter((event) =>
      [
        "ENEMY_HIT",
        "ENEMY_HEAVY_HIT",
        "DOT_BURST",
        "DOT_TICK",
        "BASIC_ATTACK",
        "HEAL_GAIN",
        "SHIELD_GAIN",
        "SHIELD_LOSS",
      ].includes(event.type),
    )
    .reverse()
    .slice(0, 7);

  return rows.map((event, index) => {
    const amount = Math.round(Number(event.amount ?? event.value ?? 0));
    let side: FocusSide = "enemy";
    let tone: FloatingTextItem["tone"] = "damage";
    let text = `-${amount}`;

    if (event.type === "ENEMY_HIT" || event.type === "ENEMY_HEAVY_HIT") {
      side = "player";
      text = event.type === "ENEMY_HEAVY_HIT" ? `-${amount} 重击` : `-${amount}`;
    } else if (event.type === "HEAL_GAIN") {
      tone = "heal";
      text = `+${amount} 治疗`;
    } else if (event.type === "SHIELD_GAIN") {
      tone = "shield";
      text = `+${amount} 护盾`;
    } else if (event.type === "SHIELD_LOSS") {
      tone = "shield";
      text = `-${amount} 护盾`;
    } else if (event.type === "DOT_TICK") {
      tone = "dot";
      text = `-${amount} DOT`;
    } else if (event.type === "DOT_BURST") {
      text = `-${amount} 引爆`;
    }

    return {
      key: `${event.time}-${event.type}-${index}`,
      side,
      tone,
      text,
    };
  });
}

function resolveRecommendedSkillId(events: CombatEvent[], elapsed: number): string | undefined {
  const row = [...events]
    .filter((event) => event.type === "SKILL_DECISION" && event.time <= elapsed)
    .reverse()
    .find(Boolean);
  return row?.sourceId;
}

function mapFloorUnit(unit: FloorEnemyUnit): InternalEnemyState {
  return {
    id: unit.id,
    key: `enemy-${unit.id}`,
    name: `敌人${unit.id}`,
    template: unit.template,
    role: resolveRoleByTemplate(unit.template),
    hpMax: Math.max(1, Math.round(unit.hp)),
    hpCurrent: Math.max(1, Math.round(unit.hp)),
    shield: 0,
    dotStacks: 0,
    alive: true,
  };
}

function resolveRoleByTemplate(template: EnemyTemplateKey): EnemyRole {
  if (template === "boss") return "boss";
  if (template === "antiDot" || template === "tank" || template === "summoner") return "elite";
  return "normal";
}

function parseEnemyId(event: CombatEvent): number | undefined {
  if (typeof event.targetId === "number") return event.targetId;
  const sourceId = event.sourceId ?? "";
  const m1 = sourceId.match(/enemy_(\d+)/);
  if (m1) return Number(m1[1]);
  const sourceName = event.sourceName ?? "";
  const m2 = sourceName.match(/敌人(\d+)/);
  if (m2) return Number(m2[1]);
  const targetName = event.targetName ?? "";
  const m3 = targetName.match(/敌人(\d+)/);
  if (m3) return Number(m3[1]);
  return undefined;
}

function isDamageToEnemyEvent(event: CombatEvent): boolean {
  if (event.type === "BASIC_ATTACK" || event.type === "DOT_TICK" || event.type === "DOT_BURST" || event.type === "PROC_TRIGGER") {
    return typeof event.targetId === "number";
  }
  if (event.type === "SKILL_CAST") {
    return !(event.tags ?? []).includes("cast") && typeof event.targetId === "number" && Number(event.amount ?? 0) > 0;
  }
  return false;
}

function isPrimaryEvent(event: CombatEvent): boolean {
  if (!PRIMARY_TYPES.has(event.type)) return false;
  if (event.type === "SKILL_CAST") {
    return (event.tags ?? []).includes("cast") || (event.tags ?? []).includes("burst") || (event.tags ?? []).includes("finisher");
  }
  return true;
}

function isMinorEvent(event: CombatEvent): boolean {
  if (event.type === "ENEMY_HIT") return Number(event.amount ?? 0) < 40;
  return false;
}

function resolveActionKind(primary: CombatEvent, related: CombatEvent[]): ActionKind {
  const tags = new Set<string>([...(primary.tags ?? [])]);
  for (const event of related) {
    for (const tag of event.tags ?? []) tags.add(tag);
  }
  if (primary.type === "ENEMY_SUMMON") return "summon";
  if (primary.type === "ENEMY_KILL") return "kill";
  if (primary.type === "BOSS_MECHANIC") return "phase";
  if (primary.type === "DOT_CLEANSE") return "cleanse";
  if (primary.type === "ENEMY_HIT" || primary.type === "ENEMY_HEAVY_HIT") return "enemyAttack";
  if (tags.has("spread")) return "spread";
  if (tags.has("burst")) return "burst";
  if (tags.has("dot")) return "dot";
  const targetCount = collectTargetEnemyIds(related.length > 0 ? related : [primary]).length;
  if (targetCount >= 2) return "aoe";
  return "single";
}

function resolveActionTitle(primary: CombatEvent): string {
  if (primary.type === "SKILL_CAST") {
    return primary.sourceId ? tSkillId(primary.sourceId) : primary.sourceName ?? "技能施放";
  }
  if (primary.type === "DOT_BURST") return "DOT 引爆";
  if (primary.type === "ENEMY_SUMMON") return "敌方召唤";
  if (primary.type === "ENEMY_HEAVY_HIT") return "敌方重击";
  if (primary.type === "ENEMY_HIT") return "敌方攻击";
  if (primary.type === "ENEMY_KILL") return "单位击杀";
  if (primary.type === "BOSS_MECHANIC") return "Boss 机制";
  if (primary.type === "DOT_CLEANSE") return "净化";
  return "战斗动作";
}

function resolveActionTags(primary: CombatEvent, related: CombatEvent[]): string[] {
  const tags = new Set<string>();
  for (const row of [primary, ...related]) {
    for (const tag of row.tags ?? []) {
      if (tag === "dot") tags.add("DOT");
      if (tag === "burst") tags.add("引爆");
      if (tag === "spread") tags.add("扩散");
      if (tag === "finisher") tags.add("收割");
      if (tag === "phase_shift") tags.add("阶段切换");
      if (tag === "cleanse") tags.add("净化");
      if (tag === "summon") tags.add("召唤");
    }
  }
  if (primary.type === "ENEMY_HEAVY_HIT") tags.add("重击");
  if (primary.type === "BOSS_MECHANIC") tags.add("Boss机制");
  if (primary.type === "ENEMY_KILL") tags.add("击杀");
  if (tags.size === 0) tags.add("战斗");
  return [...tags].slice(0, 4);
}

function collectTargetEnemyIds(events: CombatEvent[]): number[] {
  const ids = events
    .map((event) => (typeof event.targetId === "number" ? event.targetId : undefined))
    .filter((id): id is number => id !== undefined);
  return ids.filter((id, index, list) => list.indexOf(id) === index);
}

function collectTargetLabels(events: CombatEvent[]): string[] {
  const rows = events
    .map((event) => event.targetName)
    .filter((name): name is string => Boolean(name && name.length > 0));
  return rows.filter((name, index, list) => list.indexOf(name) === index);
}

function resolveTargetDisplayLabel(targetSide: FocusSide, labels: string[], report: BattleReport): string {
  if (targetSide === "player") return "我方主角";
  if (labels.length === 0) return report.context?.floor.boss ? "首领目标" : "敌方主目标";
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return labels.join(" / ");
  return `${labels[0]} 等 ${labels.length} 目标`;
}

function inferActorSide(event: CombatEvent): FocusSide {
  if (event.type === "ENEMY_HIT" || event.type === "ENEMY_HEAVY_HIT" || event.type === "ENEMY_SUMMON" || event.type === "BOSS_MECHANIC") {
    return "enemy";
  }
  if ((event.tags ?? []).includes("enemy") || (event.tags ?? []).includes("boss")) {
    return "enemy";
  }
  const sourceName = event.sourceName ?? "";
  if (sourceName.includes("Boss") || sourceName.includes("敌")) return "enemy";
  return "player";
}

function resolveActorLabel(event: CombatEvent, side: FocusSide): string {
  if (side === "player") return "我方主角";
  return event.sourceName ?? "敌方单位";
}

function roleOrder(role: EnemyRole): number {
  return role === "boss" ? 4 : role === "elite" ? 3 : role === "normal" ? 2 : 1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
