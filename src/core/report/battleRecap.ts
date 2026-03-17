import type { BattleRecap, BattleReport, CombatEvent } from "@/core/battle/types";
import { formatPercent } from "@/lib/format";

export function buildBattleRecap(report: BattleReport): BattleRecap {
  const incomingEvents = collectIncomingDamageEvents(report.combatEvents ?? []);
  const incomingBySource = sumIncomingBySource(incomingEvents);
  const topIncoming = incomingBySource[0] ?? { source: "未知来源", total: 0 };
  const maxSingle = incomingEvents[0] ?? null;
  const reasonSummary = buildReasonSummary(report, topIncoming.source);
  const keyPoint = buildKeyPoint(report);
  const suggestion = buildSuggestion(report);
  const dangerWindowSummary = buildDangerWindowSummary(report);

  return {
    outcomeText: report.win ? "通关" : "失败",
    reasonSummary,
    keyWinOrFailPoint: keyPoint,
    suggestion,
    outputSummary: {
      totalDamage: report.metrics.totalDamage,
      directRatio: report.metrics.directDamageRatio,
      dotRatio: report.metrics.dotDamageRatio,
      procRatio: report.metrics.procDamageRatio,
    },
    intakeSummary: {
      topSourceName: topIncoming.source,
      topSourceDamage: topIncoming.total,
      mostDangerousSource: maxSingle?.sourceName ?? "未知来源",
      maxSingleHit: maxSingle?.amount ?? 0,
      maxSingleHitTime: maxSingle?.time ?? null,
    },
    dangerWindowSummary,
  };
}

function buildReasonSummary(report: BattleReport, topIncomingSource: string): string {
  const metrics = report.metrics;
  if (report.win) {
    if ((report.combatEvents ?? []).some((event) => event.type === "BOSS_MECHANIC")) {
      return "通关关键：你在首领机制触发后仍维持了稳定输出。";
    }
    if (metrics.dotDamageRatio >= 0.42) {
      return "通关关键：DOT循环成型后持续压血，后段稳定收割。";
    }
    if (metrics.directDamageRatio >= 0.55) {
      return "通关关键：直伤压血效率高，中后段没有明显断档。";
    }
    return "通关关键：输出与生存节奏整体稳定，关键窗口处理到位。";
  }

  if (metrics.firstKillTime === null || metrics.firstKillTime > 12) {
    return "失败原因：前期首杀过慢，敌人数长时间不下降，承伤不断累积。";
  }
  if (metrics.enemyRemainingHpRatio > 0.4) {
    return "失败原因：中后段收尾不足，目标残血维持过久，战斗被拖长。";
  }
  if (metrics.resourceOverflowRate > 0.34) {
    return "失败原因：资源溢出明显，输出兑现效率不足。";
  }
  return `失败原因：承伤压力过高（主要来自${topIncomingSource}），生存链断裂。`;
}

function buildKeyPoint(report: BattleReport): string {
  const metrics = report.metrics;
  if (!report.win) {
    if (metrics.firstKillTime === null) {
      return "关键问题：整场未拿到首杀，清场节奏完全失控。";
    }
    if (metrics.firstKillTime > 12) {
      return `关键问题：首杀时间过晚（${metrics.firstKillTime.toFixed(1)}s）。`;
    }
    if (metrics.enemyRemainingHpRatio > 0.35) {
      return `关键问题：结束时敌方仍有 ${formatPercent(metrics.enemyRemainingHpRatio)} 血量池。`;
    }
    return "关键问题：中后段承伤峰值过高，未能撑到完整循环。";
  }

  if (metrics.firstKillTime !== null && metrics.firstKillTime <= 8) {
    return `关键优势：首杀形成很快（${metrics.firstKillTime.toFixed(1)}s），战斗节奏主动。`;
  }
  return "关键优势：资源与技能节奏稳定，没有出现明显断档。";
}

function buildSuggestion(report: BattleReport): string {
  const metrics = report.metrics;
  const archetype = report.context?.archetype;

  if (!report.win) {
    if (metrics.firstKillTime === null || metrics.firstKillTime > 12) {
      return "建议：补前中段清杂与启动能力，优先让首杀进入10秒内。";
    }
    if (metrics.enemyRemainingHpRatio > 0.4) {
      return "建议：补单体收尾或引爆窗口，不要让战斗拖入无效对砍。";
    }
    if (metrics.resourceOverflowRate > 0.34) {
      return "建议：加入高费输出或溢出转收益效果，提高资源兑现率。";
    }
    if (metrics.damageTaken > (report.context?.finalStats.hp ?? 1000) * 1.4) {
      return "建议：当前输出勉强够用，但生存偏弱，先补护盾/减伤。";
    }
    return "建议：优先修复当前层主要短板，再进行次级优化。";
  }

  if (archetype === "dot" && metrics.dotDamageRatio < 0.35) {
    return "建议：你已通关，但DOT占比偏低，可继续强化覆盖与引爆联动。";
  }
  if (archetype === "engine" && metrics.procDamageRatio < 0.25) {
    return "建议：你已通关，但触发兑现不足，可提升资源到触发的转化。";
  }
  return "建议：保持当前核心节奏，下一层优先针对压力类型做微调。";
}

function collectIncomingDamageEvents(events: CombatEvent[]): CombatEvent[] {
  return events
    .filter((event) => event.type === "ENEMY_HIT" || event.type === "ENEMY_HEAVY_HIT")
    .filter((event) => (event.amount ?? 0) > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

function sumIncomingBySource(events: CombatEvent[]): Array<{ source: string; total: number }> {
  const board = new Map<string, number>();
  for (const event of events) {
    const source = event.sourceName ?? "敌方攻击";
    board.set(source, (board.get(source) ?? 0) + (event.amount ?? 0));
  }
  return [...board.entries()]
    .map(([source, total]) => ({ source, total }))
    .sort((a, b) => b.total - a.total);
}

function buildDangerWindowSummary(report: BattleReport): string {
  const snapshots = report.combatSnapshots ?? [];
  if (snapshots.length === 0) {
    return "危险窗口：暂无快照数据。";
  }

  const peak = [...snapshots].sort(
    (a, b) => b.recentIncomingDamageWindow - a.recentIncomingDamageWindow,
  )[0];
  if (!peak || peak.recentIncomingDamageWindow <= 0) {
    return "危险窗口：承伤曲线整体平稳。";
  }

  const start = Math.max(0, peak.time - 2);
  return `危险窗口：${start.toFixed(1)}s ~ ${peak.time.toFixed(1)}s，2秒承伤峰值 ${Math.round(
    peak.recentIncomingDamageWindow,
  )}。`;
}
