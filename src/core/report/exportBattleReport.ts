import type {
  BattleReport,
  CombatEvent,
  CombatSnapshot,
  DiagnosisEntry,
  RunProgress,
  SkillDef,
  Stats,
} from "@/core/battle/types";
import { APP_VERSION } from "@/data/constants";

export const ANALYSIS_REPORT_VERSION = "1.0.0";

export interface BattleAnalysisExport {
  reportVersion: string;
  appVersion: string;
  generatedAt: string;
  seed: string | null;
  runId: string | null;
  floorId: string;
  floorContext: {
    floorIndex: number;
    pressureType: string;
    enemyDef: number;
    enemyResist: number;
    notableRules: string[];
    floorModifiers: string[];
  };
  buildContext: {
    archetype: string;
    selectedSkills: Array<{
      id: string;
      name: string;
      cooldown: number;
      cost: number;
      tags: string[];
    }>;
    finalStats: Stats;
    equippedItems: Array<{ id: string; name: string; slot: string }>;
    passives: Array<{ id: string; event: string; value?: number; value2?: number }>;
    relics: Array<{ id: string; name: string }>;
    runModifiers: {
      selectedRewards: Array<{ floor: number; title: string; category: string }>;
      statBonuses: Partial<Stats>;
      skillUpgrades: Record<string, unknown>;
      passiveEffects: Array<{ id: string; event: string; value?: number; value2?: number }>;
      relicIds: string[];
    };
  };
  resultSummary: {
    win: boolean;
    duration: number;
    deathTime: number | null;
    deathCause: string | null;
    firstKillTime: number | null;
    enemyRemainingHpRatio: number;
    likelyReason: string;
  };
  aggregateMetrics: {
    damageBySource: BattleReport["metrics"]["damageBySource"];
    damageTakenBySource: Array<{ sourceId: string; sourceName: string; total: number }>;
    skillUsage: Array<{ skillId: string; skillName: string; casts: number; totalDamage: number }>;
    resourceFlow: {
      gained: number;
      spent: number;
      overflowEvents: number;
      net: number;
    };
    killTimeline: Array<{ time: number; targetId?: number | string; sourceName?: string }>;
    survivalSummary: {
      remainingHp: number;
      damageTaken: number;
      deathTime: number | null;
      deathCause: string | null;
      dangerPeakTime: number | null;
      dangerPeakIncoming: number;
    };
  };
  events: AnalysisCombatEvent[];
  snapshots: CombatSnapshot[];
  windows: {
    firstKillWindow: AnalysisWindow | null;
    dangerWindow: AnalysisWindow | null;
    preDeathWindow: AnalysisWindow | null;
  };
  diagnosis: DiagnosisEntry[];
}

export interface AnalysisCombatEvent {
  time: number;
  category: CombatEvent["category"];
  type: CombatEvent["type"];
  sourceId: string | null;
  sourceName: string | null;
  targetId: number | string | null;
  targetName: string | null;
  amount: number | null;
  tags: string[];
  metadata?: Record<string, number | string | boolean | null | undefined>;
}

export interface AnalysisWindow {
  start: number;
  end: number;
  events: AnalysisCombatEvent[];
  snapshots: CombatSnapshot[];
}

interface BuildBattleAnalysisInput {
  report: BattleReport;
  runId?: string | null;
  runProgress?: RunProgress;
  generatedAt?: Date;
}

export function buildBattleAnalysisExport(input: BuildBattleAnalysisInput): BattleAnalysisExport {
  const { report, runId = null, runProgress } = input;
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const events = normalizeEvents(report.combatEvents ?? []);
  const snapshots = report.combatSnapshots ?? [];
  const death = resolveDeath(events);
  const danger = resolveDangerWindow(snapshots, events, report.metrics.duration);

  const firstKillWindow =
    report.metrics.firstKillTime !== null
      ? buildWindow(events, snapshots, Math.max(0, report.metrics.firstKillTime - 3), report.metrics.firstKillTime + 3)
      : null;
  const preDeathWindow =
    !report.win && death.time !== null ? buildWindow(events, snapshots, Math.max(0, death.time - 8), death.time) : null;
  const likelyReason = report.diagnosis[0]?.message ?? (report.win ? "输出与生存达到通关阈值" : "综合战斗表现未达标");

  return {
    reportVersion: ANALYSIS_REPORT_VERSION,
    appVersion: APP_VERSION,
    generatedAt,
    seed: report.context?.seed ?? null,
    runId,
    floorId: `floor-${report.floor}`,
    floorContext: {
      floorIndex: report.floor,
      pressureType: report.pressure,
      enemyDef: report.context?.floor.enemyDef ?? 0,
      enemyResist: report.context?.floor.enemyResist ?? 0,
      notableRules: report.context?.floor.notes ? [report.context.floor.notes] : [],
      floorModifiers: report.guidance
        ? [
            report.guidance.floorObjective.primaryObjective,
            report.guidance.floorObjective.secondaryObjective,
            report.guidance.floorObjective.dangerWindowSummary,
          ]
        : [],
    },
    buildContext: {
      archetype: report.context?.archetype ?? "unknown",
      selectedSkills: (report.context?.selectedSkills ?? []).map((skill) => toSkillSummary(skill)),
      finalStats: report.context?.finalStats ?? emptyStats(),
      equippedItems: collectEquippedItems(report),
      passives: collectPassives(report, runProgress),
      relics: collectRelics(report, runProgress),
      runModifiers: {
        selectedRewards: (runProgress?.selectedRewards ?? []).map((reward) => ({
          floor: reward.floor,
          title: reward.title,
          category: reward.category,
        })),
        statBonuses: runProgress?.statBonuses ?? {},
        skillUpgrades: runProgress?.skillUpgrades ?? {},
        passiveEffects: (runProgress?.passiveEffects ?? []).map((effect) => ({
          id: effect.id,
          event: effect.event,
          value: effect.value,
          value2: effect.value2,
        })),
        relicIds: runProgress?.relicIds ?? [],
      },
    },
    resultSummary: {
      win: report.win,
      duration: report.metrics.duration,
      deathTime: death.time,
      deathCause: death.cause,
      firstKillTime: report.metrics.firstKillTime,
      enemyRemainingHpRatio: report.metrics.enemyRemainingHpRatio,
      likelyReason,
    },
    aggregateMetrics: {
      damageBySource: report.metrics.damageBySource,
      damageTakenBySource: buildDamageTakenBySource(events),
      skillUsage: buildSkillUsage(report.context?.selectedSkills ?? [], events, report.metrics.damageBySource),
      resourceFlow: buildResourceFlow(events),
      killTimeline: events
        .filter((event) => event.type === "ENEMY_KILL")
        .map((event) => ({ time: event.time, targetId: event.targetId ?? undefined, sourceName: event.sourceName ?? undefined })),
      survivalSummary: {
        remainingHp: report.metrics.remainingHp,
        damageTaken: report.metrics.damageTaken,
        deathTime: death.time,
        deathCause: death.cause,
        dangerPeakTime: danger?.peakTime ?? null,
        dangerPeakIncoming: danger?.peakIncoming ?? 0,
      },
    },
    events,
    snapshots,
    windows: {
      firstKillWindow,
      dangerWindow: danger ? buildWindow(events, snapshots, danger.start, danger.end) : null,
      preDeathWindow,
    },
    diagnosis: report.diagnosis,
  };
}

function normalizeEvents(events: CombatEvent[]): AnalysisCombatEvent[] {
  return events.map((event) => ({
    time: event.time,
    category: event.category,
    type: event.type,
    sourceId: event.sourceId ?? null,
    sourceName: event.sourceName ?? null,
    targetId: event.targetId ?? null,
    targetName: event.targetName ?? null,
    amount: event.amount ?? event.value ?? null,
    tags: event.tags ?? [],
    metadata: event.metadata ?? event.meta,
  }));
}

function resolveDeath(events: AnalysisCombatEvent[]): { time: number | null; cause: string | null } {
  const death = events.find((event) => event.type === "PLAYER_DEATH");
  if (death) {
    const prior = [...events]
      .filter((event) => event.time <= death.time && (event.type === "ENEMY_HEAVY_HIT" || event.type === "ENEMY_HIT"))
      .sort((left, right) => right.time - left.time)[0];
    return {
      time: death.time,
      cause: prior?.type === "ENEMY_HEAVY_HIT" ? "敌方重击压垮生存" : "持续承伤击败",
    };
  }
  const timeout = events.find((event) => event.type === "BATTLE_END" && event.tags.includes("timeout"));
  if (timeout) {
    return { time: timeout.time, cause: "战斗超时" };
  }
  return { time: null, cause: null };
}

function resolveDangerWindow(
  snapshots: CombatSnapshot[],
  events: AnalysisCombatEvent[],
  duration: number,
): { start: number; end: number; peakTime: number; peakIncoming: number } | null {
  if (snapshots.length === 0) {
    const heavy = events.find((event) => event.type === "ENEMY_HEAVY_HIT");
    if (!heavy) {
      return null;
    }
    return {
      start: Math.max(0, heavy.time - 3),
      end: Math.min(duration, heavy.time + 3),
      peakTime: heavy.time,
      peakIncoming: heavy.amount ?? 0,
    };
  }
  const peak = [...snapshots].sort(
    (left, right) => right.recentIncomingDamageWindow - left.recentIncomingDamageWindow,
  )[0];
  if (!peak || peak.recentIncomingDamageWindow <= 0) {
    return null;
  }
  return {
    start: Math.max(0, peak.time - 3),
    end: Math.min(duration, peak.time + 3),
    peakTime: peak.time,
    peakIncoming: peak.recentIncomingDamageWindow,
  };
}

function buildWindow(
  events: AnalysisCombatEvent[],
  snapshots: CombatSnapshot[],
  start: number,
  end: number,
): AnalysisWindow {
  return {
    start,
    end,
    events: events.filter((event) => event.time >= start && event.time <= end),
    snapshots: snapshots.filter((snapshot) => snapshot.time >= start && snapshot.time <= end),
  };
}

function buildDamageTakenBySource(
  events: AnalysisCombatEvent[],
): Array<{ sourceId: string; sourceName: string; total: number }> {
  const counter = new Map<string, { sourceId: string; sourceName: string; total: number }>();
  for (const event of events) {
    if (event.type !== "ENEMY_HIT" && event.type !== "ENEMY_HEAVY_HIT") {
      continue;
    }
    const amount = event.amount ?? 0;
    if (amount <= 0) {
      continue;
    }
    const sourceId = event.sourceId ?? "enemy_attack";
    const sourceName = event.sourceName ?? "敌方攻击";
    const key = `${sourceId}:${sourceName}`;
    const prev = counter.get(key);
    if (prev) {
      prev.total += amount;
    } else {
      counter.set(key, { sourceId, sourceName, total: amount });
    }
  }
  return [...counter.values()].sort((left, right) => right.total - left.total);
}

function buildSkillUsage(
  skills: SkillDef[],
  events: AnalysisCombatEvent[],
  damageBySource: BattleReport["metrics"]["damageBySource"],
): Array<{ skillId: string; skillName: string; casts: number; totalDamage: number }> {
  const rows = new Map<string, { skillId: string; skillName: string; casts: number; totalDamage: number }>();
  for (const skill of skills) {
    rows.set(skill.id, { skillId: skill.id, skillName: skill.name, casts: 0, totalDamage: 0 });
  }
  for (const event of events) {
    if (event.type !== "SKILL_CAST" || !event.tags.includes("cast") || !event.sourceId) {
      continue;
    }
    const row = rows.get(event.sourceId);
    if (row) {
      row.casts += 1;
    }
  }
  for (const entry of damageBySource) {
    const row = rows.get(entry.sourceId);
    if (row) {
      row.totalDamage += entry.total;
    }
  }
  return [...rows.values()].sort((left, right) => right.totalDamage - left.totalDamage);
}

function buildResourceFlow(events: AnalysisCombatEvent[]): {
  gained: number;
  spent: number;
  overflowEvents: number;
  net: number;
} {
  let gained = 0;
  let spent = 0;
  let overflowEvents = 0;
  for (const event of events) {
    if (event.type === "RESOURCE_GAIN") {
      gained += event.amount ?? 0;
    } else if (event.type === "RESOURCE_SPEND") {
      spent += event.amount ?? 0;
    } else if (event.type === "RESOURCE_OVERFLOW") {
      overflowEvents += 1;
    }
  }
  return { gained, spent, overflowEvents, net: gained - spent };
}

function collectEquippedItems(report: BattleReport): Array<{ id: string; name: string; slot: string }> {
  const loadout = report.context?.loadout;
  if (!loadout) {
    return [];
  }
  const items = [loadout.weapon, loadout.helm, loadout.armor, loadout.ring1, loadout.ring2, loadout.core];
  return items
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, slot: item.slot }));
}

function collectPassives(
  report: BattleReport,
  runProgress?: RunProgress,
): Array<{ id: string; event: string; value?: number; value2?: number }> {
  const equipped = collectEquippedItemsWithEffects(report);
  const runEffects = runProgress?.passiveEffects ?? [];
  return [...equipped, ...runEffects].map((effect) => ({
    id: effect.id,
    event: effect.event,
    value: effect.value,
    value2: effect.value2,
  }));
}

function collectRelics(report: BattleReport, runProgress?: RunProgress): Array<{ id: string; name: string }> {
  const equippedCore = report.context?.loadout.core;
  const rows: Array<{ id: string; name: string }> = [];
  if (equippedCore) {
    rows.push({ id: equippedCore.id, name: equippedCore.name });
  }
  for (const relicId of runProgress?.relicIds ?? []) {
    if (!rows.some((entry) => entry.id === relicId)) {
      rows.push({ id: relicId, name: relicId });
    }
  }
  return rows;
}

function collectEquippedItemsWithEffects(report: BattleReport) {
  const loadout = report.context?.loadout;
  if (!loadout) {
    return [];
  }
  const items = [loadout.weapon, loadout.helm, loadout.armor, loadout.ring1, loadout.ring2, loadout.core];
  return items.flatMap((item) => item?.mechanicEffects ?? []);
}

function toSkillSummary(skill: SkillDef): {
  id: string;
  name: string;
  cooldown: number;
  cost: number;
  tags: string[];
} {
  return {
    id: skill.id,
    name: skill.name,
    cooldown: skill.cooldown,
    cost: skill.cost,
    tags: [...skill.tags],
  };
}

function emptyStats(): Stats {
  return {
    hp: 0,
    atk: 0,
    def: 0,
    speed: 0,
    crit: 0,
    critDamage: 0,
    skillPower: 0,
    dotPower: 0,
    procPower: 0,
    resist: 0,
    regen: 0,
    shieldPower: 0,
    cdr: 0,
    resourceMax: 0,
    resourceRegen: 0,
  };
}
