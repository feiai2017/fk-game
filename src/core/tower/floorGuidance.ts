import type { FloorDef, FloorGuidance } from "@/core/battle/types";

export function buildFloorGuidance(floor: FloorDef): FloorGuidance {
  const byPressure = guidanceByPressure(floor);
  if (floor.floor === 7) {
    return {
      ...byPressure,
      primaryObjective: "首杀速度与前 12 秒清场节奏",
      secondaryObjective: "避免怪群长时间存活导致持续承伤失控",
      failurePatternSummary:
        "这层最常见失败是首杀偏慢，导致敌方数量长期维持在高位，累计伤害在中段快速滚大。",
      recommendedMetricFocus: ["首杀时间", "启动时间", "承受伤害", "敌方剩余血量比"],
      dangerWindowSummary: "危险窗口：战斗 8-18 秒；若此时仍未完成首杀，生存压力会指数上升。",
      likelyCauseLine: "你大概率死于“首杀慢 + 敌方存活过多”叠加，而不是单次爆发秒杀。",
    };
  }
  return byPressure;
}

function guidanceByPressure(floor: FloorDef): FloorGuidance {
  switch (floor.pressure) {
    case "swarm":
      return {
        primaryObjective: "首杀速度与前中段清场效率",
        secondaryObjective: "压低敌方并存数量，避免持续围攻",
        failurePatternSummary: "起手伤害不足会让怪群数量居高不下，最终在中段被持续伤害压垮。",
        recommendedMetricFocus: ["首杀时间", "启动时间", "承受伤害", "敌方剩余血量比"],
        dangerWindowSummary: "危险窗口：8-18 秒，若仍未形成稳定减员，承伤会迅速累积。",
        likelyCauseLine: "最可能致死点是群怪长期存活导致的持续叠伤。",
        bottleneckTags: ["startup", "clear", "survival"],
      };
    case "burst":
      return {
        primaryObjective: "中段承伤稳定与输出节奏连续性",
        secondaryObjective: "减少资源断档导致的伤害真空期",
        failurePatternSummary: "前段看似顺利，但中段节奏断层后会吃到高爆发并连锁崩盘。",
        recommendedMetricFocus: ["承受伤害", "资源匮乏率", "持续DPS", "剩余生命"],
        dangerWindowSummary: "危险窗口：10-22 秒，断档后容易连续吃满敌方高压打击。",
        likelyCauseLine: "你通常不是伤害不够，而是输出节奏断层导致防线被击穿。",
        bottleneckTags: ["survival", "resource", "throughput"],
      };
    case "single":
      return {
        primaryObjective: "单体压血与后段收尾能力",
        secondaryObjective: "确保低血窗口有可用终结手段",
        failurePatternSummary: "前段压血可接受，但后段缺乏收尾导致拖时，最终反被击败。",
        recommendedMetricFocus: ["敌方剩余血量比", "首杀时间", "持续DPS", "资源溢出率"],
        dangerWindowSummary: "危险窗口：战斗后 1/3；若终结技能错窗，战斗会明显拉长。",
        likelyCauseLine: "你更可能死于收尾不足，而不是前段起手问题。",
        bottleneckTags: ["single", "throughput", "resource"],
      };
    case "sustain":
      return {
        primaryObjective: "长战生存与资源稳定循环",
        secondaryObjective: "让机制伤害在中后段持续兑现",
        failurePatternSummary: "前几轮循环正常，但后续资源或生存任一崩塌都会导致整局掉线。",
        recommendedMetricFocus: ["资源匮乏率", "资源溢出率", "承受伤害", "机制占比"],
        dangerWindowSummary: "危险窗口：20 秒后；循环若不稳定会在后段快速衰减。",
        likelyCauseLine: "最常见死因是循环后段崩坏，而非开局爆发不足。",
        bottleneckTags: ["survival", "resource", "mechanic"],
      };
    case "antiMechanic":
      return {
        primaryObjective: "在机制受压环境维持有效伤害",
        secondaryObjective: "补足原始伤害下限，避免机制失效时断伤",
        failurePatternSummary: "机制占比被压后总伤显著下降，若无直伤兜底就会后段失速。",
        recommendedMetricFocus: ["总伤害", "机制占比", "敌方剩余血量比", "持续DPS"],
        dangerWindowSummary: "危险窗口：中后段，机制衰减后若缺少直伤补位会持续劣化。",
        likelyCauseLine: "你常死于机制被压后没有足够原始伤害兜底。",
        bottleneckTags: ["mechanic", "throughput", "single"],
      };
    case "baseline":
    default: {
      if (floor.floor <= 6) {
        return {
          primaryObjective: "基础循环成型与首轮技能稳定释放",
          secondaryObjective: "避免过早资源断档",
          failurePatternSummary: "技能链不完整会导致起手慢、断档多，进而被持续压血。",
          recommendedMetricFocus: ["启动时间", "首杀时间", "资源匮乏率", "资源溢出率"],
          dangerWindowSummary: "危险窗口：前 12 秒；若循环没启动，后续会持续被动。",
          likelyCauseLine: "你大多死于循环未成型导致的持续劣势。",
          bottleneckTags: ["startup", "resource", "clear"],
        };
      }
      return {
        primaryObjective: "基础吞吐与生存平衡",
        secondaryObjective: "避免短板在中段被放大",
        failurePatternSummary: "某一短板（输出或生存）会在中段被集中放大并触发连锁失败。",
        recommendedMetricFocus: ["总伤害", "承受伤害", "剩余生命", "首杀时间"],
        dangerWindowSummary: "危险窗口：中段，综合压力会对短板进行放大。",
        likelyCauseLine: "你通常死于单一短板被楼层压力持续放大。",
        bottleneckTags: ["throughput", "survival", "startup"],
      };
    }
  }
}
