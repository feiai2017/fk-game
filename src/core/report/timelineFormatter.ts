import type { BattleTimelineEntry, CombatEvent, CombatEventType } from "@/core/battle/types";

interface BuildTimelineInput {
  events: CombatEvent[];
  maxEntries?: number;
}

const PRIMARY_EVENT_TYPES: CombatEventType[] = [
  "SKILL_CAST",
  "DOT_BURST",
  "DOT_CLEANSE",
  "BOSS_MECHANIC",
  "ENEMY_HEAVY_HIT",
  "ENEMY_HIT",
  "SHIELD_GAIN",
  "SHIELD_LOSS",
  "PROC_TRIGGER",
  "ENEMY_SUMMON",
  "BUFF_GAIN",
  "DEBUFF_APPLY",
  "ENEMY_KILL",
  "PLAYER_DEATH",
  "BATTLE_END",
  "RESOURCE_OVERFLOW",
];

export function buildBattleTimeline(input: BuildTimelineInput): BattleTimelineEntry[] {
  const events = input.events ?? [];
  if (events.length === 0) {
    return [];
  }

  const maxEntries = Math.max(8, input.maxEntries ?? 28);
  const heavyHitThreshold = computeHighHitThreshold(events);
  const highlights = events
    .filter((event) => shouldIncludeEvent(event, heavyHitThreshold))
    .map((event) => formatTimelineEvent(event));

  if (highlights.length <= maxEntries) {
    return highlights;
  }

  // 保留关键节点 + 末尾战况，避免时间轴过长难读
  const critical = highlights.filter((entry) => entry.severity === "critical");
  const remained = highlights.filter((entry) => entry.severity !== "critical");
  const budget = Math.max(0, maxEntries - critical.length);
  return [...critical, ...remained.slice(-budget)].sort((a, b) => a.time - b.time);
}

function shouldIncludeEvent(event: CombatEvent, heavyHitThreshold: number): boolean {
  if (!PRIMARY_EVENT_TYPES.includes(event.type)) {
    return false;
  }

  if (event.type === "ENEMY_HIT") {
    return (event.amount ?? 0) >= heavyHitThreshold;
  }
  if (event.type === "SKILL_CAST") {
    const tags = event.tags ?? [];
    return (
      tags.includes("finisher") ||
      tags.includes("burst") ||
      tags.includes("conversion") ||
      tags.includes("spread") ||
      tags.includes("shield") ||
      tags.includes("heal") ||
      tags.includes("aoe")
    );
  }
  return true;
}

function formatTimelineEvent(event: CombatEvent): BattleTimelineEntry {
  return {
    time: event.time,
    timeLabel: formatTime(event.time),
    category: event.category,
    severity: severityOf(event),
    typeLabel: typeLabelOf(event.type),
    text: summaryTextOf(event),
  };
}

function severityOf(event: CombatEvent): BattleTimelineEntry["severity"] {
  if (event.type === "PLAYER_DEATH" || event.type === "BOSS_MECHANIC") {
    return "critical";
  }
  if (
    event.type === "ENEMY_HEAVY_HIT" ||
    event.type === "DOT_CLEANSE" ||
    event.type === "RESOURCE_OVERFLOW" ||
    event.type === "ENEMY_SUMMON"
  ) {
    return "warning";
  }
  return "normal";
}

function typeLabelOf(type: CombatEventType): string {
  switch (type) {
    case "SKILL_CAST":
      return "技能";
    case "DOT_BURST":
      return "引爆";
    case "DOT_CLEANSE":
      return "净化";
    case "BOSS_MECHANIC":
      return "机制";
    case "ENEMY_HEAVY_HIT":
      return "重击";
    case "ENEMY_HIT":
      return "受击";
    case "SHIELD_GAIN":
      return "护盾";
    case "SHIELD_LOSS":
      return "破盾";
    case "PROC_TRIGGER":
      return "触发";
    case "ENEMY_SUMMON":
      return "召唤";
    case "BUFF_GAIN":
      return "增益";
    case "DEBUFF_APPLY":
      return "减益";
    case "ENEMY_KILL":
      return "击杀";
    case "PLAYER_DEATH":
      return "死亡";
    case "BATTLE_END":
      return "结束";
    case "RESOURCE_OVERFLOW":
      return "溢出";
    default:
      return "事件";
  }
}

function summaryTextOf(event: CombatEvent): string {
  const amount = event.amount ?? event.value;
  switch (event.type) {
    case "SKILL_CAST":
      return `你施放【${event.sourceName ?? "技能"}】`;
    case "DOT_BURST":
      return `DOT引爆造成 ${Math.round(amount ?? 0)} 点伤害`;
    case "DOT_CLEANSE":
      return event.summary;
    case "BOSS_MECHANIC":
      return `首领机制触发：${event.summary}`;
    case "ENEMY_HEAVY_HIT":
      return `${event.sourceName ?? "敌方"}重击你，造成 ${Math.round(amount ?? 0)}`;
    case "ENEMY_HIT":
      return `${event.sourceName ?? "敌方"}命中你，造成 ${Math.round(amount ?? 0)}`;
    case "SHIELD_GAIN":
      return `获得护盾 ${Math.round(amount ?? 0)}`;
    case "SHIELD_LOSS":
      return `护盾被击破 ${Math.round(amount ?? 0)}`;
    case "PROC_TRIGGER":
      return `触发伤害 ${Math.round(amount ?? 0)}（${event.sourceName ?? "效果"}）`;
    case "ENEMY_SUMMON":
      return event.summary;
    case "BUFF_GAIN":
    case "DEBUFF_APPLY":
      return event.summary;
    case "ENEMY_KILL":
      return event.summary;
    case "PLAYER_DEATH":
      return "你已被击败";
    case "BATTLE_END":
      return event.summary;
    case "RESOURCE_OVERFLOW":
      return "资源溢出，部分收益未被兑现";
    default:
      return event.summary;
  }
}

function computeHighHitThreshold(events: CombatEvent[]): number {
  const hits = events
    .filter((event) => event.type === "ENEMY_HIT")
    .map((event) => event.amount ?? 0)
    .filter((amount) => amount > 0);

  if (hits.length === 0) {
    return 100;
  }

  const avg = hits.reduce((sum, value) => sum + value, 0) / hits.length;
  return Math.max(100, avg * 1.35);
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
