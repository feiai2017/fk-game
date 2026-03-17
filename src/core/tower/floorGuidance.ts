import type { FloorDef, FloorGuidance } from "@/core/battle/types";

export function buildFloorGuidance(floor: FloorDef): FloorGuidance {
  if (floor.floor === 7) {
    return {
      primaryObjective: "首杀速度 + 前期清场效率",
      secondaryObjective: "尽快减少存活敌人数，避免群体压力滚雪球",
      failurePatternSummary: "最常见失败是首杀过慢，随后承伤快速累积并失控。",
      recommendedMetricFocus: [
        "firstKillTime",
        "startupTime",
        "damageTaken",
        "enemyRemainingHpRatio",
      ],
      dangerWindowSummary: "高危窗口通常在 8s-18s，若这段拿不到首杀很容易崩盘。",
      likelyCauseLine: "你通常不是被单次爆发秒杀，而是被叠加压力拖死。",
      bottleneckTags: ["startup", "clear", "survival"],
    };
  }

  switch (floor.pressure) {
    case "swarm":
      return {
        primaryObjective: "快速减员",
        secondaryObjective: "在中期持续压低敌人数",
        failurePatternSummary: "开局慢会导致敌人存活时间过长，承伤持续偏高。",
        recommendedMetricFocus: ["firstKillTime", "damageTaken", "enemyRemainingHpRatio"],
        dangerWindowSummary: "中期群体叠压是关键危险窗口。",
        likelyCauseLine: "首杀延后时，本层通常会很快崩盘。",
        bottleneckTags: ["startup", "clear", "survival"],
      };
    case "burst":
      return {
        primaryObjective: "稳住中期承伤",
        secondaryObjective: "减少输出断档",
        failurePatternSummary: "资源链断档会被连续重击放大惩罚。",
        recommendedMetricFocus: ["resourceStarvedRate", "damageTaken", "sustainDps"],
        dangerWindowSummary: "10s-22s 若循环断裂会非常危险。",
        likelyCauseLine: "多为节奏断裂问题，不是纯面板不够。",
        bottleneckTags: ["resource", "survival", "throughput"],
      };
    case "single":
      return {
        primaryObjective: "单体收尾",
        secondaryObjective: "把握斩杀窗口",
        failurePatternSummary: "前期压力可控，但后段收尾速度不足。",
        recommendedMetricFocus: ["enemyRemainingHpRatio", "sustainDps", "resourceOverflowRate"],
        dangerWindowSummary: "战斗后 1/3 决定胜负。",
        likelyCauseLine: "典型问题是收尾不足，而非开局不足。",
        bottleneckTags: ["single", "throughput"],
      };
    case "sustain":
      return {
        primaryObjective: "长线循环稳定",
        secondaryObjective: "保证后期机制持续在线",
        failurePatternSummary: "后段循环掉速会让伤害与收益同时下滑。",
        recommendedMetricFocus: [
          "resourceStarvedRate",
          "resourceOverflowRate",
          "damageTaken",
          "dotDamageRatio",
        ],
        dangerWindowSummary: "20s 之后更看重稳定循环而非瞬时爆发。",
        likelyCauseLine: "主要失败点是后期循环崩溃。",
        bottleneckTags: ["survival", "resource", "mechanic"],
      };
    case "antiMechanic":
      return {
        primaryObjective: "在机制受压下维持输出",
        secondaryObjective: "保留直伤兜底",
        failurePatternSummary: "机制收益被压制后，总伤害会明显下滑。",
        recommendedMetricFocus: ["totalDamage", "dotDamageRatio", "procDamageRatio", "enemyRemainingHpRatio"],
        dangerWindowSummary: "中后期会暴露过度依赖机制的风险。",
        likelyCauseLine: "机制被克制后没有兜底输出接管。",
        bottleneckTags: ["mechanic", "throughput", "single"],
      };
    case "baseline":
    default:
      return {
        primaryObjective: "基础循环验证",
        secondaryObjective: "稳定完成首轮核心循环",
        failurePatternSummary: "技能链断裂会引发启动慢和资源紊乱。",
        recommendedMetricFocus: ["startupTime", "firstKillTime", "resourceStarvedRate"],
        dangerWindowSummary: "前 12 秒决定循环是否成型。",
        likelyCauseLine: "多数失败来自循环启动质量。",
        bottleneckTags: ["startup", "resource", "clear"],
      };
  }
}
