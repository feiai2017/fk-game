import { diagnoseBattle } from "@/core/battle/diagnosis";
import { runAutoBattle } from "@/core/battle/simulator";
import type {
  ArchetypeFloorDiagnosis,
  ArchetypeKey,
  BatchDiagnosisTrend,
  BattleInput,
  DiagnosisEntry,
  FocusedFloorDiagnosis,
  TuningBottleneckTag,
} from "@/core/battle/types";
import { SKILLS } from "@/data/skills";

interface BuildFocusedDiagnosisInput {
  baseInput: BattleInput;
  runCount?: number;
}

export function buildFocusedFloorDiagnosis(
  input: BuildFocusedDiagnosisInput,
): FocusedFloorDiagnosis | undefined {
  if (input.baseInput.floor.floor !== 7) {
    return undefined;
  }
  const runCount = Math.max(6, Math.min(30, input.runCount ?? 12));
  const archetypes: ArchetypeKey[] = ["dot", "crit", "engine"];

  const findings = archetypes.map((archetype) =>
    runArchetypeDiagnosis({
      archetype,
      runCount,
      baseInput: input.baseInput,
    }),
  );
  const dominant = dominantBottleneck(findings);
  const veryLowWinAll = findings.every((entry) => entry.winRate < 0.2);

  const recommendedFirstAction: FocusedFloorDiagnosis["recommendedFirstAction"] =
    veryLowWinAll && dominant === "survival"
      ? "light floor retuning"
      : dominant === "startup" || dominant === "clear"
        ? "skill adjustment"
        : dominant === "resource"
          ? "slot/item adjustment"
          : "build adjustment";

  return {
    floor: 7,
    mainTest: "首杀速度与前中段清场效率，避免群怪持续存活叠加承伤",
    archetypeFindings: findings,
    overallConclusion: buildConclusion(findings, dominant, recommendedFirstAction),
    recommendedFirstAction,
    evidenceNote: findings
      .map((entry) => `${entry.archetype} 胜率 ${(entry.winRate * 100).toFixed(0)}%`)
      .join("；"),
  };
}

interface RunArchetypeDiagnosisInput {
  archetype: ArchetypeKey;
  baseInput: BattleInput;
  runCount: number;
}

function runArchetypeDiagnosis(input: RunArchetypeDiagnosisInput): ArchetypeFloorDiagnosis {
  let winCount = 0;
  let startupSum = 0;
  let firstKillSum = 0;
  let firstKillCount = 0;
  let enemyRemainingSum = 0;
  let damageTakenSum = 0;
  let starvedSum = 0;
  let overflowSum = 0;
  const diagnosisCounter = new Map<DiagnosisEntry["code"], number>();

  const skills = SKILLS.filter((skill) => skill.archetype === input.archetype).slice(0, 3);

  for (let index = 0; index < input.runCount; index += 1) {
    const simulation = runAutoBattle({
      ...input.baseInput,
      archetype: input.archetype,
      skills,
      seedTag: `f7-${input.archetype}-${index}`,
    });
    if (simulation.win) {
      winCount += 1;
    }
    startupSum += simulation.metrics.startupTime;
    if (simulation.metrics.firstKillTime !== null) {
      firstKillSum += simulation.metrics.firstKillTime;
      firstKillCount += 1;
    }
    enemyRemainingSum += simulation.metrics.enemyRemainingHpRatio;
    damageTakenSum += simulation.metrics.damageTaken;
    starvedSum += simulation.metrics.resourceStarvedRate;
    overflowSum += simulation.metrics.resourceOverflowRate;

    const diagnosis = diagnoseBattle({
      win: simulation.win,
      floor: input.baseInput.floor,
      archetype: input.archetype,
      metrics: simulation.metrics,
    });
    for (const entry of diagnosis) {
      diagnosisCounter.set(entry.code, (diagnosisCounter.get(entry.code) ?? 0) + 1);
    }
  }

  const topDiagnosis: BatchDiagnosisTrend[] = [...diagnosisCounter.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([code, count]) => ({ code, count, rate: count / input.runCount }));

  const primaryBottleneck = classifyBottleneck({
    topDiagnosis,
    winRate: winCount / input.runCount,
    avgFirstKillTime: firstKillCount > 0 ? firstKillSum / firstKillCount : null,
    avgEnemyRemainingHpRatio: enemyRemainingSum / input.runCount,
  });

  return {
    archetype: input.archetype,
    runCount: input.runCount,
    winRate: winCount / input.runCount,
    avgStartupTime: startupSum / input.runCount,
    avgFirstKillTime: firstKillCount > 0 ? firstKillSum / firstKillCount : null,
    avgEnemyRemainingHpRatio: enemyRemainingSum / input.runCount,
    avgDamageTaken: damageTakenSum / input.runCount,
    avgResourceStarvedRate: starvedSum / input.runCount,
    avgResourceOverflowRate: overflowSum / input.runCount,
    topDiagnosis,
    primaryBottleneck,
    finding: buildFindingLine(primaryBottleneck, input.archetype),
  };
}

function classifyBottleneck(input: {
  topDiagnosis: BatchDiagnosisTrend[];
  winRate: number;
  avgFirstKillTime: number | null;
  avgEnemyRemainingHpRatio: number;
}): TuningBottleneckTag {
  const topCode = input.topDiagnosis[0]?.code;
  if (topCode) {
    return mapCodeToBottleneck(topCode);
  }
  if (input.avgFirstKillTime === null || input.avgFirstKillTime > 12) {
    return "clear";
  }
  if (input.avgEnemyRemainingHpRatio > 0.3) {
    return "single";
  }
  if (input.winRate < 0.4) {
    return "throughput";
  }
  return "resource";
}

function mapCodeToBottleneck(code: DiagnosisEntry["code"]): TuningBottleneckTag {
  switch (code) {
    case "SLOW_STARTUP":
      return "startup";
    case "LOW_CLEAR_EFFICIENCY":
      return "clear";
    case "LOW_SINGLE_TARGET_FINISH":
      return "single";
    case "LOW_SURVIVAL":
      return "survival";
    case "RESOURCE_STARVED":
    case "RESOURCE_OVERFLOW":
    case "RESOURCE_WASTE":
      return "resource";
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return "mechanic";
    case "LOW_RAW_DAMAGE":
    case "LOW_DAMAGE":
    default:
      return "throughput";
  }
}

function buildFindingLine(
  bottleneck: TuningBottleneckTag,
  archetype: ArchetypeKey,
): string {
  switch (bottleneck) {
    case "startup":
      return `${archetype} 当前主要卡在前段起手，首杀前有效输出不足。`;
    case "clear":
      return `${archetype} 当前主要卡在清场，敌方并存时间过长。`;
    case "single":
      return `${archetype} 当前主要卡在后段收尾，压血后缺终结。`;
    case "survival":
      return `${archetype} 当前主要卡在承伤，循环尚未兑现前先倒下。`;
    case "resource":
      return `${archetype} 当前主要卡在资源兑现，循环效率不足。`;
    case "mechanic":
      return `${archetype} 当前机制占比偏低，核心玩法没有跑起来。`;
    case "throughput":
    default:
      return `${archetype} 当前主要卡在总吞吐不足。`;
  }
}

function dominantBottleneck(
  findings: ArchetypeFloorDiagnosis[],
): TuningBottleneckTag {
  const counter = new Map<TuningBottleneckTag, number>();
  for (const finding of findings) {
    counter.set(
      finding.primaryBottleneck,
      (counter.get(finding.primaryBottleneck) ?? 0) + 1,
    );
  }
  return [...counter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "throughput";
}

function buildConclusion(
  findings: ArchetypeFloorDiagnosis[],
  dominant: TuningBottleneckTag,
  action: FocusedFloorDiagnosis["recommendedFirstAction"],
): string {
  const lowWinCount = findings.filter((entry) => entry.winRate < 0.35).length;
  if (lowWinCount >= 2 && dominant === "clear") {
    return "Floor 7 主要是清场/首杀门槛测试，当前更像构筑与技能时序问题，不是纯数值墙。";
  }
  if (lowWinCount === findings.length && dominant === "survival" && action === "light floor retuning") {
    return "三流派都在中段生存崩盘，Floor 7 可能略偏紧，可考虑小幅下调并存承伤压力。";
  }
  return "Floor 7 失败主因更偏向构筑兑现不足；优先做定向调整，再考虑小幅层数修正。";
}
