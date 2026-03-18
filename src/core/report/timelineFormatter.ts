import type {
  BattleTimelineEntry,
  CombatEvent,
  CombatEventCategory,
  CombatEventType,
  CombatSnapshot,
} from "@/core/battle/types";

interface BuildTimelineInput {
  events: CombatEvent[];
  snapshots?: CombatSnapshot[];
  playerMaxHp?: number;
  maxEntries?: number;
}

interface MergedTarget {
  id?: number | string;
  name: string;
  total: number;
  killed: boolean;
}

interface MergedEvent {
  time: number;
  type: CombatEventType;
  category: CombatEventCategory;
  sourceId?: string;
  sourceName?: string;
  tags: string[];
  amount: number;
  targets: MergedTarget[];
  count: number;
  events: CombatEvent[];
  representative: CombatEvent;
}

const HIGH_PRIORITY_TYPES = new Set<CombatEventType>([
  "SKILL_CAST",
  "DOT_BURST",
  "ENEMY_KILL",
  "BOSS_MECHANIC",
  "ENEMY_SUMMON",
  "DOT_CLEANSE",
  "PLAYER_DEATH",
]);

const LOW_PRIORITY_TYPES = new Set<CombatEventType>(["BASIC_ATTACK", "DOT_TICK"]);

const GLOBAL_MERGE_TYPES = new Set<CombatEventType>([
  "ENEMY_HIT",
  "ENEMY_HEAVY_HIT",
  "BASIC_ATTACK",
  "DOT_TICK",
]);

const SOURCE_MERGE_TYPES = new Set<CombatEventType>(["DOT_BURST", "DOT_APPLY", "PROC_TRIGGER"]);

export function buildBattleTimeline(input: BuildTimelineInput): BattleTimelineEntry[] {
  const baseEvents = [...(input.events ?? [])].sort((a, b) => a.time - b.time);
  if (baseEvents.length === 0) {
    return [];
  }

  const pressureEvents = buildPressureEvents({
    snapshots: input.snapshots ?? [],
    playerMaxHp: input.playerMaxHp,
  });

  const merged = mergeEvents([...baseEvents, ...pressureEvents]);
  const filtered = merged.filter(shouldIncludeEvent);
  const formatted = filtered.map(formatMergedEvent);

  const maxEntries = Math.max(12, input.maxEntries ?? 42);
  if (formatted.length <= maxEntries) {
    return formatted;
  }

  const selected = [...formatted]
    .sort((a, b) => {
      const p = priorityScore(b) - priorityScore(a);
      if (p !== 0) {
        return p;
      }
      return a.time - b.time;
    })
    .slice(0, maxEntries)
    .sort((a, b) => a.time - b.time);

  return selected;
}

function mergeEvents(events: CombatEvent[]): MergedEvent[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const killLookup = new Set<string>();
  for (const event of sorted) {
    if (event.type === "ENEMY_KILL" && event.targetId !== undefined) {
      killLookup.add(buildKillKey(event.time, event.targetId));
    }
  }

  const groups = new Map<string, MergedEvent>();
  for (const event of sorted) {
    const key = buildMergeKey(event);
    const amount = event.amount ?? event.value ?? 0;
    const target = buildTarget(event, amount, killLookup);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        time: roundedTime(event.time),
        type: event.type,
        category: event.category,
        sourceId: event.sourceId,
        sourceName: event.sourceName,
        tags: [...new Set(event.tags ?? [])],
        amount,
        targets: target ? [target] : [],
        count: 1,
        events: [event],
        representative: event,
      });
      continue;
    }

    existing.amount += amount;
    existing.count += 1;
    existing.category = pickHigherCategory(existing.category, event.category);
    existing.tags = [...new Set([...existing.tags, ...(event.tags ?? [])])];
    existing.events.push(event);
    if (target) {
      mergeTarget(existing.targets, target);
    }
  }

  return [...groups.values()].sort((a, b) => a.time - b.time);
}

function buildMergeKey(event: CombatEvent): string {
  const timeKey = roundedTime(event.time).toFixed(1);
  if (GLOBAL_MERGE_TYPES.has(event.type)) {
    return `${timeKey}|${event.type}`;
  }
  if (SOURCE_MERGE_TYPES.has(event.type)) {
    return `${timeKey}|${event.type}|${event.sourceId ?? event.sourceName ?? "none"}`;
  }
  return `${timeKey}|${event.type}|${event.sourceId ?? event.sourceName ?? "none"}|${
    event.targetId ?? event.targetName ?? "none"
  }`;
}

function buildTarget(event: CombatEvent, amount: number, killLookup: Set<string>): MergedTarget | undefined {
  if (event.targetId === undefined && !event.targetName) {
    return undefined;
  }
  const targetId = event.targetId;
  const targetName = event.targetName ?? (targetId !== undefined ? `目标${String(targetId)}` : "目标");
  const killed =
    (targetId !== undefined && killLookup.has(buildKillKey(event.time, targetId))) ||
    (event.tags ?? []).includes("kill");

  return {
    id: targetId,
    name: targetName,
    total: Math.max(0, amount),
    killed,
  };
}

function mergeTarget(targets: MergedTarget[], incoming: MergedTarget): void {
  const found = targets.find((target) =>
    target.id !== undefined && incoming.id !== undefined ? target.id === incoming.id : target.name === incoming.name,
  );
  if (!found) {
    targets.push({ ...incoming });
    return;
  }
  found.total += incoming.total;
  found.killed = found.killed || incoming.killed;
}

function pickHigherCategory(a: CombatEventCategory, b: CombatEventCategory): CombatEventCategory {
  const rank = (value: CombatEventCategory): number => {
    switch (value) {
      case "danger":
        return 5;
      case "offense":
        return 4;
      case "defense":
        return 3;
      case "resource":
        return 2;
      case "system":
      default:
        return 1;
    }
  };
  return rank(b) > rank(a) ? b : a;
}

function shouldIncludeEvent(event: MergedEvent): boolean {
  if (event.type === "SKILL_DECISION") {
    return false;
  }

  if (event.type === "DOT_TICK") {
    return false;
  }

  if (event.type === "RESOURCE_GAIN" || event.type === "RESOURCE_SPEND") {
    return event.tags.includes("kill") || event.tags.includes("overflow");
  }

  if (event.type === "DOT_APPLY") {
    const rep = event.representative;
    const stacksAfter = Number(rep.metadata?.stacksAfter ?? rep.meta?.stacksAfter ?? 0);
    const stackDelta = Number(rep.metadata?.stackDelta ?? rep.meta?.stackDelta ?? 0);
    return (
      event.tags.includes("spread") ||
      event.tags.includes("first_cover") ||
      stacksAfter >= 2 ||
      stackDelta >= 2
    );
  }

  if (event.type === "BUFF_GAIN") {
    return (
      event.tags.includes("dot_milestone") ||
      event.tags.includes("dot_loop_ready") ||
      event.tags.includes("dot_burst_window")
    );
  }

  if (event.type === "DEBUFF_APPLY") {
    return event.tags.includes("pressure");
  }

  return true;
}

function formatMergedEvent(event: MergedEvent): BattleTimelineEntry {
  return {
    time: event.time,
    timeLabel: formatTime(event.time),
    category: event.category,
    severity: resolveSeverity(event),
    typeLabel: resolveTypeLabel(event),
    text: buildNarrativeText(event),
  };
}

function resolveSeverity(event: MergedEvent): BattleTimelineEntry["severity"] {
  if (HIGH_PRIORITY_TYPES.has(event.type)) {
    return "critical";
  }
  if (LOW_PRIORITY_TYPES.has(event.type)) {
    return "normal";
  }
  if (event.type === "PLAYER_DEATH") {
    return "critical";
  }
  if (event.type === "ENEMY_KILL" && event.tags.includes("boss")) {
    return "critical";
  }
  if (event.type === "BOSS_MECHANIC" && event.tags.includes("phase_shift")) {
    return "critical";
  }
  if (event.type === "DOT_BURST" || event.type === "ENEMY_HEAVY_HIT") {
    return "critical";
  }
  if (event.type === "DOT_CLEANSE" || event.type === "ENEMY_SUMMON") {
    return "warning";
  }
  if (event.type === "DEBUFF_APPLY" && event.tags.includes("pressure")) {
    return "warning";
  }
  return "normal";
}

function resolveTypeLabel(event: MergedEvent): string {
  if (event.type === "DOT_APPLY") {
    return event.tags.includes("spread") ? "扩散" : "附加";
  }
  if (event.type === "BUFF_GAIN") {
    if (event.tags.includes("dot_milestone")) {
      return "阈值";
    }
    if (event.tags.includes("dot_loop_ready")) {
      return "成型";
    }
    if (event.tags.includes("dot_burst_window")) {
      return "爆发窗";
    }
    return "增益";
  }
  if (event.type === "DOT_BURST") {
    return "引爆";
  }
  if (event.type === "DOT_CLEANSE") {
    return "净化";
  }
  if (event.type === "ENEMY_KILL") {
    return event.tags.includes("harvest") ? "收割" : "击杀";
  }
  if (event.type === "BOSS_MECHANIC") {
    if (event.tags.includes("entry")) {
      return "登场";
    }
    if (event.tags.includes("phase_shift")) {
      return "转阶段";
    }
    return "机制";
  }
  if (event.type === "DEBUFF_APPLY" && event.tags.includes("pressure")) {
    return "压力";
  }
  switch (event.type) {
    case "SKILL_CAST":
      return "技能";
    case "ENEMY_HIT":
      return "受击";
    case "ENEMY_HEAVY_HIT":
      return "重击";
    case "ENEMY_SUMMON":
      return "召唤";
    case "BASIC_ATTACK":
      return "普攻";
    case "SHIELD_GAIN":
      return "护盾";
    case "SHIELD_LOSS":
      return "破盾";
    case "HEAL_GAIN":
      return "治疗";
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

function buildNarrativeText(event: MergedEvent): string {
  const actor = resolveActor(event);
  const amount = Math.max(0, Math.round(event.amount));
  const primaryTarget = event.targets[0]?.name ?? "目标";
  const rep = event.representative;
  const tags = event.tags;

  switch (event.type) {
    case "DOT_BURST":
      return buildExplodeText(actor, event.targets, amount);

    case "SKILL_CAST": {
      const skillName = event.sourceName ?? "技能";
      if (tags.includes("cast")) {
        const target = event.targets.length > 0 ? `，目标：${renderTargetNames(event.targets)}` : "";
        return `${actor}施放【${skillName}】${target}`;
      }
      if (event.targets.length > 0) {
        return `${actor}使用【${skillName}】命中 ${renderTargetDamageList(event.targets)}，造成 ${amount} 点伤害`;
      }
      return `${actor}施放【${skillName}】并产生效果`;
    }

    case "ENEMY_HIT":
      return `${actor}对你造成 ${amount} 点伤害`;

    case "ENEMY_HEAVY_HIT": {
      const skillName = String(rep.metadata?.bossSkillName ?? rep.meta?.bossSkillName ?? "");
      if (skillName) {
        return `${actor}施放【${skillName}】，对你造成 ${amount} 点伤害`;
      }
      return `${actor}发动重击，对你造成 ${amount} 点伤害`;
    }

    case "DOT_APPLY": {
      const dotName = String(rep.metadata?.dotName ?? rep.meta?.dotName ?? "腐蚀");
      const stacksAfter = Math.max(1, Math.round(Number(rep.metadata?.stacksAfter ?? rep.meta?.stacksAfter ?? 1)));
      if (tags.includes("spread")) {
        return `${dotName}扩散至 ${primaryTarget}（${stacksAfter}层）`;
      }
      return `${actor}对 ${primaryTarget} 施加${dotName}（${stacksAfter}层）`;
    }

    case "BUFF_GAIN":
      if (tags.includes("dot_milestone")) {
        const dotName = String(rep.metadata?.dotName ?? rep.meta?.dotName ?? "腐蚀");
        const stacks = Math.max(
          1,
          Math.round(Number(rep.metadata?.targetDotStacks ?? rep.meta?.targetDotStacks ?? 1)),
        );
        return `${primaryTarget} ${dotName}达到关键层数（${stacks}层）`;
      }
      if (tags.includes("dot_loop_ready")) {
        return "你的DOT循环已成型，持续压制开始稳定";
      }
      if (tags.includes("dot_burst_window")) {
        return "你进入引爆窗口，准备完成收割";
      }
      return `${actor}获得增益效果`;

    case "DOT_CLEANSE":
      return `${actor}施放【净化脉冲】，移除了 ${Math.max(1, amount)} 层DOT`;

    case "ENEMY_SUMMON":
      return `${actor}召唤增援 x${Math.max(1, amount)}`;

    case "BOSS_MECHANIC":
      if (tags.includes("entry")) {
        return "首领登场，战斗进入机制阶段";
      }
      if (tags.includes("phase_shift")) {
        return "首领进入新阶段，战场压力上升";
      }
      if (tags.includes("memory")) {
        return "首领触发记忆机制：抬盾并召唤增援";
      }
      return rep.summary;

    case "ENEMY_KILL":
      if (tags.includes("boss")) {
        return "你击败了首领";
      }
      if (tags.includes("harvest")) {
        return `${actor}完成收割，${primaryTarget} 被击杀`;
      }
      return `${actor}击杀了 ${primaryTarget}`;

    case "DEBUFF_APPLY":
      if (tags.includes("pressure_enemy_count")) {
        const alive = Math.max(1, Math.round(Number(rep.metadata?.aliveEnemies ?? 0)));
        return `战场压力上升：敌方数量过多（${alive}个）`;
      }
      if (tags.includes("pressure_incoming")) {
        return `战场压力上升：持续承伤过高（2秒承伤 ${amount}）`;
      }
      return rep.summary;

    case "BASIC_ATTACK":
      if (event.targets.length > 0) {
        return `${actor}进行普通攻击，命中 ${renderTargetDamageList(event.targets)}，造成 ${amount} 点伤害`;
      }
      return `${actor}进行普通攻击，造成 ${amount} 点伤害`;

    case "SHIELD_GAIN":
      return `${actor}获得护盾 ${amount}`;

    case "SHIELD_LOSS":
      return `${actor}护盾减少 ${amount}`;

    case "HEAL_GAIN":
      return `${actor}回复了 ${amount} 点生命`;

    case "RESOURCE_OVERFLOW":
      return `${actor}资源溢出，部分资源未被转化`;

    case "PLAYER_DEATH":
      return "你被击败，战斗结束";

    case "BATTLE_END":
      return rep.summary;

    default:
      return rep.summary;
  }
}

function buildExplodeText(actor: string, targets: MergedTarget[], total: number): string {
  if (targets.length <= 0) {
    return `${actor}触发引爆，总伤害 ${total}`;
  }
  if (targets.length === 1) {
    const target = targets[0];
    return `${actor}触发引爆，对 ${target.name} 造成 ${Math.round(target.total)} 点伤害${
      target.killed ? "（击杀）" : ""
    }`;
  }
  if (targets.length <= 3) {
    const rows = targets
      .map((target) => `${target.name}（${Math.round(target.total)}）${target.killed ? "（击杀）" : ""}`)
      .join("，");
    return `${actor}触发引爆，命中 ${rows}`;
  }
  return `${actor}触发引爆，命中${targets.length}个目标，总伤害 ${total}`;
}

function renderTargetNames(targets: MergedTarget[]): string {
  if (targets.length <= 0) {
    return "无";
  }
  if (targets.length === 1) {
    return targets[0].name;
  }
  if (targets.length <= 3) {
    return targets.map((target) => target.name).join("、");
  }
  return `${targets[0].name}等${targets.length}个目标`;
}

function renderTargetDamageList(targets: MergedTarget[]): string {
  if (targets.length === 1) {
    return `${targets[0].name}（${Math.round(targets[0].total)}）${targets[0].killed ? "（击杀）" : ""}`;
  }
  if (targets.length <= 3) {
    return targets
      .map((target) => `${target.name}（${Math.round(target.total)}）${target.killed ? "（击杀）" : ""}`)
      .join("，");
  }
  const total = Math.round(targets.reduce((sum, target) => sum + target.total, 0));
  return `${targets.length}个目标（总计${total}）`;
}

function resolveActor(event: MergedEvent): string {
  if (
    event.type === "SKILL_CAST" ||
    event.type === "BASIC_ATTACK" ||
    event.type === "DOT_APPLY" ||
    event.type === "DOT_BURST" ||
    event.type === "PROC_TRIGGER"
  ) {
    return "你";
  }

  const sourceName = event.sourceName ?? "";
  if (!sourceName) {
    return event.tags.includes("enemy") || event.tags.includes("boss") ? "敌方" : "系统";
  }

  if (sourceName.includes("Boss")) {
    return "首领";
  }
  if (sourceName.includes("敌人")) {
    const head = sourceName.split("(")[0];
    return head || sourceName;
  }
  return sourceName;
}

function buildPressureEvents(input: {
  snapshots: CombatSnapshot[];
  playerMaxHp?: number;
}): CombatEvent[] {
  const snapshots = input.snapshots ?? [];
  if (snapshots.length === 0) {
    return [];
  }

  const events: CombatEvent[] = [];
  const crowded = snapshots.find((snapshot) => snapshot.aliveEnemies >= 4);
  if (crowded) {
    events.push({
      time: crowded.time,
      type: "DEBUFF_APPLY",
      category: "danger",
      summary: "战场压力：敌方数量过多",
      sourceId: "system_pressure",
      sourceName: "战场压力",
      amount: crowded.aliveEnemies,
      tags: ["pressure", "pressure_enemy_count"],
      metadata: {
        aliveEnemies: crowded.aliveEnemies,
      },
    });
  }

  const incomingThreshold = Math.max(80, Math.round((input.playerMaxHp ?? 1000) * 0.2));
  const highIncoming = snapshots.find((snapshot) => snapshot.recentIncomingDamageWindow >= incomingThreshold);
  if (highIncoming) {
    events.push({
      time: highIncoming.time,
      type: "DEBUFF_APPLY",
      category: "danger",
      summary: "战场压力：持续承伤过高",
      sourceId: "system_pressure",
      sourceName: "战场压力",
      amount: Math.round(highIncoming.recentIncomingDamageWindow),
      tags: ["pressure", "pressure_incoming"],
      metadata: {
        incomingDamageWindow: highIncoming.recentIncomingDamageWindow,
      },
    });
  }

  return events;
}

function priorityScore(entry: BattleTimelineEntry): number {
  if (entry.severity === "critical") {
    return 3;
  }
  if (entry.severity === "warning") {
    return 2;
  }
  return 1;
}

function buildKillKey(time: number, targetId: number | string): string {
  return `${roundedTime(time).toFixed(1)}::${String(targetId)}`;
}

function roundedTime(time: number): number {
  return Math.round(time * 10) / 10;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
