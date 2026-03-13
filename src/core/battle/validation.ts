import { runAutoBattle } from "@/core/battle/simulator";
import type { BattleInput, BatchValidationSummary, DiagnosisEntry } from "@/core/battle/types";
import { buildBattleReport } from "@/core/report/reportBuilder";

interface RunBatchValidationInput {
  battleInput: Omit<BattleInput, "seedTag">;
  runCount: number;
}

export function runBatchValidation(input: RunBatchValidationInput): BatchValidationSummary {
  const runCount = clampRunCount(input.runCount);
  let winCount = 0;
  let totalDamage = 0;
  let startupTime = 0;
  let firstKillTime = 0;
  let firstKillCount = 0;
  let enemyRemainingHpRatio = 0;
  let damageTaken = 0;
  let resourceStarvedRate = 0;
  let resourceOverflowRate = 0;
  const diagnosisCounter = new Map<DiagnosisEntry["code"], number>();

  for (let index = 0; index < runCount; index += 1) {
    const battleInput: BattleInput = {
      ...input.battleInput,
      seedTag: `batch-${index}`,
    };
    const simulation = runAutoBattle(battleInput);
    const report = buildBattleReport({ input: battleInput, simulation });

    if (report.win) {
      winCount += 1;
    }
    totalDamage += report.metrics.totalDamage;
    startupTime += report.metrics.startupTime;
    if (report.metrics.firstKillTime !== null) {
      firstKillCount += 1;
      firstKillTime += report.metrics.firstKillTime;
    }
    enemyRemainingHpRatio += report.metrics.enemyRemainingHpRatio;
    damageTaken += report.metrics.damageTaken;
    resourceStarvedRate += report.metrics.resourceStarvedRate;
    resourceOverflowRate += report.metrics.resourceOverflowRate;

    for (const diagnosis of report.diagnosis) {
      diagnosisCounter.set(diagnosis.code, (diagnosisCounter.get(diagnosis.code) ?? 0) + 1);
    }
  }

  return {
    runCount,
    winRate: winCount / runCount,
    avgTotalDamage: totalDamage / runCount,
    avgStartupTime: startupTime / runCount,
    avgFirstKillTime: firstKillCount > 0 ? firstKillTime / firstKillCount : null,
    avgEnemyRemainingHpRatio: enemyRemainingHpRatio / runCount,
    avgDamageTaken: damageTaken / runCount,
    avgResourceStarvedRate: resourceStarvedRate / runCount,
    avgResourceOverflowRate: resourceOverflowRate / runCount,
    topDiagnosis: [...diagnosisCounter.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count, rate: count / runCount })),
  };
}

function clampRunCount(raw: number): number {
  const normalized = Math.floor(raw);
  if (!Number.isFinite(normalized)) {
    return 10;
  }
  return Math.max(1, Math.min(200, normalized));
}
