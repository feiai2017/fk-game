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

interface MergedEvent {
  time: number;
  type: CombatEventType;
  category: CombatEventCategory;
  sourceName?: string;
  targetName?: string;
  amount: number;
  count: number;
  tags: string[];
  representative: CombatEvent;
}

const CRITICAL_TYPES = new Set<CombatEventType>([
  "DOT_BURST",
  "ENEMY_HEAVY_HIT",
  "ENEMY_KILL",
  "BOSS_MECHANIC",
  "PLAYER_DEATH",
]);

const WARNING_TYPES = new Set<CombatEventType>([
  "ENEMY_SUMMON",
  "DOT_CLEANSE",
  "RESOURCE_OVERFLOW",
]);

const SECOND_BUCKET_TYPES = new Set<CombatEventType>(["DOT_TICK", "BASIC_ATTACK", "ENEMY_HIT"]);

export function buildBattleTimeline(input: BuildTimelineInput): BattleTimelineEntry[] {
  const events = [...(input.events ?? [])].sort((a, b) => a.time - b.time);
  if (events.length === 0) return [];

  const pressureEvents = buildPressureEvents(input.snapshots ?? [], input.playerMaxHp ?? 1000);
  const merged = mergeEvents([...events, ...pressureEvents]);
  const formatted = merged.map(toTimelineEntry).filter(Boolean) as BattleTimelineEntry[];

  const maxEntries = Math.max(24, input.maxEntries ?? 140);
  if (formatted.length <= maxEntries) return formatted;

  const anchors = [formatted[0], ...formatted.slice(-16)];
  const important = [...formatted]
    .sort((a, b) => priorityScore(b) - priorityScore(a) || a.time - b.time)
    .slice(0, Math.max(0, maxEntries - anchors.length));

  return dedupe([...anchors, ...important])
    .sort((a, b) => a.time - b.time)
    .slice(-maxEntries);
}

function mergeEvents(events: CombatEvent[]): MergedEvent[] {
  const groups = new Map<string, MergedEvent>();
  for (const event of events) {
    const key = buildMergeKey(event);
    const amount = Number(event.amount ?? event.value ?? 0);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        time: mergeTime(event),
        type: event.type,
        category: event.category,
        sourceName: event.sourceName,
        targetName: event.targetName,
        amount,
        count: 1,
        tags: [...new Set(event.tags ?? [])],
        representative: event,
      });
      continue;
    }

    existing.amount += amount;
    existing.count += 1;
    existing.tags = [...new Set([...existing.tags, ...(event.tags ?? [])])];
    existing.targetName = existing.targetName ?? event.targetName;
  }
  return [...groups.values()].sort((a, b) => a.time - b.time);
}

function buildMergeKey(event: CombatEvent): string {
  if (SECOND_BUCKET_TYPES.has(event.type)) {
    return `${Math.floor(Math.max(0, event.time))}|${event.type}|${event.sourceId ?? event.sourceName ?? "none"}`;
  }
  const t = Math.round(event.time * 10) / 10;
  return `${t.toFixed(1)}|${event.type}|${event.sourceId ?? event.sourceName ?? "none"}|${event.targetId ?? event.targetName ?? "none"}`;
}

function mergeTime(event: CombatEvent): number {
  if (SECOND_BUCKET_TYPES.has(event.type)) {
    return Math.floor(Math.max(0, event.time));
  }
  return Math.round(event.time * 10) / 10;
}

function toTimelineEntry(event: MergedEvent): BattleTimelineEntry | null {
  if (!shouldInclude(event)) return null;

  return {
    time: event.time,
    timeLabel: formatTime(event.time),
    category: event.category,
    severity: resolveSeverity(event),
    typeLabel: typeLabel(event),
    text: narrative(event),
  };
}

function shouldInclude(event: MergedEvent): boolean {
  if (event.type === "SKILL_DECISION") return false;

  if (event.type === "DOT_TICK") {
    return event.count >= 2 || event.amount >= 30;
  }

  if (event.type === "BASIC_ATTACK") {
    return event.count >= 2 || event.amount >= 40;
  }

  if (event.type === "RESOURCE_GAIN" || event.type === "RESOURCE_SPEND") {
    return false;
  }

  return true;
}

function resolveSeverity(event: MergedEvent): BattleTimelineEntry["severity"] {
  if (CRITICAL_TYPES.has(event.type)) return "critical";
  if (WARNING_TYPES.has(event.type)) return "warning";
  return "normal";
}

function typeLabel(event: MergedEvent): string {
  switch (event.type) {
    case "SKILL_CAST":
      return "技能";
    case "BASIC_ATTACK":
      return "普攻";
    case "DOT_APPLY":
      return event.tags.includes("spread") ? "扩散" : "附加";
    case "DOT_TICK":
      return "DOT";
    case "DOT_BURST":
      return "引爆";
    case "DOT_CLEANSE":
      return "净化";
    case "BOSS_MECHANIC":
      return "机制";
    case "ENEMY_SUMMON":
      return "召唤";
    case "ENEMY_HEAVY_HIT":
      return "重击";
    case "ENEMY_HIT":
      return "受击";
    case "ENEMY_KILL":
      return "击杀";
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

function narrative(event: MergedEvent): string {
  const actor = resolveActor(event);
  const target = event.targetName ?? "目标";
  const amount = Math.max(0, Math.round(event.amount));

  switch (event.type) {
    case "SKILL_CAST":
      return event.representative.summary;
    case "DOT_APPLY":
      return event.representative.summary;
    case "DOT_TICK":
      return `${actor}持续压制 ${target}，DOT 结算 ${amount}`;
    case "DOT_BURST":
      return event.representative.summary;
    case "BASIC_ATTACK":
      return `${actor}连续普攻压血，累计伤害 ${amount}`;
    case "ENEMY_HIT":
      return `${actor}对你造成 ${amount} 点伤害`;
    case "ENEMY_HEAVY_HIT":
      return `${actor}发动重击，造成 ${amount} 点伤害`;
    case "ENEMY_SUMMON":
      return `${actor}召唤增援 x${Math.max(1, Math.round(event.amount))}`;
    case "BOSS_MECHANIC":
      return event.representative.summary;
    case "DOT_CLEANSE":
      return `${actor}触发净化，移除 DOT`;
    case "ENEMY_KILL":
      return event.representative.summary;
    case "RESOURCE_OVERFLOW":
      return `资源溢出 ${amount}，需要尽快转化`;
    case "PLAYER_DEATH":
      return "你被击败，战斗结束";
    case "BATTLE_END":
      return event.representative.summary;
    default:
      return event.representative.summary;
  }
}

function resolveActor(event: MergedEvent): string {
  if (
    event.type === "SKILL_CAST" ||
    event.type === "BASIC_ATTACK" ||
    event.type === "DOT_APPLY" ||
    event.type === "DOT_BURST" ||
    event.type === "DOT_TICK" ||
    event.type === "PROC_TRIGGER"
  ) {
    return "你";
  }
  return event.sourceName ?? "敌人";
}

function buildPressureEvents(snapshots: CombatSnapshot[], playerMaxHp: number): CombatEvent[] {
  if (!snapshots.length) return [];
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
      metadata: { aliveEnemies: crowded.aliveEnemies },
    });
  }

  const incomingThreshold = Math.max(80, Math.round(playerMaxHp * 0.2));
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
      metadata: { incomingDamageWindow: highIncoming.recentIncomingDamageWindow },
    });
  }

  return events;
}

function dedupe(entries: BattleTimelineEntry[]): BattleTimelineEntry[] {
  const seen = new Set<string>();
  const out: BattleTimelineEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.time.toFixed(1)}|${entry.typeLabel}|${entry.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function priorityScore(entry: BattleTimelineEntry): number {
  if (entry.severity === "critical") return 3;
  if (entry.severity === "warning") return 2;
  return 1;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
