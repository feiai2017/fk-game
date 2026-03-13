import type {
  ArchetypeKey,
  DiagnosisEntry,
  EquipmentSlot,
  TowerPressureTag,
} from "@/core/battle/types";

export function tArchetype(key: ArchetypeKey): string {
  switch (key) {
    case "dot":
      return "持续伤害";
    case "crit":
      return "暴击直伤";
    case "engine":
      return "资源引擎";
    default:
      return key;
  }
}

export function tPressure(tag: TowerPressureTag): string {
  switch (tag) {
    case "baseline":
      return "基线";
    case "swarm":
      return "群怪";
    case "burst":
      return "爆发";
    case "single":
      return "单体";
    case "sustain":
      return "续航";
    case "antiMechanic":
      return "克制机制";
    default:
      return tag;
  }
}

export function tSlot(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return "武器";
    case "helm":
      return "头盔";
    case "armor":
      return "护甲";
    case "ring1":
      return "戒指1";
    case "ring2":
      return "戒指2";
    case "core":
      return "核心遗物";
    default:
      return slot;
  }
}

export function tRarity(rarity: "common" | "rare" | "legendary"): string {
  switch (rarity) {
    case "common":
      return "普通";
    case "rare":
      return "稀有";
    case "legendary":
      return "传说";
    default:
      return rarity;
  }
}

export function tDamageCategory(category: "direct" | "dot" | "proc"): string {
  switch (category) {
    case "direct":
      return "直伤";
    case "dot":
      return "持续伤害";
    case "proc":
      return "触发伤害";
    default:
      return category;
  }
}

export function tDiagnosisCode(code: DiagnosisEntry["code"]): string {
  switch (code) {
    case "LOW_RAW_DAMAGE":
      return "原始伤害不足";
    case "LOW_DAMAGE":
      return "输出不足";
    case "SLOW_STARTUP":
      return "启动过慢";
    case "LOW_CLEAR_EFFICIENCY":
      return "清场效率低";
    case "LOW_SINGLE_TARGET_FINISH":
      return "单体收尾不足";
    case "RESOURCE_WASTE":
      return "资源浪费";
    case "LOW_MECHANIC_CONTRIBUTION":
      return "机制贡献低";
    case "RESOURCE_STARVED":
      return "资源不足";
    case "RESOURCE_OVERFLOW":
      return "资源溢出";
    case "LOW_SURVIVAL":
      return "生存不足";
    case "LOW_DOT_RATIO":
      return "持续伤害占比低";
    case "LOW_PROC_RATIO":
      return "触发伤害占比低";
    default:
      return code;
  }
}
