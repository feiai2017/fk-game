import type { RelicDef } from "@/core/battle/types";

export const RELICS: RelicDef[] = [
  {
    id: "core_venom_crown",
    name: "毒冠核心",
    slot: "core",
    rarity: "rare",
    archetypeBias: "dot",
    stats: { dotPower: 0.22, skillPower: 0.08, resourceMax: 10 },
    mechanicModifiers: {
      dotBurstBonus: 0.22,
      extraDotStacks: 1,
    },
    desc: "提高持续伤害层数上限，并强化引爆转化。",
  },
  {
    id: "core_assassin_relay",
    name: "刺客中继",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "crit",
    stats: { crit: 0.14, critDamage: 0.4, cdr: 0.08 },
    mechanicModifiers: {
      executeBonus: 0.16,
    },
    desc: "对低血量目标的终结技更强。",
  },
  {
    id: "core_singularity_drive",
    name: "奇点驱动",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { procPower: 0.22, resourceRegen: 4, resourceMax: 20 },
    mechanicModifiers: {
      procTriggerOnSpend: true,
      resourceRefundBonus: 0.25,
    },
    desc: "消耗资源时可连锁触发额外伤害。",
  },
  {
    id: "core_overflow_matrix",
    name: "溢流矩阵",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { resourceMax: 24, resourceRegen: 4, shieldPower: 0.16 },
    mechanicEffects: [
      {
        id: "ENGINE_OVERFLOW_GUARD",
        event: "onResourceOverflowTick",
        value: 24,
        value2: 0.28,
        cooldown: 1,
      },
    ],
    desc: "资源溢出时转化为护盾并触发脉冲伤害。",
  },
  {
    id: "core_spore_hive",
    name: "孢群巢核",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "dot",
    stats: { dotPower: 0.2, resourceMax: 12, cdr: 0.04 },
    mechanicEffects: [
      {
        id: "DOT_FULLSTACK_ECHO",
        event: "onSkillCast",
        value: 0.28,
        value2: 0.24,
        cooldown: 2.4,
      },
      {
        id: "DOT_COVERAGE_CDR",
        event: "onSkillCast",
        value: 1.3,
        cooldown: 3.2,
      },
    ],
    desc: "高层DOT覆盖时放大引爆并压缩循环冷却，强化持续压制。",
  },
  {
    id: "core_feedback_prism",
    name: "反馈棱镜",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { procPower: 0.18, resourceRegen: 2, cdr: 0.06, resourceMax: 14 },
    mechanicEffects: [
      {
        id: "LOW_RESOURCE_CYCLE_SURGE",
        event: "onSkillCast",
        value: 11,
        value2: 0.32,
        cooldown: 1.5,
      },
      {
        id: "ENGINE_HIGH_RESOURCE_CHAIN",
        event: "onSkillCast",
        value: 0.26,
        value2: 0.75,
        cooldown: 1.2,
      },
    ],
    desc: "低资源时补循环，高资源时强化触发，形成双阈值引擎玩法。",
  },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((relic) => [relic.id, relic]));
