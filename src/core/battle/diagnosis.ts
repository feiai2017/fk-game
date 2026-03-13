import type {
  ArchetypeKey,
  BattleMetrics,
  DiagnosisEntry,
  FloorDef,
} from "@/core/battle/types";
import { ratio } from "@/core/report/breakdown";

interface DiagnoseInput {
  win: boolean;
  floor: FloorDef;
  archetype: ArchetypeKey;
  metrics: BattleMetrics;
}

export function diagnoseBattle(input: DiagnoseInput): DiagnosisEntry[] {
  const { win, floor, archetype, metrics } = input;
  const diagnoses: DiagnosisEntry[] = [];
  const totalEnemyHp = floor.enemyHp * floor.enemyCount;
  const firstKillTime = metrics.firstKillTime ?? metrics.duration;
  const isSingleTargetPressure = floor.boss || floor.enemyCount === 1 || floor.pressure === "single";
  const startupGate = isSingleTargetPressure ? 6.8 : 8.2;
  const clearGate = isSingleTargetPressure ? 13 : 17;
  const startupSlow = metrics.startupTime > startupGate;
  const clearInefficient = !isSingleTargetPressure && firstKillTime > clearGate;
  const timingAcceptable = !startupSlow && !clearInefficient;
  const expectedSustainDps = totalEnemyHp / Math.max(1, metrics.duration);
  const lowRawDamage =
    metrics.enemyRemainingHpRatio > 0.2 &&
    metrics.sustainDps < expectedSustainDps * 0.82 &&
    timingAcceptable;

  if (!win && metrics.remainingHp <= 0) {
    pushDiagnosis(diagnoses, {
      code: "LOW_SURVIVAL",
      message: "生存不足：角色在完成输出循环前被击败。",
    });
  }
  if (!win && startupSlow) {
    pushDiagnosis(diagnoses, {
      code: "SLOW_STARTUP",
      message: "启动过慢：前期有效输出建立过晚，错过了压血窗口。",
    });
  }
  if (!win && clearInefficient) {
    pushDiagnosis(diagnoses, {
      code: "LOW_CLEAR_EFFICIENCY",
      message: "清场效率低：起手尚可，但首杀过慢导致群怪压力累积。",
    });
  }
  if (!win && isSingleTargetPressure && metrics.enemyRemainingHpRatio > 0.3 && metrics.duration > 24) {
    pushDiagnosis(diagnoses, {
      code: "LOW_SINGLE_TARGET_FINISH",
      message: "单体收尾不足：战斗后段仍有较高敌方血量未压下。",
    });
  }
  if (!win && lowRawDamage) {
    pushDiagnosis(diagnoses, {
      code: "LOW_RAW_DAMAGE",
      message: "原始伤害不足：时机基本正常，但单位时间伤害不够。",
    });
  }

  if (metrics.resourceOverflowRate > 0.36 && metrics.coreTriggerRatio < 0.2) {
    pushDiagnosis(diagnoses, {
      code: "RESOURCE_WASTE",
      message: "资源浪费：溢出率偏高，未有效转化为触发/护盾收益。",
    });
  } else if (metrics.resourceStarvedRate > 0.34) {
    pushDiagnosis(diagnoses, {
      code: "RESOURCE_STARVED",
      message: "资源不足：技能多次就绪但无法释放。",
    });
  }

  const lowMechanic = isLowMechanicContribution(archetype, metrics);
  if (lowMechanic) {
    pushDiagnosis(diagnoses, {
      code: "LOW_MECHANIC_CONTRIBUTION",
      message: lowMechanic,
    });
  }

  if (!win && diagnoses.length === 0 && metrics.enemyRemainingHpRatio > 0.2) {
    pushDiagnosis(diagnoses, {
      code: "LOW_RAW_DAMAGE",
      message: "综合吞吐不足：当前构筑未达到该层最低输出阈值。",
    });
  }

  return diagnoses.slice(0, 3);
}

function isLowMechanicContribution(
  archetype: ArchetypeKey,
  metrics: BattleMetrics,
): string | undefined {
  const dotRatio = ratio(metrics.dotDamage, metrics.totalDamage);
  const procRatio = ratio(metrics.procDamage, metrics.totalDamage);

  switch (archetype) {
    case "dot":
      if (dotRatio < 0.33) {
        return "机制贡献低：DOT占比不足，铺层与引爆联动偏弱。";
      }
      return undefined;
    case "engine":
      if (procRatio < 0.3 || metrics.coreTriggerRatio < 0.08) {
        return "机制贡献低：资源循环未形成稳定触发链。";
      }
      return undefined;
    case "crit":
      if (metrics.directDamageRatio < 0.6 || metrics.skillRatio < 0.5) {
        return "机制贡献低：暴击直伤链条贡献不足，终结窗口价值偏低。";
      }
      return undefined;
    default:
      return undefined;
  }
}

function pushDiagnosis(target: DiagnosisEntry[], next: DiagnosisEntry): void {
  if (target.some((entry) => entry.code === next.code)) {
    return;
  }
  target.push(next);
}
