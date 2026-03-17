import type { BattleAnalysisExport } from "@/core/report/exportBattleReport";

export function buildBattleAnalysisMarkdown(bundle: BattleAnalysisExport): string {
  const topSources = bundle.aggregateMetrics.damageBySource.slice(0, 3);
  const dangerWindow = bundle.windows.dangerWindow;
  const likelyReason = bundle.resultSummary.likelyReason;

  const lines: string[] = [
    `# 战斗分析摘要`,
    ``,
    `- 楼层: ${bundle.floorContext.floorIndex} (${bundle.floorContext.pressureType})`,
    `- 流派: ${bundle.buildContext.archetype}`,
    `- 结果: ${bundle.resultSummary.win ? "胜利" : "失败"}`,
    `- 时长: ${bundle.resultSummary.duration.toFixed(1)}s`,
    `- 首杀时间: ${
      bundle.resultSummary.firstKillTime === null
        ? "无"
        : `${bundle.resultSummary.firstKillTime.toFixed(1)}s`
    }`,
    `- 失败剩余血量比: ${(bundle.resultSummary.enemyRemainingHpRatio * 100).toFixed(1)}%`,
    ``,
    `## 主要伤害来源`,
  ];

  if (topSources.length === 0) {
    lines.push(`- 无`);
  } else {
    for (const source of topSources) {
      lines.push(
        `- ${source.sourceName} (${source.category}): ${source.total.toFixed(1)} (${(
          (source.total / Math.max(bundle.aggregateMetrics.damageBySource.reduce((sum, entry) => sum + entry.total, 0), 1)) *
          100
        ).toFixed(1)}%)`,
      );
    }
  }

  lines.push(``, `## 胜负原因判断`, `- ${likelyReason}`);

  if (bundle.resultSummary.deathCause) {
    lines.push(
      `- 死亡时间: ${
        bundle.resultSummary.deathTime === null ? "未知" : `${bundle.resultSummary.deathTime.toFixed(1)}s`
      }`,
      `- 死亡原因: ${bundle.resultSummary.deathCause}`,
    );
  }

  lines.push(``, `## 危险窗口`);
  if (!dangerWindow) {
    lines.push(`- 未检测到明显危险窗口`);
  } else {
    lines.push(
      `- 时间段: ${dangerWindow.start.toFixed(1)}s ~ ${dangerWindow.end.toFixed(1)}s`,
      `- 窗口事件数: ${dangerWindow.events.length}`,
      `- 窗口快照数: ${dangerWindow.snapshots.length}`,
    );
  }

  lines.push(``, `---`, `- reportVersion: ${bundle.reportVersion}`, `- generatedAt: ${bundle.generatedAt}`);
  return lines.join("\n");
}
