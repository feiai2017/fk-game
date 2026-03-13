"use strict";

// src/core/build/loadout.ts
var EQUIPMENT_SLOTS = [
  "weapon",
  "helm",
  "armor",
  "ring1",
  "ring2",
  "core"
];

// src/core/build/statAggregator.ts
var STAT_KEYS = [
  "hp",
  "atk",
  "def",
  "speed",
  "crit",
  "critDamage",
  "skillPower",
  "dotPower",
  "procPower",
  "resist",
  "regen",
  "shieldPower",
  "cdr",
  "resourceMax",
  "resourceRegen"
];
function aggregateStats(base, loadout2) {
  const result = { ...base };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = loadout2[slot];
    if (!item) {
      continue;
    }
    for (const key of STAT_KEYS) {
      result[key] += item.stats[key] ?? 0;
    }
  }
  result.crit = clamp(result.crit, 0, 0.95);
  result.critDamage = Math.max(0, result.critDamage);
  result.cdr = clamp(result.cdr, 0, 0.5);
  result.resist = clamp(result.resist, 0, 0.75);
  result.resourceMax = Math.max(20, result.resourceMax);
  result.speed = Math.max(0.4, result.speed);
  result.hp = Math.max(1, result.hp);
  return result;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/data/constants.ts
var BASE_PLAYER_STATS = {
  hp: 1200,
  atk: 120,
  def: 60,
  speed: 1,
  crit: 0.1,
  critDamage: 0.5,
  skillPower: 0,
  dotPower: 0,
  procPower: 0,
  resist: 0.05,
  regen: 4,
  shieldPower: 0,
  cdr: 0,
  resourceMax: 100,
  resourceRegen: 6
};
var TOTAL_TOWER_FLOORS = 20;
var MAX_BATTLE_DURATION = 90;
var SIMULATION_TICK = 0.1;
var ENEMY_ATTACK_INTERVAL = 1.6;

// src/data/items.ts
var ITEMS = [
  {
    id: "w_bone_knife",
    name: "\u9AA8\u5203\u77ED\u5200",
    slot: "weapon",
    rarity: "common",
    archetypeBias: "dot",
    stats: { atk: 16, dotPower: 0.12, speed: 0.05 },
    desc: "\u8F7B\u578B\u77ED\u5200\uFF0C\u52A0\u5FEB\u6301\u7EED\u6BD2\u4F24\u8986\u76D6\u3002"
  },
  {
    id: "w_serrated_reaper",
    name: "\u952F\u9F7F\u6536\u5272\u8005",
    slot: "weapon",
    rarity: "rare",
    archetypeBias: "dot",
    stats: { atk: 28, dotPower: 0.2, skillPower: 0.08 },
    desc: "\u5F3A\u5316\u6D41\u8840\u4E0E\u8150\u8680\u7C7B\u6548\u679C\u3002"
  },
  {
    id: "w_marksman_bow",
    name: "\u5C04\u624B\u957F\u5F13",
    slot: "weapon",
    rarity: "common",
    archetypeBias: "crit",
    stats: { atk: 20, crit: 0.08, critDamage: 0.2 },
    desc: "\u7A33\u5B9A\u66B4\u51FB\u5E95\u76D8\uFF0C\u517C\u987E\u57FA\u7840\u653B\u51FB\u3002"
  },
  {
    id: "w_predator_rifle",
    name: "\u63A0\u98DF\u6B65\u67AA",
    slot: "weapon",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { atk: 35, crit: 0.12, critDamage: 0.35 },
    desc: "\u63D0\u9AD8\u66B4\u51FB\u4E0A\u9650\uFF0C\u5F3A\u5316\u7206\u53D1\u8F6E\u6B21\u3002"
  },
  {
    id: "w_flux_pistol",
    name: "\u901A\u91CF\u624B\u67AA",
    slot: "weapon",
    rarity: "common",
    archetypeBias: "engine",
    stats: { atk: 16, procPower: 0.16, resourceRegen: 2 },
    desc: "\u5C06\u8D44\u6E90\u5FAA\u73AF\u8F6C\u5316\u4E3A\u89E6\u53D1\u4F24\u5BB3\u3002"
  },
  {
    id: "w_reactor_lance",
    name: "\u53CD\u5E94\u5806\u957F\u67AA",
    slot: "weapon",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { atk: 40, procPower: 0.28, resourceMax: 18, cdr: 0.08 },
    desc: "\u5F15\u64CE\u6838\u5FC3\u6B66\u5668\uFF0C\u9002\u5408\u9AD8\u9891\u6D88\u8017\u5FAA\u73AF\u3002"
  },
  {
    id: "h_stitched_hood",
    name: "\u7F1D\u5408\u515C\u5E3D",
    slot: "helm",
    rarity: "common",
    archetypeBias: "dot",
    stats: { hp: 120, dotPower: 0.08, resourceRegen: 1 },
    desc: "\u63D0\u5347\u6301\u7EED\u4F24\u5BB3\u6D41\u6D3E\u524D\u671F\u7A33\u5B9A\u6027\u3002"
  },
  {
    id: "h_hawkeye_visor",
    name: "\u9E70\u773C\u9762\u7F69",
    slot: "helm",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { hp: 140, crit: 0.09, speed: 0.08 },
    desc: "\u4E3A\u7206\u53D1\u7A97\u53E3\u8C03\u6821\u7684\u7CBE\u5BC6\u7784\u51C6\u6A21\u5757\u3002"
  },
  {
    id: "h_processor_crown",
    name: "\u5904\u7406\u5668\u738B\u51A0",
    slot: "helm",
    rarity: "rare",
    archetypeBias: "engine",
    stats: { hp: 145, procPower: 0.13, resourceMax: 14 },
    desc: "\u6269\u5C55\u8D44\u6E90\u7F13\u5B58\uFF0C\u652F\u6491\u89E6\u53D1\u5FAA\u73AF\u3002"
  },
  {
    id: "a_scaled_vest",
    name: "\u9CDE\u7532\u80CC\u5FC3",
    slot: "armor",
    rarity: "common",
    stats: { hp: 230, def: 24, regen: 2 },
    desc: "\u57FA\u7840\u751F\u5B58\u62A4\u5C42\u3002"
  },
  {
    id: "a_predator_carapace",
    name: "\u63A0\u98DF\u7532\u58F3",
    slot: "armor",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { hp: 260, def: 26, critDamage: 0.15 },
    desc: "\u504F\u8F93\u51FA\u53D6\u5411\u7684\u4E2D\u578B\u62A4\u7532\u3002"
  },
  {
    id: "a_reactive_shell",
    name: "\u53CD\u5E94\u62A4\u58F3",
    slot: "armor",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { hp: 320, def: 36, shieldPower: 0.2, resourceRegen: 3 },
    desc: "\u5C06\u5FAA\u73AF\u7A33\u5B9A\u5EA6\u8F6C\u5316\u4E3A\u5C42\u53E0\u9632\u62A4\u3002"
  },
  {
    id: "r_dot_band",
    name: "\u8150\u8680\u6307\u73AF",
    slot: "ring1",
    rarity: "common",
    archetypeBias: "dot",
    stats: { dotPower: 0.12, skillPower: 0.06 },
    desc: "\u76F4\u63A5\u63D0\u5347\u6301\u7EED\u4F24\u5BB3\u3002"
  },
  {
    id: "r_plain_loop",
    name: "\u7D20\u73AF",
    slot: "ring2",
    rarity: "common",
    stats: { hp: 60, atk: 8 },
    desc: "\u6734\u7D20\u4F46\u7A33\u5B9A\u7684\u57FA\u7840\u6212\u6307\u3002"
  },
  {
    id: "r_crit_band",
    name: "\u9E70\u76EE\u6307\u73AF",
    slot: "ring1",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { crit: 0.11, critDamage: 0.22 },
    desc: "\u5F3A\u5316\u9AD8\u66B4\u51FB\u76F4\u4F24\u4E0A\u9650\u3002"
  },
  {
    id: "r_impact_loop",
    name: "\u51B2\u51FB\u73AF",
    slot: "ring2",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { atk: 20, skillPower: 0.1 },
    desc: "\u628A\u6280\u80FD\u8282\u594F\u8F6C\u5316\u4E3A\u76F4\u4F24\u8F93\u51FA\u3002"
  },
  {
    id: "r_engine_loop",
    name: "\u5F15\u64CE\u56DE\u8DEF",
    slot: "ring1",
    rarity: "rare",
    archetypeBias: "engine",
    stats: { procPower: 0.15, resourceRegen: 2, cdr: 0.05 },
    desc: "\u7EF4\u6301\u9AD8\u89E6\u53D1\u9891\u7387\u7684\u5FAA\u73AF\u7A33\u5B9A\u3002"
  },
  {
    id: "r_overflow_gem",
    name: "\u6EA2\u6D41\u5B9D\u77F3",
    slot: "ring2",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { resourceMax: 24, resourceRegen: 4, atk: 14 },
    desc: "\u8BA9\u9AD8\u6D88\u8017\u6784\u7B51\u4E0D\u6613\u65AD\u8D44\u6E90\u3002"
  },
  {
    id: "r_rupture_sigil",
    name: "\u88C2\u8680\u5370\u8BB0",
    slot: "ring2",
    rarity: "rare",
    archetypeBias: "dot",
    stats: { dotPower: 0.1, resourceRegen: 1 },
    mechanicEffects: [
      {
        id: "DOT_BURST_REFUND",
        event: "onSkillCast",
        value: 5,
        value2: 0.15,
        cooldown: 2
      }
    ],
    desc: "\u91CA\u653E\u5F15\u7206\u7C7B\u6280\u80FD\u65F6\uFF0C\u6309DOT\u5C42\u6570\u8FD4\u8FD8\u80FD\u91CF\u5E76\u63D0\u9AD8\u5F15\u7206\u6536\u76CA\u3002"
  },
  {
    id: "w_execution_scope",
    name: "\u65AD\u7F6A\u7784\u5177",
    slot: "weapon",
    rarity: "rare",
    archetypeBias: "crit",
    stats: { atk: 30, crit: 0.08, critDamage: 0.22 },
    mechanicEffects: [
      {
        id: "CRIT_FINISHER_VALUE",
        event: "onSkillHit",
        value: 0.4
      }
    ],
    desc: "\u7EC8\u7ED3\u6280\u66B4\u51FB\u547D\u4E2D\u4F4E\u8840\u76EE\u6807\u65F6\uFF0C\u89E6\u53D1\u989D\u5916\u4F24\u5BB3\u3002"
  },
  {
    id: "r_guillotine_coil",
    name: "\u65AD\u5934\u7EBF\u5708",
    slot: "ring1",
    rarity: "legendary",
    archetypeBias: "crit",
    stats: { crit: 0.12, critDamage: 0.2, cdr: 0.04 },
    mechanicEffects: [
      {
        id: "CRIT_FINISHER_CDR",
        event: "onKill",
        value: 2,
        cooldown: 4
      }
    ],
    desc: "\u7EC8\u7ED3\u6280\u66B4\u51FB\u5B8C\u6210\u51FB\u6740\u65F6\uFF0C\u7F29\u77ED\u5168\u6280\u80FD\u51B7\u5374\u3002"
  },
  {
    id: "r_venom_timer",
    name: "\u8680\u523B\u65F6\u8BA1",
    slot: "ring1",
    rarity: "rare",
    archetypeBias: "dot",
    stats: { dotPower: 0.09, cdr: 0.04, resourceRegen: 1 },
    mechanicEffects: [
      {
        id: "DOT_COVERAGE_CDR",
        event: "onSkillCast",
        value: 1.2,
        cooldown: 3
      }
    ],
    desc: "\u76EE\u6807DOT\u5C42\u6570\u8F83\u9AD8\u65F6\uFF0C\u65BD\u653EDOT\u6280\u80FD\u53EF\u7F29\u77ED\u5168\u6280\u80FD\u51B7\u5374\u3002"
  },
  {
    id: "h_flux_reservoir",
    name: "\u901A\u91CF\u50A8\u5BB9\u51A0",
    slot: "helm",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { hp: 170, procPower: 0.14, resourceMax: 12 },
    mechanicEffects: [
      {
        id: "SPEND_EMPOWER_NEXT_PROC",
        event: "onSkillCast",
        value: 0.42,
        value2: 24
      }
    ],
    desc: "\u5355\u6B21\u6D88\u8017\u8F83\u9AD8\u8D44\u6E90\u540E\uFF0C\u5F3A\u5316\u4E0B\u4E00\u6B21\u89E6\u53D1\u4F24\u5BB3\u3002"
  },
  {
    id: "r_plague_resonator",
    name: "\u761F\u75AB\u8C10\u632F\u73AF",
    slot: "ring2",
    rarity: "legendary",
    archetypeBias: "dot",
    stats: { dotPower: 0.14, skillPower: 0.08, cdr: 0.03 },
    mechanicEffects: [
      {
        id: "DOT_FULLSTACK_ECHO",
        event: "onSkillCast",
        value: 0.32,
        value2: 0.2,
        cooldown: 3
      }
    ],
    desc: "\u76EE\u6807DOT\u9AD8\u5C42\u65F6\u91CA\u653EDOT\u6280\u80FD\uFF0C\u4F1A\u89E6\u53D1\u989D\u5916\u56DE\u54CD\u4F24\u5BB3\u5E76\u5F3A\u5316\u5F15\u7206\u3002"
  },
  {
    id: "r_mercy_trigger",
    name: "\u6148\u60B2\u6273\u673A",
    slot: "ring2",
    rarity: "legendary",
    archetypeBias: "crit",
    stats: { crit: 0.1, critDamage: 0.18, resourceMax: 8 },
    mechanicEffects: [
      {
        id: "CRIT_FINISHER_REFUND",
        event: "onSkillHit",
        value: 14,
        value2: 1.4,
        cooldown: 2.6
      }
    ],
    desc: "\u7EC8\u7ED3\u6280\u66B4\u51FB\u547D\u4E2D\u4F4E\u8840\u76EE\u6807\u65F6\u8FD4\u8FD8\u80FD\u91CF\u5E76\u52A0\u901F\u6280\u80FD\u8F6E\u8F6C\u3002"
  },
  {
    id: "w_threshold_accumulator",
    name: "\u9608\u503C\u84C4\u80FD\u5668",
    slot: "weapon",
    rarity: "rare",
    archetypeBias: "engine",
    stats: { atk: 24, procPower: 0.18, resourceMax: 10 },
    mechanicEffects: [
      {
        id: "ENGINE_HIGH_RESOURCE_CHAIN",
        event: "onSkillCast",
        value: 0.3,
        value2: 0.74,
        cooldown: 1.2
      }
    ],
    desc: "\u9AD8\u8D44\u6E90\u533A\u95F4\u65BD\u6CD5\u65F6\u5F3A\u5316\u4E0B\u4E00\u6B21\u89E6\u53D1\u94FE\uFF0C\u9F13\u52B1\u9608\u503C\u7BA1\u7406\u3002"
  }
];
var ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

// src/data/relics.ts
var RELICS = [
  {
    id: "core_venom_crown",
    name: "\u6BD2\u51A0\u6838\u5FC3",
    slot: "core",
    rarity: "rare",
    archetypeBias: "dot",
    stats: { dotPower: 0.22, skillPower: 0.08, resourceMax: 10 },
    mechanicModifiers: {
      dotBurstBonus: 0.22,
      extraDotStacks: 1
    },
    desc: "\u63D0\u9AD8\u6301\u7EED\u4F24\u5BB3\u5C42\u6570\u4E0A\u9650\uFF0C\u5E76\u5F3A\u5316\u5F15\u7206\u8F6C\u5316\u3002"
  },
  {
    id: "core_assassin_relay",
    name: "\u523A\u5BA2\u4E2D\u7EE7",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "crit",
    stats: { crit: 0.14, critDamage: 0.4, cdr: 0.08 },
    mechanicModifiers: {
      executeBonus: 0.16
    },
    desc: "\u5BF9\u4F4E\u8840\u91CF\u76EE\u6807\u7684\u7EC8\u7ED3\u6280\u66F4\u5F3A\u3002"
  },
  {
    id: "core_singularity_drive",
    name: "\u5947\u70B9\u9A71\u52A8",
    slot: "core",
    rarity: "legendary",
    archetypeBias: "engine",
    stats: { procPower: 0.22, resourceRegen: 4, resourceMax: 20 },
    mechanicModifiers: {
      procTriggerOnSpend: true,
      resourceRefundBonus: 0.25
    },
    desc: "\u6D88\u8017\u8D44\u6E90\u65F6\u53EF\u8FDE\u9501\u89E6\u53D1\u989D\u5916\u4F24\u5BB3\u3002"
  },
  {
    id: "core_overflow_matrix",
    name: "\u6EA2\u6D41\u77E9\u9635",
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
        cooldown: 1
      }
    ],
    desc: "\u8D44\u6E90\u6EA2\u51FA\u65F6\u8F6C\u5316\u4E3A\u62A4\u76FE\u5E76\u89E6\u53D1\u8109\u51B2\u4F24\u5BB3\u3002"
  },
  {
    id: "core_spore_hive",
    name: "\u5B62\u7FA4\u5DE2\u6838",
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
        cooldown: 2.4
      },
      {
        id: "DOT_COVERAGE_CDR",
        event: "onSkillCast",
        value: 1.3,
        cooldown: 3.2
      }
    ],
    desc: "\u9AD8\u5C42DOT\u8986\u76D6\u65F6\u653E\u5927\u5F15\u7206\u5E76\u538B\u7F29\u5FAA\u73AF\u51B7\u5374\uFF0C\u5F3A\u5316\u6301\u7EED\u538B\u5236\u3002"
  },
  {
    id: "core_feedback_prism",
    name: "\u53CD\u9988\u68F1\u955C",
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
        cooldown: 1.5
      },
      {
        id: "ENGINE_HIGH_RESOURCE_CHAIN",
        event: "onSkillCast",
        value: 0.26,
        value2: 0.75,
        cooldown: 1.2
      }
    ],
    desc: "\u4F4E\u8D44\u6E90\u65F6\u8865\u5FAA\u73AF\uFF0C\u9AD8\u8D44\u6E90\u65F6\u5F3A\u5316\u89E6\u53D1\uFF0C\u5F62\u6210\u53CC\u9608\u503C\u5F15\u64CE\u73A9\u6CD5\u3002"
  }
];
var RELIC_BY_ID = Object.fromEntries(RELICS.map((relic) => [relic.id, relic]));

// src/data/skills.ts
var SKILLS = [
  {
    id: "toxic_lance",
    name: "\u6BD2\u8680\u7A7F\u523A",
    archetype: "dot",
    cooldown: 4,
    cost: 18,
    directRatio: 0.8,
    dot: {
      name: "\u6BD2\u6DB2",
      duration: 8,
      tickRatio: 0.27,
      maxStacks: 3
    },
    tags: ["single", "dot", "starter"]
  },
  {
    id: "contagion_wave",
    name: "\u4F20\u67D3\u6CE2",
    archetype: "dot",
    cooldown: 7,
    cost: 32,
    directRatio: 0.55,
    dot: {
      name: "\u8150\u8680",
      duration: 6,
      tickRatio: 0.2,
      maxStacks: 2
    },
    tags: ["aoe", "dot", "spread"]
  },
  {
    id: "rupture_bloom",
    name: "\u88C2\u8680\u7EFD\u653E",
    archetype: "dot",
    cooldown: 11,
    cost: 45,
    directRatio: 0.7,
    burstDotPercent: 0.52,
    tags: ["single", "dot", "burst"]
  },
  {
    id: "precision_shot",
    name: "\u7CBE\u51C6\u72D9\u51FB",
    archetype: "crit",
    cooldown: 4,
    cost: 20,
    directRatio: 1.4,
    critBonus: 0.15,
    tags: ["single", "crit", "burst"]
  },
  {
    id: "ricochet_blade",
    name: "\u5F39\u5C04\u5203\u8F6E",
    archetype: "crit",
    cooldown: 8,
    cost: 32,
    directRatio: 0.67,
    hits: 4,
    critBonus: 0.1,
    tags: ["aoe", "crit", "multi"]
  },
  {
    id: "execution_mark",
    name: "\u5904\u51B3\u5370\u8BB0",
    archetype: "crit",
    cooldown: 11.5,
    cost: 40,
    directRatio: 2,
    critBonus: 0.25,
    tags: ["single", "crit", "finisher"]
  },
  {
    id: "spark_converter",
    name: "\u706B\u82B1\u8F6C\u6362",
    archetype: "engine",
    cooldown: 5,
    cost: 18,
    directRatio: 0.7,
    procRatio: 0.8,
    tags: ["single", "proc", "cycle"]
  },
  {
    id: "overclock_loop",
    name: "\u8D85\u9891\u56DE\u8DEF",
    archetype: "engine",
    cooldown: 8.5,
    cost: 34,
    directRatio: 0.7,
    hits: 2,
    procRatio: 0.72,
    shieldRatio: 0.45,
    tags: ["aoe", "proc", "shield"]
  },
  {
    id: "reactor_surge",
    name: "\u53CD\u5E94\u5806\u6FC0\u6D8C",
    archetype: "engine",
    cooldown: 12.2,
    cost: 54,
    directRatio: 1.1,
    procRatio: 1.12,
    healRatio: 0.5,
    tags: ["single", "proc", "heal", "spender"]
  }
];
var SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));

// src/core/tower/floorRules.ts
var PRESSURE_SEQUENCE = [
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "baseline",
  "swarm",
  "swarm",
  "swarm",
  "burst",
  "swarm",
  "burst",
  "single",
  "single",
  "burst",
  "single",
  "sustain",
  "antiMechanic",
  "sustain",
  "antiMechanic"
];
function pressureEnemyCount(pressure) {
  switch (pressure) {
    case "swarm":
      return 5;
    case "single":
      return 1;
    case "burst":
      return 2;
    case "sustain":
      return 3;
    case "antiMechanic":
      return 2;
    case "baseline":
    default:
      return 3;
  }
}
function pressureMultipliers(pressure) {
  switch (pressure) {
    case "swarm":
      return { hp: 0.9, atk: 0.95, def: 0.9, resist: 0.1 };
    case "burst":
      return { hp: 1.05, atk: 1.2, def: 1, resist: 0.15 };
    case "single":
      return { hp: 1.35, atk: 1.05, def: 1.15, resist: 0.2 };
    case "sustain":
      return { hp: 1.2, atk: 1.1, def: 1.05, resist: 0.18 };
    case "antiMechanic":
      return { hp: 1.25, atk: 1.15, def: 1.2, resist: 0.3 };
    case "baseline":
    default:
      return { hp: 1, atk: 1, def: 1, resist: 0.12 };
  }
}

// src/core/tower/towerGenerator.ts
function generateTowerFloors(totalFloors) {
  return Array.from({ length: totalFloors }, (_, index) => {
    const floor2 = index + 1;
    const pressure = PRESSURE_SEQUENCE[index] ?? "baseline";
    const baseHp = 700 + floor2 * 140;
    const baseAtk = 56 + floor2 * 8;
    const baseDef = 26 + floor2 * 5;
    const multipliers = pressureMultipliers(pressure);
    const boss = floor2 >= 13 && floor2 % 2 === 0;
    return {
      floor: floor2,
      pressure,
      enemyHp: Math.round(baseHp * multipliers.hp * (boss ? 1.18 : 1)),
      enemyAtk: Math.round(baseAtk * multipliers.atk * (boss ? 1.12 : 1)),
      enemyDef: Math.round(baseDef * multipliers.def),
      enemyResist: Math.min(0.6, multipliers.resist + floor2 * 6e-3),
      enemyCount: boss ? 1 : pressureEnemyCount(pressure),
      boss,
      notes: pressure === "antiMechanic" ? "\u9AD8\u6297\u6027\u73AF\u5883\uFF0C\u7528\u4E8E\u9A8C\u8BC1\u673A\u5236\u5B8C\u6574\u6027\u3002" : void 0
    };
  });
}

// src/data/tower.ts
var TOWER_FLOORS = generateTowerFloors(TOTAL_TOWER_FLOORS);

// src/core/battle/effects.ts
function applyDotToEnemy(input2) {
  const { enemy, skill, now, damagePerTick, extraStacks } = input2;
  if (!skill.dot) {
    return;
  }
  const dotId = `${skill.id}:${skill.dot.name}`;
  const maxStacks = skill.dot.maxStacks + extraStacks;
  const existing = enemy.dots.find((dot) => dot.id === dotId);
  if (!existing) {
    enemy.dots.push({
      id: dotId,
      name: skill.dot.name,
      sourceId: skill.id,
      sourceName: skill.name,
      remaining: skill.dot.duration,
      nextTickAt: now + 1,
      tickInterval: 1,
      damagePerTick,
      stacks: 1
    });
    return;
  }
  existing.remaining = skill.dot.duration;
  existing.damagePerTick = damagePerTick;
  existing.stacks = Math.min(maxStacks, existing.stacks + 1);
}
function tickDots(enemy, now, onDotDamage) {
  for (const dot of enemy.dots) {
    while (dot.remaining > 0 && dot.nextTickAt <= now) {
      const tickDamage = dot.damagePerTick * dot.stacks;
      onDotDamage(dot, tickDamage);
      dot.nextTickAt += dot.tickInterval;
      dot.remaining -= dot.tickInterval;
    }
  }
  enemy.dots = enemy.dots.filter((dot) => dot.remaining > 0);
}
function burstDotDamage(enemy, percent) {
  let total = 0;
  for (const dot of enemy.dots) {
    const remainingTicks = Math.ceil(dot.remaining / dot.tickInterval);
    const remainingPotential = dot.damagePerTick * dot.stacks * remainingTicks;
    total += remainingPotential * percent;
    dot.remaining *= 1 - percent;
  }
  enemy.dots = enemy.dots.filter((dot) => dot.remaining > 0.05);
  return total;
}

// src/core/battle/formulas.ts
function createSeededRng(seedInput) {
  let seed = 0;
  for (let index = 0; index < seedInput.length; index += 1) {
    seed = seed * 31 + seedInput.charCodeAt(index) >>> 0;
  }
  if (seed === 0) {
    seed = 1831565813;
  }
  return {
    next: () => {
      seed = seed * 1664525 + 1013904223 >>> 0;
      return seed / 4294967295;
    }
  };
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function reducedByDefense(damage, defense) {
  const safeDefense = Math.max(0, defense);
  return damage * (100 / (100 + safeDefense));
}
function reducedByResist(damage, resist) {
  return damage * (1 - clamp2(resist, 0, 0.75));
}
function calcAttackInterval(speed) {
  return Math.max(0.45, 1.2 / Math.max(0.2, speed));
}
function scaleCooldown(cooldown, cdr) {
  return Math.max(0.4, cooldown * (1 - clamp2(cdr, 0, 0.5)));
}
function critMultiplier(critDamage) {
  return 1.5 + Math.max(0, critDamage);
}
function rollCrit(chance, rng) {
  return rng.next() < clamp2(chance, 0, 0.95);
}
function pressureDamageModifier(category, pressure) {
  switch (pressure) {
    case "swarm":
      return category === "direct" ? 1.05 : 0.95;
    case "burst":
      return category === "direct" ? 0.95 : 1;
    case "single":
      return 1;
    case "sustain":
      return category === "dot" ? 0.9 : 0.95;
    case "antiMechanic":
      if (category === "dot") {
        return 0.75;
      }
      if (category === "proc") {
        return 0.78;
      }
      return 0.92;
    case "baseline":
    default:
      return 1;
  }
}
function enemyPressureAttackModifier(pressure) {
  switch (pressure) {
    case "burst":
      return 1.18;
    case "swarm":
      return 1.04;
    case "single":
      return 1.1;
    case "sustain":
      return 1.08;
    case "antiMechanic":
      return 1.12;
    case "baseline":
    default:
      return 1;
  }
}

// src/core/battle/passiveEngine.ts
function createPassiveRuntime(loadout2) {
  const effects = collectPassiveEffects(loadout2);
  return {
    effects,
    cooldowns: new Map(effects.map((effect) => [effect.key, 0])),
    nextProcBonusRatio: 0
  };
}
function advancePassiveCooldowns(runtime, delta) {
  for (const [key, cooldown] of runtime.cooldowns.entries()) {
    runtime.cooldowns.set(key, Math.max(0, cooldown - delta));
  }
}
function resolvePassiveActions(runtime, event, payload, rng) {
  const actions = [];
  for (const effect of runtime.effects) {
    if (effect.event !== event) {
      continue;
    }
    const cooldown = runtime.cooldowns.get(effect.key) ?? 0;
    if (cooldown > 0) {
      continue;
    }
    if (effect.chance !== void 0 && rng.next() > effect.chance) {
      continue;
    }
    const action = evaluateEffect(effect, payload);
    if (!action) {
      continue;
    }
    actions.push(action);
    if ((effect.cooldown ?? 0) > 0) {
      runtime.cooldowns.set(effect.key, effect.cooldown ?? 0);
    }
  }
  return actions;
}
function evaluateEffect(effect, payload) {
  switch (effect.id) {
    case "DOT_BURST_REFUND": {
      if ((payload.skill?.burstDotPercent ?? 0) <= 0 || (payload.targetDotStacks ?? 0) <= 0) {
        return void 0;
      }
      const stacks = Math.min(4, payload.targetDotStacks ?? 0);
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: (effect.value ?? 5) * stacks,
        dotBurstMultiplierBonus: effect.value2 ?? 0.12
      };
    }
    case "DOT_COVERAGE_CDR": {
      if (!payload.skill?.dot) {
        return void 0;
      }
      if ((payload.targetDotStacks ?? 0) < 2) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        reduceAllCooldowns: effect.value ?? 1.1
      };
    }
    case "DOT_FULLSTACK_ECHO": {
      if (!payload.skill?.tags.includes("dot")) {
        return void 0;
      }
      if ((payload.targetDotStacks ?? 0) < 4) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        bonusProcRatio: effect.value ?? 0.28,
        dotBurstMultiplierBonus: effect.value2 ?? 0.18
      };
    }
    case "CRIT_FINISHER_CDR": {
      if (!payload.skill?.tags.includes("finisher") || !payload.didCrit) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        reduceAllCooldowns: effect.value ?? 1.8
      };
    }
    case "CRIT_FINISHER_VALUE": {
      if (!payload.skill?.tags.includes("finisher")) {
        return void 0;
      }
      if ((payload.targetHpRatio ?? 1) > 0.45) {
        return void 0;
      }
      if (!payload.didCrit) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        bonusProcRatio: effect.value ?? 0.35
      };
    }
    case "CRIT_FINISHER_REFUND": {
      if (!payload.skill?.tags.includes("finisher") || !payload.didCrit) {
        return void 0;
      }
      if ((payload.targetHpRatio ?? 1) > 0.5) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: effect.value ?? 12,
        reduceAllCooldowns: effect.value2 ?? 1.2
      };
    }
    case "ENGINE_OVERFLOW_GUARD": {
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        addShield: effect.value ?? 22,
        bonusProcRatio: effect.value2 ?? 0.3
      };
    }
    case "SPEND_EMPOWER_NEXT_PROC": {
      if ((payload.resourceSpent ?? 0) < (effect.value2 ?? 24)) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        setNextProcBonusRatio: effect.value ?? 0.35
      };
    }
    case "ENGINE_HIGH_RESOURCE_CHAIN": {
      if ((payload.playerResourceRatio ?? 0) < (effect.value2 ?? 0.72)) {
        return void 0;
      }
      if (!payload.skill?.tags.some((tag) => tag === "proc" || tag === "spender")) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        setNextProcBonusRatio: effect.value ?? 0.34
      };
    }
    case "LOW_RESOURCE_CYCLE_SURGE": {
      if (!payload.skill?.tags.includes("cycle")) {
        return void 0;
      }
      if ((payload.playerResourceRatio ?? 1) > (effect.value2 ?? 0.3)) {
        return void 0;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: effect.value ?? 10,
        reduceAllCooldowns: 0.7
      };
    }
    default:
      return void 0;
  }
}
function collectPassiveEffects(loadout2) {
  const equipped = [
    loadout2.weapon,
    loadout2.helm,
    loadout2.armor,
    loadout2.ring1,
    loadout2.ring2,
    loadout2.core
  ];
  const effects = [];
  for (const item of equipped) {
    if (!item?.mechanicEffects?.length) {
      continue;
    }
    item.mechanicEffects.forEach((effect, index) => {
      effects.push({
        ...effect,
        key: `${item.instanceId ?? item.id}:${effect.id}:${index}`,
        sourceId: item.id,
        sourceName: item.name
      });
    });
  }
  return effects;
}
function consumeNextProcBonus(runtime) {
  const current = runtime.nextProcBonusRatio;
  runtime.nextProcBonusRatio = 0;
  return current;
}

// src/core/battle/skillPriority.ts
var PRIORITY_THRESHOLDS = {
  targetLowHp: 0.35,
  playerLowHp: 0.45,
  unstableResourceStarvedRate: 0.2,
  unstableResourceOverflowRate: 0.2,
  earlyWindowSeconds: 8
};
function evaluateSkillPriority(skill, context) {
  let score = 0;
  const reasons = [];
  const canAfford = context.resource >= skill.cost;
  const isSpender = skill.tags.includes("spender") || skill.cost >= context.resourceMax * 0.45;
  const isDefensive = (skill.shieldRatio ?? 0) > 0 || (skill.healRatio ?? 0) > 0;
  const isEarly = context.elapsedTime <= PRIORITY_THRESHOLDS.earlyWindowSeconds;
  const unstableResource = context.resourceStarvedRate >= PRIORITY_THRESHOLDS.unstableResourceStarvedRate || context.resourceOverflowRate >= PRIORITY_THRESHOLDS.unstableResourceOverflowRate;
  if (!canAfford) {
    score -= 1e3 + (skill.cost - context.resource) * 2;
    reasons.push("\u8D44\u6E90\u4E0D\u8DB3");
  }
  if (skill.tags.includes("finisher") && context.targetHpRatio <= PRIORITY_THRESHOLDS.targetLowHp) {
    score += 120;
    reasons.push("\u65A9\u6740\u7A97\u53E3");
  }
  if ((skill.burstDotPercent ?? 0) > 0 && context.targetDotStacks >= 2) {
    score += 96 + Math.min(30, context.targetDotStacks * 6);
    reasons.push("DOT\u5C42\u6570\u53EF\u5F15\u7206");
  }
  if (isDefensive && context.playerHpRatio <= PRIORITY_THRESHOLDS.playerLowHp) {
    score += 105;
    reasons.push("\u4F4E\u8840\u4FDD\u547D");
  }
  if (isSpender && !canAfford) {
    score -= 140;
    reasons.push("\u9AD8\u8D39\u6280\u80FD\u5EF6\u540E");
  } else if (isSpender && unstableResource) {
    score -= 32;
    reasons.push("\u8D44\u6E90\u4E0D\u7A33\u5B9A");
  }
  if (skill.tags.includes("cycle") && context.resource <= context.resourceMax * 0.38) {
    score += 42;
    reasons.push("\u56DE\u80FD\u5FAA\u73AF");
  }
  if (isEarly) {
    const setupBonus = setupPriorityBonus(skill, context.archetype);
    if (setupBonus > 0) {
      score += setupBonus;
      reasons.push("\u5F00\u5C40\u94FA\u57AB");
    }
  }
  if (skill.tags.includes("aoe") && context.enemyCount > 1) {
    score += 12;
    reasons.push("\u591A\u76EE\u6807\u6536\u76CA");
  }
  if (context.enemyCount === 1 && skill.tags.includes("single")) {
    score += 8;
  }
  return { score, reasons };
}
function rankReadySkills(skills2, context) {
  const ranked = skills2.map((skill, index) => {
    const result = evaluateSkillPriority(skill, context);
    return {
      index,
      score: result.score,
      reasons: result.reasons
    };
  });
  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  });
  return ranked;
}
function setupPriorityBonus(skill, archetype) {
  switch (archetype) {
    case "dot":
      if (skill.tags.includes("starter") || skill.dot && !skill.burstDotPercent) {
        return 44;
      }
      return 0;
    case "engine":
      if (skill.tags.includes("cycle") || (skill.shieldRatio ?? 0) > 0) {
        return 36;
      }
      return 0;
    case "crit":
      if (skill.tags.includes("burst") && !skill.tags.includes("finisher")) {
        return 24;
      }
      return 0;
    default:
      return 0;
  }
}

// src/core/battle/skillRunner.ts
function selectReadySkill(skills2, cooldowns, context) {
  const readySkillIndexes = [];
  for (let index = 0; index < skills2.length; index += 1) {
    const skill = skills2[index];
    const cooldown = cooldowns.get(skill.id) ?? 0;
    if (cooldown <= 0) {
      readySkillIndexes.push(index);
    }
  }
  if (readySkillIndexes.length === 0) {
    return void 0;
  }
  const readySkills = readySkillIndexes.map((index) => skills2[index]);
  const ranked = rankReadySkills(readySkills, context);
  const top = ranked[0];
  return {
    index: readySkillIndexes[top.index],
    score: top.score,
    reasons: top.reasons,
    readyCount: readySkillIndexes.length
  };
}
function reduceCooldowns(cooldowns, tick) {
  for (const [skillId, cooldown] of cooldowns.entries()) {
    cooldowns.set(skillId, Math.max(0, cooldown - tick));
  }
}
function reduceAllCooldowns(cooldowns, amount) {
  if (amount <= 0) {
    return;
  }
  for (const [skillId, cooldown] of cooldowns.entries()) {
    cooldowns.set(skillId, Math.max(0, cooldown - amount));
  }
}

// src/core/report/breakdown.ts
function mergeDamageEntries(entries) {
  const merged = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.category}`;
    const current = merged.get(key);
    if (current) {
      current.total += entry.total;
    } else {
      merged.set(key, { ...entry });
    }
  }
  return [...merged.values()].sort((a, b) => b.total - a.total);
}
function ratio(part, total) {
  if (total <= 0) {
    return 0;
  }
  return part / total;
}

// src/core/battle/simulator.ts
function runAutoBattle(input2) {
  const loadoutSeed = [
    input2.loadout.weapon?.id ?? "none",
    input2.loadout.helm?.id ?? "none",
    input2.loadout.armor?.id ?? "none",
    input2.loadout.ring1?.id ?? "none",
    input2.loadout.ring2?.id ?? "none",
    input2.loadout.core?.id ?? "none"
  ].join("|");
  const rng = createSeededRng(
    `${input2.floor.floor}:${input2.archetype}:${input2.skills.map((skill) => skill.id).join("|")}:${loadoutSeed}:${input2.seedTag ?? "single"}`
  );
  const passiveRuntime = createPassiveRuntime(input2.loadout);
  const enemies = Array.from({ length: input2.floor.enemyCount }, (_, index) => ({
    id: index + 1,
    hp: input2.floor.enemyHp,
    dots: []
  }));
  const cooldowns = /* @__PURE__ */ new Map();
  for (const skill of input2.skills) {
    cooldowns.set(skill.id, 0);
  }
  const damageEntries = /* @__PURE__ */ new Map();
  const damageTimeline = [];
  const combatLog = [];
  let time = 0;
  let playerHp = input2.finalStats.hp;
  let shield = 0;
  let resource = 0;
  let damageTaken = 0;
  let dotDamage = 0;
  let procDamage = 0;
  let starvedTicks = 0;
  let overflowTicks = 0;
  let totalTicks = 0;
  let firstSkillCastAt;
  let firstKillTime = null;
  let nextBasicAt = 0;
  let nextEnemyAttackAt = ENEMY_ATTACK_INTERVAL;
  while (time <= MAX_BATTLE_DURATION && playerHp > 0 && aliveEnemies(enemies).length > 0) {
    totalTicks += 1;
    advancePassiveCooldowns(passiveRuntime, SIMULATION_TICK);
    resource += input2.finalStats.resourceRegen * SIMULATION_TICK;
    if (resource >= input2.finalStats.resourceMax) {
      overflowTicks += 1;
      resource = clamp2(resource, 0, input2.finalStats.resourceMax);
      applyPassiveActions({
        actions: resolvePassive(
          passiveRuntime,
          "onResourceOverflowTick",
          { now: time, playerResourceRatio: 1 },
          rng
        ),
        passiveRuntime,
        input: input2,
        enemies,
        damageEntries,
        damageTimeline,
        onProcDamage: (value) => {
          procDamage += value;
        },
        onGrantResource: (value) => {
          resource = clamp2(resource + value, 0, input2.finalStats.resourceMax);
        },
        onShieldGain: (value) => {
          shield = Math.max(0, shield + value);
        },
        onReduceAllCooldowns: (value) => {
          reduceAllCooldowns(cooldowns, value);
        },
        onFirstKill: (killAt) => {
          if (firstKillTime === null) {
            firstKillTime = killAt;
          }
        },
        time
      });
    } else {
      resource = clamp2(resource, 0, input2.finalStats.resourceMax);
    }
    playerHp = Math.min(input2.finalStats.hp, playerHp + input2.finalStats.regen * SIMULATION_TICK);
    reduceCooldowns(cooldowns, SIMULATION_TICK);
    for (const enemy of aliveEnemies(enemies)) {
      tickDots(enemy, time, (dot, damage) => {
        const dealt = applyDamage(enemy, damage);
        if (dealt <= 0) {
          return;
        }
        dotDamage += dealt;
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          {
            sourceId: dot.sourceId,
            sourceName: dot.sourceName,
            category: "dot",
            total: 0
          },
          dealt
        );
        if (enemy.hp <= 0) {
          if (firstKillTime === null) {
            firstKillTime = time;
          }
          pushCombatLog(combatLog, time, `\u654C\u4EBA ${enemy.id} \u88AB ${dot.name} \u6301\u7EED\u4F24\u5BB3\u51FB\u8D25\u3002`);
        }
      });
    }
    const primaryTarget = aliveEnemies(enemies)[0];
    const readySkillSelection = selectReadySkill(input2.skills, cooldowns, {
      archetype: input2.archetype,
      elapsedTime: time,
      resource,
      resourceMax: input2.finalStats.resourceMax,
      playerHpRatio: clamp2(playerHp / input2.finalStats.hp, 0, 1),
      targetHpRatio: primaryTarget ? clamp2(primaryTarget.hp / input2.floor.enemyHp, 0, 1) : 1,
      targetDotStacks: primaryTarget ? getDotStacks(primaryTarget) : 0,
      enemyCount: aliveEnemies(enemies).length,
      resourceStarvedRate: totalTicks > 0 ? starvedTicks / totalTicks : 0,
      resourceOverflowRate: totalTicks > 0 ? overflowTicks / totalTicks : 0
    });
    if (readySkillSelection) {
      const selected = input2.skills[readySkillSelection.index];
      if (resource < selected.cost) {
        starvedTicks += 1;
      } else {
        if (readySkillSelection.readyCount > 1 && readySkillSelection.reasons.length > 0) {
          pushCombatLog(
            combatLog,
            time,
            `\u6280\u80FD\u51B3\u7B56\uFF1A${selected.name}\uFF08${readySkillSelection.reasons.join("\u3001")}\uFF09`
          );
        }
        if (firstSkillCastAt === void 0) {
          firstSkillCastAt = time;
        }
        castSkill({
          input: input2,
          skill: selected,
          enemies,
          damageEntries,
          damageTimeline,
          combatLog,
          time,
          rng,
          passiveRuntime,
          onProcDamage: (value) => {
            procDamage += value;
          },
          currentResource: resource,
          resourceMax: input2.finalStats.resourceMax,
          consumeResource: (value) => {
            resource = clamp2(resource - value, 0, input2.finalStats.resourceMax);
          },
          grantResource: (value) => {
            resource = clamp2(resource + value, 0, input2.finalStats.resourceMax);
          },
          setCooldown: (skillId, value) => {
            cooldowns.set(skillId, value);
          },
          reduceAllCooldownsBy: (amount) => {
            reduceAllCooldowns(cooldowns, amount);
          },
          getPlayerHp: () => playerHp,
          setPlayerHp: (value) => {
            playerHp = clamp2(value, 0, input2.finalStats.hp);
          },
          getShield: () => shield,
          setShield: (value) => {
            shield = Math.max(0, value);
          },
          onFirstKill: (killAt) => {
            if (firstKillTime === null) {
              firstKillTime = killAt;
            }
          }
        });
      }
    }
    if (time >= nextBasicAt && aliveEnemies(enemies).length > 0) {
      const target = aliveEnemies(enemies)[0];
      const basicBase = input2.finalStats.atk * pressureDamageModifier("direct", input2.floor.pressure);
      const basicCrit = rollCrit(input2.finalStats.crit, rng);
      const critApplied = basicCrit ? basicBase * critMultiplier(input2.finalStats.critDamage) : basicBase;
      const reduced = reducedByResist(
        reducedByDefense(critApplied, input2.floor.enemyDef),
        input2.floor.enemyResist
      );
      const dealt = applyDamage(target, reduced);
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: "basic_attack", sourceName: "\u57FA\u7840\u653B\u51FB", category: "direct", total: 0 },
          dealt
        );
      }
      resource = clamp2(
        resource + 8 + (input2.archetype === "engine" ? 1 : 0),
        0,
        input2.finalStats.resourceMax
      );
      nextBasicAt = time + calcAttackInterval(input2.finalStats.speed);
      if (dealt > 0 && target.hp <= 0) {
        if (firstKillTime === null) {
          firstKillTime = time;
        }
        pushCombatLog(combatLog, time, `\u654C\u4EBA ${target.id} \u88AB\u57FA\u7840\u653B\u51FB\u51FB\u8D25\u3002`);
      }
    }
    while (time >= nextEnemyAttackAt && aliveEnemies(enemies).length > 0) {
      const incomingRaw = aliveEnemies(enemies).length * input2.floor.enemyAtk * enemyPressureAttackModifier(input2.floor.pressure);
      const reduced = reducedByResist(reducedByDefense(incomingRaw, input2.finalStats.def), input2.finalStats.resist);
      const afterShield = Math.max(0, reduced - shield);
      shield = Math.max(0, shield - reduced);
      playerHp = Math.max(0, playerHp - afterShield);
      damageTaken += afterShield;
      pushCombatLog(combatLog, time, `\u654C\u65B9\u653B\u51FB\u9020\u6210 ${Math.round(afterShield)} \u70B9\u4F24\u5BB3\u3002`);
      const attackCadence = input2.floor.pressure === "swarm" ? ENEMY_ATTACK_INTERVAL / 1.12 : ENEMY_ATTACK_INTERVAL;
      nextEnemyAttackAt += attackCadence;
    }
    time += SIMULATION_TICK;
  }
  const duration = Math.min(MAX_BATTLE_DURATION, Math.max(SIMULATION_TICK, time));
  const merged = mergeDamageEntries([...damageEntries.values()]);
  const totalDamage = merged.reduce((sum, entry) => sum + entry.total, 0);
  const basicDamage = merged.filter((entry) => entry.sourceId === "basic_attack").reduce((sum, entry) => sum + entry.total, 0);
  const coreTriggerDamage = merged.filter((entry) => entry.sourceId.startsWith("trigger:") || entry.sourceId.startsWith("core_")).reduce((sum, entry) => sum + entry.total, 0);
  const skillDamage = Math.max(0, totalDamage - basicDamage - coreTriggerDamage);
  const directDamage = merged.filter((entry) => entry.category === "direct").reduce((sum, entry) => sum + entry.total, 0);
  const remainingEnemyHp = aliveEnemies(enemies).reduce((sum, enemy) => sum + enemy.hp, 0);
  const totalEnemyHp = input2.floor.enemyHp * input2.floor.enemyCount;
  const win = aliveEnemies(enemies).length === 0 && playerHp > 0;
  const basicRatio = ratio(basicDamage, totalDamage);
  const skillRatio = ratio(skillDamage, totalDamage);
  const coreTriggerRatio = ratio(coreTriggerDamage, totalDamage);
  const dotRatio = ratio(dotDamage, totalDamage);
  const procRatio = ratio(procDamage, totalDamage);
  const directRatio = ratio(directDamage, totalDamage);
  const metrics = {
    duration,
    totalDamage,
    damageTaken,
    remainingHp: Math.max(0, playerHp),
    burstDps: computeBurstDps(damageTimeline, 3),
    sustainDps: totalDamage / duration,
    startupTime: firstSkillCastAt ?? duration,
    resourceStarvedRate: totalTicks > 0 ? starvedTicks / totalTicks : 0,
    resourceOverflowRate: totalTicks > 0 ? overflowTicks / totalTicks : 0,
    dotDamage,
    procDamage,
    basicAttackDamage: basicDamage,
    skillDamage,
    coreTriggerDamage,
    directDamageRatio: directRatio,
    dotDamageRatio: dotRatio,
    procDamageRatio: procRatio,
    basicAttackRatio: basicRatio,
    skillRatio,
    coreTriggerRatio,
    basicAttackDamageRatio: basicRatio,
    skillDamageRatio: skillRatio,
    coreTriggerDamageRatio: coreTriggerRatio,
    firstKillTime,
    enemyRemainingHpRatio: win ? 0 : clamp2(remainingEnemyHp / Math.max(1, totalEnemyHp), 0, 1),
    damageBySource: merged
  };
  if (!win && duration >= MAX_BATTLE_DURATION) {
    pushCombatLog(combatLog, duration, "\u6218\u6597\u8D85\u65F6\u3002");
  }
  if (!win && playerHp <= 0) {
    pushCombatLog(combatLog, duration, "\u89D2\u8272\u88AB\u51FB\u8D25\u3002");
  }
  if (win) {
    pushCombatLog(combatLog, duration, "\u6218\u6597\u901A\u5173\u3002");
  }
  return {
    win,
    metrics,
    combatLog
  };
}
function castSkill(args) {
  const {
    input: input2,
    skill,
    enemies,
    damageEntries,
    damageTimeline,
    combatLog,
    time,
    rng,
    passiveRuntime,
    onProcDamage,
    currentResource,
    resourceMax,
    consumeResource,
    grantResource,
    setCooldown,
    reduceAllCooldownsBy,
    getPlayerHp,
    setPlayerHp,
    getShield,
    setShield,
    onFirstKill
  } = args;
  consumeResource(skill.cost);
  const playerResourceRatio = clamp2(currentResource / Math.max(1, resourceMax), 0, 1);
  const targets = skill.tags.includes("aoe") ? aliveEnemies(enemies) : aliveEnemies(enemies).slice(0, 1);
  const pressureDirect = pressureDamageModifier("direct", input2.floor.pressure);
  const castPassiveActions = resolvePassive(
    passiveRuntime,
    "onSkillCast",
    {
      now: time,
      skill,
      resourceSpent: skill.cost,
      targetHpRatio: targets[0] ? clamp2(targets[0].hp / input2.floor.enemyHp, 0, 1) : 1,
      targetDotStacks: targets[0] ? getDotStacks(targets[0]) : 0,
      playerResourceRatio
    },
    rng
  );
  const castActionOutcome = applyPassiveActions({
    actions: castPassiveActions,
    passiveRuntime,
    input: input2,
    enemies,
    damageEntries,
    damageTimeline,
    onProcDamage,
    onGrantResource: grantResource,
    onShieldGain: (value) => setShield(getShield() + value),
    onReduceAllCooldowns: reduceAllCooldownsBy,
    onFirstKill,
    time
  });
  if ((skill.directRatio ?? 0) > 0 && targets.length > 0) {
    const hits = Math.max(1, skill.hits ?? 1);
    const perHitRatio = (skill.directRatio ?? 0) / hits;
    for (let hitIndex = 0; hitIndex < hits; hitIndex += 1) {
      const currentTargets = aliveEnemies(enemies);
      if (currentTargets.length === 0) {
        break;
      }
      const target = skill.tags.includes("aoe") ? currentTargets[hitIndex % currentTargets.length] : currentTargets[0];
      let raw = input2.finalStats.atk * perHitRatio * (1 + input2.finalStats.skillPower) * pressureDirect;
      const critChance = input2.finalStats.crit + (skill.critBonus ?? 0);
      const didCrit = rollCrit(critChance, rng);
      if (didCrit) {
        raw *= critMultiplier(input2.finalStats.critDamage);
      }
      const executeBonus = input2.loadout.core?.mechanicModifiers?.executeBonus ?? 0;
      if (executeBonus > 0 && target.hp <= input2.floor.enemyHp * 0.3 && skill.tags.includes("finisher")) {
        raw *= 1 + executeBonus;
      }
      const hitPassiveActions = resolvePassive(
        passiveRuntime,
        "onSkillHit",
        {
          now: time,
          skill,
          targetHpRatio: clamp2(target.hp / input2.floor.enemyHp, 0, 1),
          targetDotStacks: getDotStacks(target),
          didCrit,
          playerResourceRatio
        },
        rng
      );
      const reduced = reducedByResist(reducedByDefense(raw, input2.floor.enemyDef), input2.floor.enemyResist);
      const dealt = applyDamage(target, reduced);
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "direct", total: 0 },
          dealt
        );
      }
      applyPassiveActions({
        actions: hitPassiveActions,
        passiveRuntime,
        input: input2,
        enemies,
        damageEntries,
        damageTimeline,
        onProcDamage,
        onGrantResource: grantResource,
        onShieldGain: (value) => setShield(getShield() + value),
        onReduceAllCooldowns: reduceAllCooldownsBy,
        onFirstKill,
        time
      });
      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
        pushCombatLog(combatLog, time, `\u654C\u4EBA ${target.id} \u88AB ${skill.name} \u51FB\u8D25\u3002`);
        const killActions = resolvePassive(passiveRuntime, "onKill", {
          now: time,
          skill,
          didCrit
        }, rng);
        applyPassiveActions({
          actions: killActions,
          passiveRuntime,
          input: input2,
          enemies,
          damageEntries,
          damageTimeline,
          onProcDamage,
          onGrantResource: grantResource,
          onShieldGain: (value) => setShield(getShield() + value),
          onReduceAllCooldowns: reduceAllCooldownsBy,
          onFirstKill,
          time
        });
      }
    }
  }
  if (skill.dot) {
    const extraStacks = input2.loadout.core?.mechanicModifiers?.extraDotStacks ?? 0;
    const targetsForDot = skill.tags.includes("aoe") ? aliveEnemies(enemies) : aliveEnemies(enemies).slice(0, 1);
    for (const target of targetsForDot) {
      const rawDot = input2.finalStats.atk * skill.dot.tickRatio * (1 + input2.finalStats.dotPower);
      const adjusted = reducedByResist(
        reducedByDefense(rawDot * pressureDamageModifier("dot", input2.floor.pressure), input2.floor.enemyDef),
        input2.floor.enemyResist
      );
      applyDotToEnemy({
        enemy: target,
        skill,
        now: time,
        damagePerTick: adjusted,
        extraStacks
      });
    }
  }
  if ((skill.burstDotPercent ?? 0) > 0) {
    const target = aliveEnemies(enemies)[0];
    if (target) {
      const burstBonus = input2.loadout.core?.mechanicModifiers?.dotBurstBonus ?? 0;
      const passiveBurstBonus = castActionOutcome.dotBurstMultiplierBonus;
      const burstPercent = (skill.burstDotPercent ?? 0) * (1 + burstBonus + passiveBurstBonus);
      const burst = burstDotDamage(target, burstPercent);
      if (burst > 0) {
        const dealt = applyDamage(target, burst);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "dot", total: 0 },
          dealt
        );
        if (dealt > 0 && target.hp <= 0) {
          onFirstKill(time);
          pushCombatLog(combatLog, time, `\u654C\u4EBA ${target.id} \u88AB ${skill.name} \u51FB\u8D25\u3002`);
        }
      }
    }
  }
  if ((skill.procRatio ?? 0) > 0) {
    const target = aliveEnemies(enemies)[0];
    if (target) {
      const procRatioWithBonus = (skill.procRatio ?? 0) + consumeNextProcBonus(passiveRuntime);
      const raw = input2.finalStats.atk * procRatioWithBonus * (1 + input2.finalStats.procPower);
      const adjusted = reducedByResist(
        reducedByDefense(raw * pressureDamageModifier("proc", input2.floor.pressure), input2.floor.enemyDef),
        input2.floor.enemyResist
      );
      const dealt = applyDamage(target, adjusted);
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "proc", total: 0 },
          dealt
        );
      }
      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
      }
    }
  }
  if (input2.loadout.core?.mechanicModifiers?.procTriggerOnSpend && skill.cost > 0) {
    const target = aliveEnemies(enemies)[0];
    if (target) {
      const procRatioWithBonus = 0.3 + consumeNextProcBonus(passiveRuntime);
      const raw = input2.finalStats.atk * procRatioWithBonus * (1 + input2.finalStats.procPower);
      const adjusted = reducedByResist(
        reducedByDefense(raw * pressureDamageModifier("proc", input2.floor.pressure), input2.floor.enemyDef),
        input2.floor.enemyResist
      );
      const dealt = applyDamage(target, adjusted);
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          {
            sourceId: input2.loadout.core.id,
            sourceName: `${input2.loadout.core.name}\u89E6\u53D1`,
            category: "proc",
            total: 0
          },
          dealt
        );
      }
      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
      }
    }
  }
  if ((skill.shieldRatio ?? 0) > 0) {
    const shieldGain = input2.finalStats.atk * (skill.shieldRatio ?? 0) * (1 + input2.finalStats.shieldPower);
    setShield(getShield() + shieldGain);
  }
  if ((skill.healRatio ?? 0) > 0) {
    const healGain = input2.finalStats.atk * (skill.healRatio ?? 0) * (1 + input2.finalStats.skillPower * 0.6);
    setPlayerHp(getPlayerHp() + healGain);
  }
  if (skill.tags.includes("cycle")) {
    grantResource(5);
  }
  if ((input2.loadout.core?.mechanicModifiers?.resourceRefundBonus ?? 0) > 0) {
    const refund = skill.cost * (input2.loadout.core?.mechanicModifiers?.resourceRefundBonus ?? 0);
    grantResource(refund);
  }
  setCooldown(skill.id, scaleCooldown(skill.cooldown, input2.finalStats.cdr));
  pushCombatLog(combatLog, time, `\u65BD\u653E\u6280\u80FD\uFF1A${skill.name}\u3002`);
}
function applyPassiveActions(args) {
  const {
    actions,
    passiveRuntime,
    input: input2,
    enemies,
    damageEntries,
    damageTimeline,
    onProcDamage,
    onGrantResource,
    onShieldGain,
    onReduceAllCooldowns,
    onFirstKill,
    time
  } = args;
  let procDamage = 0;
  let dotBurstMultiplierBonus = 0;
  for (const action of actions) {
    if ((action.grantResource ?? 0) > 0) {
      onGrantResource(action.grantResource ?? 0);
    }
    if ((action.addShield ?? 0) > 0) {
      onShieldGain(action.addShield ?? 0);
    }
    if ((action.reduceAllCooldowns ?? 0) > 0) {
      onReduceAllCooldowns(action.reduceAllCooldowns ?? 0);
    }
    if ((action.dotBurstMultiplierBonus ?? 0) > 0) {
      dotBurstMultiplierBonus += action.dotBurstMultiplierBonus ?? 0;
    }
    if ((action.setNextProcBonusRatio ?? 0) > 0) {
      passiveRuntime.nextProcBonusRatio = Math.min(
        1.5,
        passiveRuntime.nextProcBonusRatio + (action.setNextProcBonusRatio ?? 0)
      );
    }
    if ((action.bonusProcRatio ?? 0) > 0) {
      const target = aliveEnemies(enemies)[0];
      if (!target) {
        continue;
      }
      const procRatioWithBonus = (action.bonusProcRatio ?? 0) + consumeNextProcBonus(passiveRuntime);
      const raw = input2.finalStats.atk * procRatioWithBonus * (1 + input2.finalStats.procPower);
      const adjusted = reducedByResist(
        reducedByDefense(raw * pressureDamageModifier("proc", input2.floor.pressure), input2.floor.enemyDef),
        input2.floor.enemyResist
      );
      const dealt = applyDamage(target, adjusted);
      if (dealt > 0) {
        procDamage += dealt;
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          {
            sourceId: `trigger:${action.sourceId}`,
            sourceName: `${action.sourceName}\u89E6\u53D1`,
            category: "proc",
            total: 0
          },
          dealt
        );
      }
      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
      }
    }
  }
  return { procDamage, dotBurstMultiplierBonus };
}
function resolvePassive(runtime, event, payload, rng) {
  return resolvePassiveActions(runtime, event, payload, rng);
}
function registerDamage(board, timeline, time, source, dealt) {
  if (dealt <= 0) {
    return;
  }
  const key = `${source.sourceId}:${source.category}`;
  const current = board.get(key);
  if (current) {
    current.total += dealt;
  } else {
    board.set(key, { ...source, total: dealt });
  }
  const index = Math.max(0, Math.floor(time / SIMULATION_TICK));
  timeline[index] = (timeline[index] ?? 0) + dealt;
}
function applyDamage(enemy, amount) {
  if (enemy.hp <= 0 || amount <= 0) {
    return 0;
  }
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= dealt;
  return dealt;
}
function aliveEnemies(enemies) {
  return enemies.filter((enemy) => enemy.hp > 0);
}
function getDotStacks(enemy) {
  return enemy.dots.reduce((sum, dot) => sum + dot.stacks, 0);
}
function pushCombatLog(log, time, message) {
  if (log.length >= 180) {
    return;
  }
  log.push(`[${time.toFixed(1)}] ${message}`);
}
function computeBurstDps(timeline, windowSeconds) {
  const windowTicks = Math.max(1, Math.round(windowSeconds / SIMULATION_TICK));
  let maxWindowDamage = 0;
  let rolling = 0;
  for (let index = 0; index < timeline.length; index += 1) {
    rolling += timeline[index] ?? 0;
    if (index >= windowTicks) {
      rolling -= timeline[index - windowTicks] ?? 0;
    }
    if (rolling > maxWindowDamage) {
      maxWindowDamage = rolling;
    }
  }
  return maxWindowDamage / windowSeconds;
}

// src/core/battle/diagnosis.ts
function diagnoseBattle(input2) {
  const { win, floor: floor2, archetype, metrics } = input2;
  const diagnoses = [];
  const totalEnemyHp = floor2.enemyHp * floor2.enemyCount;
  const firstKillTime = metrics.firstKillTime ?? metrics.duration;
  const isSingleTargetPressure = floor2.boss || floor2.enemyCount === 1 || floor2.pressure === "single";
  const startupGate = isSingleTargetPressure ? 6.8 : 8.2;
  const clearGate = isSingleTargetPressure ? 13 : 17;
  const startupSlow = metrics.startupTime > startupGate;
  const clearInefficient = !isSingleTargetPressure && firstKillTime > clearGate;
  const timingAcceptable = !startupSlow && !clearInefficient;
  const expectedSustainDps = totalEnemyHp / Math.max(1, metrics.duration);
  const lowRawDamage = metrics.enemyRemainingHpRatio > 0.2 && metrics.sustainDps < expectedSustainDps * 0.82 && timingAcceptable;
  if (!win && metrics.remainingHp <= 0) {
    pushDiagnosis(diagnoses, {
      code: "LOW_SURVIVAL",
      message: "\u751F\u5B58\u4E0D\u8DB3\uFF1A\u89D2\u8272\u5728\u5B8C\u6210\u8F93\u51FA\u5FAA\u73AF\u524D\u88AB\u51FB\u8D25\u3002"
    });
  }
  if (!win && startupSlow) {
    pushDiagnosis(diagnoses, {
      code: "SLOW_STARTUP",
      message: "\u542F\u52A8\u8FC7\u6162\uFF1A\u524D\u671F\u6709\u6548\u8F93\u51FA\u5EFA\u7ACB\u8FC7\u665A\uFF0C\u9519\u8FC7\u4E86\u538B\u8840\u7A97\u53E3\u3002"
    });
  }
  if (!win && clearInefficient) {
    pushDiagnosis(diagnoses, {
      code: "LOW_CLEAR_EFFICIENCY",
      message: "\u6E05\u573A\u6548\u7387\u4F4E\uFF1A\u8D77\u624B\u5C1A\u53EF\uFF0C\u4F46\u9996\u6740\u8FC7\u6162\u5BFC\u81F4\u7FA4\u602A\u538B\u529B\u7D2F\u79EF\u3002"
    });
  }
  if (!win && isSingleTargetPressure && metrics.enemyRemainingHpRatio > 0.3 && metrics.duration > 24) {
    pushDiagnosis(diagnoses, {
      code: "LOW_SINGLE_TARGET_FINISH",
      message: "\u5355\u4F53\u6536\u5C3E\u4E0D\u8DB3\uFF1A\u6218\u6597\u540E\u6BB5\u4ECD\u6709\u8F83\u9AD8\u654C\u65B9\u8840\u91CF\u672A\u538B\u4E0B\u3002"
    });
  }
  if (!win && lowRawDamage) {
    pushDiagnosis(diagnoses, {
      code: "LOW_RAW_DAMAGE",
      message: "\u539F\u59CB\u4F24\u5BB3\u4E0D\u8DB3\uFF1A\u65F6\u673A\u57FA\u672C\u6B63\u5E38\uFF0C\u4F46\u5355\u4F4D\u65F6\u95F4\u4F24\u5BB3\u4E0D\u591F\u3002"
    });
  }
  if (metrics.resourceOverflowRate > 0.36 && metrics.coreTriggerRatio < 0.2) {
    pushDiagnosis(diagnoses, {
      code: "RESOURCE_WASTE",
      message: "\u8D44\u6E90\u6D6A\u8D39\uFF1A\u6EA2\u51FA\u7387\u504F\u9AD8\uFF0C\u672A\u6709\u6548\u8F6C\u5316\u4E3A\u89E6\u53D1/\u62A4\u76FE\u6536\u76CA\u3002"
    });
  } else if (metrics.resourceStarvedRate > 0.34) {
    pushDiagnosis(diagnoses, {
      code: "RESOURCE_STARVED",
      message: "\u8D44\u6E90\u4E0D\u8DB3\uFF1A\u6280\u80FD\u591A\u6B21\u5C31\u7EEA\u4F46\u65E0\u6CD5\u91CA\u653E\u3002"
    });
  }
  const lowMechanic = isLowMechanicContribution(archetype, metrics);
  if (lowMechanic) {
    pushDiagnosis(diagnoses, {
      code: "LOW_MECHANIC_CONTRIBUTION",
      message: lowMechanic
    });
  }
  if (!win && diagnoses.length === 0 && metrics.enemyRemainingHpRatio > 0.2) {
    pushDiagnosis(diagnoses, {
      code: "LOW_RAW_DAMAGE",
      message: "\u7EFC\u5408\u541E\u5410\u4E0D\u8DB3\uFF1A\u5F53\u524D\u6784\u7B51\u672A\u8FBE\u5230\u8BE5\u5C42\u6700\u4F4E\u8F93\u51FA\u9608\u503C\u3002"
    });
  }
  return diagnoses.slice(0, 3);
}
function isLowMechanicContribution(archetype, metrics) {
  const dotRatio = ratio(metrics.dotDamage, metrics.totalDamage);
  const procRatio = ratio(metrics.procDamage, metrics.totalDamage);
  switch (archetype) {
    case "dot":
      if (dotRatio < 0.33) {
        return "\u673A\u5236\u8D21\u732E\u4F4E\uFF1ADOT\u5360\u6BD4\u4E0D\u8DB3\uFF0C\u94FA\u5C42\u4E0E\u5F15\u7206\u8054\u52A8\u504F\u5F31\u3002";
      }
      return void 0;
    case "engine":
      if (procRatio < 0.3 || metrics.coreTriggerRatio < 0.08) {
        return "\u673A\u5236\u8D21\u732E\u4F4E\uFF1A\u8D44\u6E90\u5FAA\u73AF\u672A\u5F62\u6210\u7A33\u5B9A\u89E6\u53D1\u94FE\u3002";
      }
      return void 0;
    case "crit":
      if (metrics.directDamageRatio < 0.6 || metrics.skillRatio < 0.5) {
        return "\u673A\u5236\u8D21\u732E\u4F4E\uFF1A\u66B4\u51FB\u76F4\u4F24\u94FE\u6761\u8D21\u732E\u4E0D\u8DB3\uFF0C\u7EC8\u7ED3\u7A97\u53E3\u4EF7\u503C\u504F\u4F4E\u3002";
      }
      return void 0;
    default:
      return void 0;
  }
}
function pushDiagnosis(target, next) {
  if (target.some((entry) => entry.code === next.code)) {
    return;
  }
  target.push(next);
}

// src/core/loot/itemFactory.ts
var serial = 0;
function createItemInstance(item, seedPrefix) {
  serial += 1;
  return {
    ...item,
    stats: { ...item.stats },
    affixes: item.affixes ? [...item.affixes] : void 0,
    mechanicEffects: item.mechanicEffects ? item.mechanicEffects.map((effect) => ({ ...effect })) : void 0,
    instanceId: `${seedPrefix}-${item.id}-${serial}`
  };
}

// src/core/loot/rarity.ts
function rarityWeightsForFloor(floor2) {
  if (floor2 <= 6) {
    return [
      { rarity: "common", weight: 74 },
      { rarity: "rare", weight: 24 },
      { rarity: "legendary", weight: 2 }
    ];
  }
  if (floor2 <= 12) {
    return [
      { rarity: "common", weight: 56 },
      { rarity: "rare", weight: 36 },
      { rarity: "legendary", weight: 8 }
    ];
  }
  if (floor2 <= 16) {
    return [
      { rarity: "common", weight: 44 },
      { rarity: "rare", weight: 42 },
      { rarity: "legendary", weight: 14 }
    ];
  }
  return [
    { rarity: "common", weight: 30 },
    { rarity: "rare", weight: 45 },
    { rarity: "legendary", weight: 25 }
  ];
}

// src/core/loot/lootGenerator.ts
function generateLoot(input2) {
  if (!input2.win) {
    return [];
  }
  const rng = createSeededRng(input2.seed);
  const drops = input2.floor.boss || input2.floor.floor % 5 === 0 ? 2 : 1;
  const pool = [...ITEMS, ...RELICS];
  const result = [];
  for (let dropIndex = 0; dropIndex < drops; dropIndex += 1) {
    const rarity = pickRarity(input2.floor.floor, rng.next());
    const candidates = pool.filter((item) => item.rarity === rarity);
    const chosen = weightedPick(candidates, input2.archetype, rng.next());
    result.push(createItemInstance(chosen, `${input2.floor.floor}-${dropIndex}`));
  }
  return result;
}
function pickRarity(floor2, roll) {
  const weights = rarityWeightsForFloor(floor2);
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = roll * total;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.rarity;
    }
  }
  return "common";
}
function weightedPick(items, archetype, roll) {
  if (items.length === 0) {
    return ITEMS[0];
  }
  const weighted = items.map((item) => {
    const bonus = item.archetypeBias === archetype ? 3 : 1;
    return { item, weight: bonus };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = roll * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.item;
    }
  }
  return weighted[0].item;
}

// src/core/tower/floorGuidance.ts
function buildFloorGuidance(floor2) {
  switch (floor2.pressure) {
    case "swarm":
      return {
        primaryObjective: "\u9996\u6740\u901F\u5EA6\u4E0E\u524D\u4E2D\u6BB5\u6E05\u573A\u6548\u7387",
        secondaryObjective: "\u907F\u514D\u591A\u76EE\u6807\u957F\u65F6\u95F4\u53E0\u538B\u5BFC\u81F4\u751F\u5B58\u5D29\u76D8",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u5F00\u5C40\u9996\u6740\u8FC7\u6162\uFF0C\u7FA4\u602A\u6570\u91CF\u957F\u671F\u7EF4\u6301\u5728\u9AD8\u4F4D\uFF0C\u627F\u4F24\u5FEB\u901F\u7D2F\u8BA1\u3002",
        recommendedMetricFocus: ["\u9996\u6740\u65F6\u95F4", "\u542F\u52A8\u65F6\u95F4", "\u627F\u53D7\u4F24\u5BB3", "\u5269\u4F59\u654C\u65B9\u8840\u91CF\u6BD4"],
        bottleneckTags: ["startup", "clear", "survival"]
      };
    case "burst":
      return {
        primaryObjective: "\u4E2D\u6BB5\u751F\u5B58\u4E0E\u7A33\u5B9A\u8F93\u51FA\u5151\u73B0",
        secondaryObjective: "\u51CF\u5C11\u8D44\u6E90\u65AD\u6863\u5BFC\u81F4\u7684\u8F93\u51FA\u7A97\u53E3\u7A7A\u8F6C",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u6709\u8F93\u51FA\u4F46\u8282\u594F\u65AD\u6863\uFF0C\u5403\u6EE1\u7206\u53D1\u4F24\u5BB3\u540E\u65E0\u6CD5\u56DE\u7A33\u3002",
        recommendedMetricFocus: ["\u627F\u53D7\u4F24\u5BB3", "\u8D44\u6E90\u532E\u4E4F\u7387", "\u6301\u7EEDDPS", "\u5269\u4F59\u751F\u547D"],
        bottleneckTags: ["survival", "resource", "throughput"]
      };
    case "single":
      return {
        primaryObjective: "\u5355\u4F53\u538B\u8840\u4E0E\u540E\u6BB5\u6536\u5C3E\u80FD\u529B",
        secondaryObjective: "\u4FDD\u8BC1\u5173\u952E\u6280\u80FD\u5728\u4F4E\u8840\u7A97\u53E3\u53EF\u7528",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u524D\u6BB5\u538B\u8840\u53EF\u63A5\u53D7\uFF0C\u4F46\u540E\u6BB5\u7F3A\u4E4F\u6536\u5C3E\u5F3A\u5EA6\uFF0C\u62D6\u65F6\u540E\u53CD\u88AB\u53CD\u6740\u3002",
        recommendedMetricFocus: ["\u654C\u65B9\u5269\u4F59\u8840\u91CF\u6BD4", "\u9996\u6740\u65F6\u95F4", "\u6301\u7EEDDPS", "\u8D44\u6E90\u6EA2\u51FA\u7387"],
        bottleneckTags: ["single", "throughput", "resource"]
      };
    case "sustain":
      return {
        primaryObjective: "\u957F\u6218\u751F\u5B58\u4E0E\u8D44\u6E90\u7A33\u5B9A\u5FAA\u73AF",
        secondaryObjective: "\u673A\u5236\u4F24\u5BB3\u5728\u4E2D\u540E\u6BB5\u6301\u7EED\u5151\u73B0",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u5FAA\u73AF\u524D\u51E0\u8F6E\u6B63\u5E38\uFF0C\u4F46\u540E\u7EED\u8D44\u6E90/\u751F\u5B58\u4EFB\u4E00\u5D29\u6E83\u5BFC\u81F4\u5168\u9762\u6389\u7EBF\u3002",
        recommendedMetricFocus: ["\u8D44\u6E90\u532E\u4E4F\u7387", "\u8D44\u6E90\u6EA2\u51FA\u7387", "\u627F\u53D7\u4F24\u5BB3", "\u673A\u5236\u5360\u6BD4"],
        bottleneckTags: ["survival", "resource", "mechanic"]
      };
    case "antiMechanic":
      return {
        primaryObjective: "\u5728\u673A\u5236\u53D7\u538B\u65F6\u7EF4\u6301\u6709\u6548\u4F24\u5BB3\u5151\u73B0",
        secondaryObjective: "\u8865\u8DB3\u539F\u59CB\u4F24\u5BB3\u4E0B\u9650\uFF0C\u907F\u514D\u5168\u9760\u673A\u5236\u89E6\u53D1",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u673A\u5236\u5360\u6BD4\u88AB\u538B\u540E\u603B\u4F24\u663E\u8457\u4E0B\u964D\uFF0C\u5355\u4F53\u6536\u5C3E\u80FD\u529B\u4E0D\u8DB3\u3002",
        recommendedMetricFocus: ["\u603B\u4F24\u5BB3", "\u673A\u5236\u5360\u6BD4", "\u654C\u65B9\u5269\u4F59\u8840\u91CF\u6BD4", "\u6301\u7EEDDPS"],
        bottleneckTags: ["mechanic", "throughput", "single"]
      };
    case "baseline":
    default: {
      if (floor2.floor <= 6) {
        return {
          primaryObjective: "\u57FA\u7840\u5FAA\u73AF\u6210\u578B\u4E0E\u9996\u8F6E\u6280\u80FD\u7A33\u5B9A\u91CA\u653E",
          secondaryObjective: "\u4FDD\u6301\u9996\u6740\u8282\u594F\uFF0C\u907F\u514D\u8FC7\u65E9\u8D44\u6E90\u65AD\u6863",
          failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u6280\u80FD\u94FE\u6761\u4E0D\u5B8C\u6574\uFF0C\u8D77\u624B\u6162\u4E14\u8D44\u6E90\u7BA1\u7406\u5931\u8861\u3002",
          recommendedMetricFocus: ["\u542F\u52A8\u65F6\u95F4", "\u9996\u6740\u65F6\u95F4", "\u8D44\u6E90\u532E\u4E4F\u7387", "\u8D44\u6E90\u6EA2\u51FA\u7387"],
          bottleneckTags: ["startup", "resource", "clear"]
        };
      }
      return {
        primaryObjective: "\u57FA\u7840\u8F93\u51FA\u4E0E\u751F\u5B58\u5747\u8861",
        secondaryObjective: "\u907F\u514D\u77ED\u677F\u653E\u5927\u5BFC\u81F4\u540E\u6BB5\u6389\u7EBF",
        failurePatternSummary: "\u5E38\u89C1\u5931\u8D25\u662F\u67D0\u4E00\u77ED\u677F\uFF08\u8F93\u51FA\u6216\u751F\u5B58\uFF09\u5728\u4E2D\u6BB5\u88AB\u96C6\u4E2D\u653E\u5927\u3002",
        recommendedMetricFocus: ["\u603B\u4F24\u5BB3", "\u627F\u53D7\u4F24\u5BB3", "\u5269\u4F59\u751F\u547D", "\u9996\u6740\u65F6\u95F4"],
        bottleneckTags: ["throughput", "survival", "startup"]
      };
    }
  }
}

// src/core/report/guidance.ts
var ISSUE_TARGETS = {
  LOW_RAW_DAMAGE: ["weapon", "ring2", "core"],
  LOW_DAMAGE: ["weapon", "ring2", "core"],
  SLOW_STARTUP: ["weapon", "skill\u69FD\u4F4D1", "ring2"],
  LOW_CLEAR_EFFICIENCY: ["skill\u69FD\u4F4D2", "ring1", "core"],
  LOW_SINGLE_TARGET_FINISH: ["skill\u69FD\u4F4D3", "weapon", "core"],
  RESOURCE_WASTE: ["core", "skill\u69FD\u4F4D3", "ring1"],
  LOW_MECHANIC_CONTRIBUTION: ["core", "ring1", "skill\u69FD\u4F4D2"],
  RESOURCE_STARVED: ["ring2", "skill\u69FD\u4F4D1", "core"],
  RESOURCE_OVERFLOW: ["core", "ring1", "skill\u69FD\u4F4D3"],
  LOW_SURVIVAL: ["armor", "helm", "core"],
  LOW_DOT_RATIO: ["core", "ring2", "skill\u69FD\u4F4D2"],
  LOW_PROC_RATIO: ["core", "ring1", "skill\u69FD\u4F4D2"]
};
var BASE_ISSUE_PRIORITY = {
  LOW_SURVIVAL: 95,
  LOW_SINGLE_TARGET_FINISH: 89,
  LOW_CLEAR_EFFICIENCY: 86,
  SLOW_STARTUP: 84,
  LOW_RAW_DAMAGE: 82,
  LOW_DAMAGE: 80,
  RESOURCE_WASTE: 78,
  LOW_MECHANIC_CONTRIBUTION: 76,
  LOW_DOT_RATIO: 75,
  LOW_PROC_RATIO: 75,
  RESOURCE_STARVED: 73,
  RESOURCE_OVERFLOW: 70
};
function buildReportGuidance(input2) {
  const floorObjective = buildFloorGuidance(input2.floor);
  const floorBuildGoal = buildFloorBuildGoal({
    floorObjective,
    archetype: input2.archetype,
    metrics: input2.metrics,
    diagnosis: input2.diagnosis
  });
  const priorityAdjustment = rankPriorityAdjustment({
    floorObjective,
    archetype: input2.archetype,
    diagnosis: input2.diagnosis,
    metrics: input2.metrics,
    loadout: input2.loadout
  });
  const actionSuggestions = buildActionSuggestions({
    diagnosis: input2.diagnosis,
    archetype: input2.archetype,
    floorObjective,
    priorityAdjustment
  });
  const candidateItemIds = collectCandidateItems(input2.diagnosis, input2.archetype, input2.loadout);
  const primaryIssue = input2.diagnosis.length > 0 ? input2.diagnosis[0].code : "NONE";
  const secondaryIssue = input2.diagnosis.length > 1 ? input2.diagnosis[1].code : void 0;
  return {
    primaryIssue,
    secondaryIssue,
    actionSuggestions,
    recommendedTargets: buildRecommendedTargets(input2.diagnosis, priorityAdjustment.topPriorityTarget),
    candidateItemIds,
    floorObjective,
    floorBuildGoal,
    priorityAdjustment
  };
}
function buildFloorBuildGoal(input2) {
  const topTag = input2.floorObjective.bottleneckTags[0];
  const floorBuildGoal = describeFloorBuildGoal(input2.archetype, topTag, input2.metrics);
  const focusMetrics = [...input2.floorObjective.recommendedMetricFocus];
  if (input2.metrics) {
    if (input2.metrics.firstKillTime === null || input2.metrics.firstKillTime > 12) {
      focusMetrics.unshift("\u9996\u6740\u65F6\u95F4");
    }
    if (input2.metrics.enemyRemainingHpRatio > 0.3) {
      focusMetrics.unshift("\u654C\u65B9\u5269\u4F59\u8840\u91CF\u6BD4");
    }
    if (input2.metrics.resourceOverflowRate > 0.35 || input2.metrics.resourceStarvedRate > 0.3) {
      focusMetrics.unshift("\u8D44\u6E90\u5229\u7528\u7387");
    }
  }
  return {
    floorBuildGoal,
    focusMetrics: uniqueStrings(focusMetrics).slice(0, 4),
    deprioritizedDirections: deprioritizedDirections(input2.floorObjective, input2.archetype, input2.diagnosis)
  };
}
function rankPriorityAdjustment(input2) {
  const rankedIssues = rankIssuesForFloor(input2.diagnosis, input2.floorObjective);
  const topIssue = rankedIssues[0];
  const secondIssue = rankedIssues[1];
  if (!topIssue) {
    const fallbackIssue = fallbackIssueByFloor(input2.floorObjective, input2.archetype);
    const fallbackTarget = ISSUE_TARGETS[fallbackIssue][0] ?? "core";
    const fallbackCandidate = firstUnequippedCandidate(
      mapIssueToCandidates(fallbackIssue, input2.archetype),
      input2.loadout
    );
    return {
      topPriorityAdjustment: mapIssueToAdjustment(fallbackIssue, input2.archetype),
      secondaryAdjustment: void 0,
      topPriorityTarget: fallbackTarget,
      topPriorityCandidateItemId: fallbackCandidate,
      reasoning: `\u5F53\u524D\u5C42\u91CD\u70B9\u662F${input2.floorObjective.primaryObjective}\uFF0C\u5148\u4ECE${fallbackTarget}\u8865\u8DB3\u6700\u77ED\u677F\u3002`
    };
  }
  const topTarget = pickTopTarget(topIssue.code, input2.floorObjective.bottleneckTags);
  const topCandidate = firstUnequippedCandidate(
    mapIssueToCandidates(topIssue.code, input2.archetype),
    input2.loadout
  );
  return {
    topPriorityAdjustment: mapIssueToAdjustment(topIssue.code, input2.archetype),
    secondaryAdjustment: secondIssue ? mapIssueToAdjustment(secondIssue.code, input2.archetype) : void 0,
    topPriorityTarget: topTarget,
    topPriorityCandidateItemId: topCandidate,
    reasoning: buildReasoningLine({
      floorObjective: input2.floorObjective,
      issueCode: topIssue.code,
      metrics: input2.metrics,
      target: topTarget
    })
  };
}
function rankIssuesForFloor(diagnosis, floorObjective) {
  return [...diagnosis].sort((left, right) => {
    const leftScore = issuePriorityScore(left.code, floorObjective.bottleneckTags);
    const rightScore = issuePriorityScore(right.code, floorObjective.bottleneckTags);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return BASE_ISSUE_PRIORITY[right.code] - BASE_ISSUE_PRIORITY[left.code];
  });
}
function issuePriorityScore(code, floorTags) {
  const base = BASE_ISSUE_PRIORITY[code] ?? 60;
  const tag = issueToTag(code);
  const tagBonus = floorTags.includes(tag) ? 8 : 0;
  const antiMechanicBonus = code === "LOW_MECHANIC_CONTRIBUTION" && floorTags.includes("mechanic") ? 6 : 0;
  return base + tagBonus + antiMechanicBonus;
}
function issueToTag(code) {
  switch (code) {
    case "SLOW_STARTUP":
      return "startup";
    case "LOW_CLEAR_EFFICIENCY":
      return "clear";
    case "LOW_SINGLE_TARGET_FINISH":
      return "single";
    case "LOW_SURVIVAL":
      return "survival";
    case "RESOURCE_WASTE":
    case "RESOURCE_STARVED":
    case "RESOURCE_OVERFLOW":
      return "resource";
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return "mechanic";
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return "throughput";
  }
}
function fallbackIssueByFloor(floorObjective, archetype) {
  const tag = floorObjective.bottleneckTags[0];
  if (tag === "startup") {
    return "SLOW_STARTUP";
  }
  if (tag === "clear") {
    return "LOW_CLEAR_EFFICIENCY";
  }
  if (tag === "single") {
    return "LOW_SINGLE_TARGET_FINISH";
  }
  if (tag === "survival") {
    return "LOW_SURVIVAL";
  }
  if (tag === "resource") {
    return "RESOURCE_WASTE";
  }
  if (tag === "mechanic") {
    return archetype === "dot" ? "LOW_DOT_RATIO" : archetype === "engine" ? "LOW_PROC_RATIO" : "LOW_MECHANIC_CONTRIBUTION";
  }
  return "LOW_RAW_DAMAGE";
}
function pickTopTarget(code, floorTags) {
  const targets = ISSUE_TARGETS[code] ?? ["core"];
  if (floorTags.includes("survival")) {
    const survivability = targets.find((target) => target === "armor" || target === "helm");
    if (survivability) {
      return survivability;
    }
  }
  if (floorTags.includes("single") || floorTags.includes("throughput")) {
    const offense = targets.find((target) => target === "weapon" || target === "skill\u69FD\u4F4D3");
    if (offense) {
      return offense;
    }
  }
  return targets[0] ?? "core";
}
function mapIssueToAdjustment(code, archetype) {
  switch (code) {
    case "SLOW_STARTUP":
      return "\u4F18\u5148\u538B\u7F29\u8D77\u624B\u8282\u594F\uFF0C\u786E\u4FDD\u9996\u8F6E\u6838\u5FC3\u6280\u80FD\u66F4\u65E9\u91CA\u653E\u3002";
    case "LOW_CLEAR_EFFICIENCY":
      return "\u4F18\u5148\u8865\u6E05\u573A\u6548\u7387\uFF0C\u8BA9\u9996\u6740\u540E\u5C3D\u5FEB\u8FDB\u5165\u6EDA\u96EA\u7403\u8282\u594F\u3002";
    case "LOW_SINGLE_TARGET_FINISH":
      return "\u4F18\u5148\u52A0\u5F3A\u5355\u4F53\u6536\u5C3E\uFF0C\u628A\u5173\u952E\u4F24\u5BB3\u7559\u5728\u4F4E\u8840\u7A97\u53E3\u3002";
    case "LOW_SURVIVAL":
      return "\u4F18\u5148\u8865\u751F\u5B58\uFF0C\u8BA9\u8F93\u51FA\u5FAA\u73AF\u81F3\u5C11\u7A33\u5B9A\u8DD1\u5B8C\u4E00\u8F6E\u3002";
    case "RESOURCE_WASTE":
      return "\u4F18\u5148\u6539\u5584\u8D44\u6E90\u5151\u73B0\uFF0C\u51CF\u5C11\u9AD8\u8D44\u6E90\u7A7A\u8F6C\u3002";
    case "RESOURCE_STARVED":
      return "\u4F18\u5148\u8865\u56DE\u80FD/\u8FD4\u8FD8\u80FD\u91CF\uFF0C\u907F\u514D\u6280\u80FD\u957F\u65F6\u95F4\u7A7A\u8F6C\u3002";
    case "LOW_MECHANIC_CONTRIBUTION":
      return archetype === "dot" ? "\u4F18\u5148\u5F3A\u5316DOT\u8986\u76D6\u4E0E\u5F15\u7206\u8054\u52A8\u3002" : archetype === "crit" ? "\u4F18\u5148\u5F3A\u5316\u66B4\u51FB\u4E0E\u7EC8\u7ED3\u7684\u534F\u540C\u4EF7\u503C\u3002" : "\u4F18\u5148\u5F3A\u5316\u8D44\u6E90\u5230\u89E6\u53D1\u4F24\u5BB3\u7684\u8F6C\u6362\u94FE\u3002";
    case "LOW_DOT_RATIO":
      return "\u4F18\u5148\u63D0\u9AD8DOT\u5360\u6BD4\uFF0C\u51CF\u5C11\u7EAF\u76F4\u4F24\u5360\u6BD4\u8FC7\u9AD8\u7684\u95EE\u9898\u3002";
    case "LOW_PROC_RATIO":
      return "\u4F18\u5148\u63D0\u9AD8\u89E6\u53D1\u5360\u6BD4\uFF0C\u4FDD\u8BC1\u5F15\u64CE\u6784\u7B51\u7684\u6838\u5FC3\u5151\u73B0\u3002";
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return "\u4F18\u5148\u63D0\u9AD8\u5355\u4F4D\u65F6\u95F4\u6709\u6548\u4F24\u5BB3\uFF0C\u5148\u8865\u6700\u77ED\u677F\u8F93\u51FA\u4F4D\u3002";
  }
}
function buildActionSuggestions(input2) {
  const suggestions = /* @__PURE__ */ new Set();
  suggestions.add(input2.priorityAdjustment.topPriorityAdjustment);
  for (const entry of input2.diagnosis) {
    suggestions.add(mapIssueToAdjustment(entry.code, input2.archetype));
  }
  suggestions.add(`\u672C\u5C42\u4F18\u5148\u5173\u6CE8\uFF1A${input2.floorObjective.primaryObjective}\u3002`);
  if (input2.floorObjective.bottleneckTags.includes("resource")) {
    suggestions.add("\u8D44\u6E90\u76F8\u5173\u8C03\u6574\u4F18\u5148\u4E8E\u7EAF\u9762\u677F\u5806\u53E0\u3002");
  }
  if (input2.floorObjective.bottleneckTags.includes("single")) {
    suggestions.add("\u5C06\u7EC8\u7ED3\u6280\u80FD\u7559\u7ED9\u4F4E\u8840\u7A97\u53E3\uFF0C\u907F\u514D\u63D0\u524D\u7A7A\u653E\u3002");
  }
  return [...suggestions].slice(0, 4);
}
function buildRecommendedTargets(diagnosis, topPriorityTarget) {
  const targets = /* @__PURE__ */ new Set();
  targets.add(topPriorityTarget);
  for (const entry of diagnosis) {
    for (const target of ISSUE_TARGETS[entry.code] ?? []) {
      targets.add(target);
    }
  }
  return [...targets].slice(0, 3);
}
function collectCandidateItems(diagnosis, archetype, loadout2) {
  const candidates = /* @__PURE__ */ new Set();
  for (const entry of diagnosis) {
    for (const itemId of mapIssueToCandidates(entry.code, archetype)) {
      candidates.add(itemId);
    }
  }
  return [...candidates].filter((itemId) => !isEquipped(itemId, loadout2)).slice(0, 4);
}
function describeFloorBuildGoal(archetype, topTag, metrics) {
  const archetypeGoal = archetype === "dot" ? "DOT\u6D41\u5E94\u4F18\u5148\u66F4\u65E9\u53E0\u5C42\u5E76\u5728\u7A97\u53E3\u671F\u5F15\u7206\u3002" : archetype === "crit" ? "\u66B4\u51FB\u6D41\u5E94\u5148\u4FDD\u8BC1\u4E2D\u6BB5\u76F4\u4F24\uFF0C\u518D\u4F9D\u8D56\u7EC8\u7ED3\u6536\u5272\u3002" : "\u5F15\u64CE\u6D41\u5E94\u4F18\u5148\u63D0\u5347\u8D44\u6E90\u5230\u4F24\u5BB3\u7684\u5151\u73B0\u6548\u7387\u3002";
  const tagGoal = topTag === "startup" ? "\u672C\u5C42\u5148\u89E3\u51B3\u8D77\u624B\u901F\u5EA6\u3002" : topTag === "clear" ? "\u672C\u5C42\u5148\u89E3\u51B3\u6E05\u573A\u6548\u7387\u3002" : topTag === "single" ? "\u672C\u5C42\u5148\u89E3\u51B3\u5355\u4F53\u6536\u5C3E\u3002" : topTag === "survival" ? "\u672C\u5C42\u5148\u4FDD\u8BC1\u751F\u5B58\u7A33\u5B9A\u3002" : topTag === "resource" ? "\u672C\u5C42\u5148\u4FEE\u590D\u8D44\u6E90\u7A33\u5B9A\u4E0E\u5151\u73B0\u3002" : topTag === "mechanic" ? "\u672C\u5C42\u5148\u63D0\u5347\u673A\u5236\u8D21\u732E\u5360\u6BD4\u3002" : "\u672C\u5C42\u5148\u8865\u5355\u4F4D\u65F6\u95F4\u4F24\u5BB3\u3002";
  if (!metrics) {
    return `${tagGoal}${archetypeGoal}`;
  }
  if (metrics.firstKillTime === null || metrics.firstKillTime > 14) {
    return `${tagGoal}${archetypeGoal} \u4F60\u7684\u9996\u6740\u504F\u6162\uFF0C\u5E94\u5148\u8BA9\u524D10\u79D2\u8F93\u51FA\u66F4\u6709\u6548\u3002`;
  }
  if (metrics.enemyRemainingHpRatio > 0.35) {
    return `${tagGoal}${archetypeGoal} \u5F53\u524D\u540E\u6BB5\u538B\u8840\u4E0D\u8DB3\uFF0C\u5E94\u4F18\u5148\u8865\u6536\u5C3E\u5F3A\u5EA6\u3002`;
  }
  return `${tagGoal}${archetypeGoal}`;
}
function deprioritizedDirections(floorObjective, archetype, diagnosis) {
  const directions = /* @__PURE__ */ new Set();
  if (floorObjective.bottleneckTags.includes("survival")) {
    directions.add("\u6682\u4E0D\u4F18\u5148\u7EE7\u7EED\u5806\u7EAF\u7206\u53D1\u9762\u677F\u3002");
  }
  if (floorObjective.bottleneckTags.includes("single")) {
    directions.add("\u6682\u4E0D\u4F18\u5148\u8FFD\u6C42\u6CDBAOE\uFF0C\u5148\u8865\u5355\u4F53\u6536\u5C3E\u3002");
  }
  if (floorObjective.bottleneckTags.includes("resource")) {
    directions.add("\u6682\u4E0D\u4F18\u5148\u63D0\u9AD8\u8D44\u6E90\u83B7\u53D6\u4E0A\u9650\uFF0C\u5148\u63D0\u9AD8\u8D44\u6E90\u5151\u73B0\u3002");
  }
  if (archetype === "dot" && diagnosis.some((entry) => entry.code === "LOW_DOT_RATIO")) {
    directions.add("\u6682\u4E0D\u4F18\u5148\u5806\u76F4\u4F24\uFF0C\u5148\u4FDD\u8BC1DOT\u4E0E\u5F15\u7206\u8054\u52A8\u3002");
  }
  if (archetype === "engine" && diagnosis.some((entry) => entry.code === "RESOURCE_WASTE")) {
    directions.add("\u6682\u4E0D\u4F18\u5148\u52A0\u56DE\u80FD\uFF0C\u5148\u8865\u9AD8\u8D39\u6D88\u8017\u6216\u6EA2\u51FA\u8F6C\u6536\u76CA\u3002");
  }
  if (directions.size === 0) {
    directions.add("\u4E0D\u5EFA\u8BAE\u540C\u65F6\u6539\u592A\u591A\u90E8\u4F4D\uFF0C\u4F18\u5148\u9A8C\u8BC1\u4E00\u5904\u5173\u952E\u8C03\u6574\u3002");
  }
  return [...directions].slice(0, 3);
}
function buildReasoningLine(input2) {
  const metricHint = metricHintByIssue(input2.issueCode, input2.metrics);
  return `\u5F53\u524D\u5C42\u4E3B\u8981\u8003\u9A8C${input2.floorObjective.primaryObjective}\uFF0C\u4F60\u5728${metricHint}\u4E0A\u843D\u540E\uFF0C\u5148\u4ECE${input2.target}\u8C03\u6574\u6700\u6709\u6548\u3002`;
}
function metricHintByIssue(code, metrics) {
  if (!metrics) {
    return "\u5173\u952E\u6307\u6807";
  }
  switch (code) {
    case "SLOW_STARTUP":
      return `\u542F\u52A8\u65F6\u95F4(${metrics.startupTime.toFixed(1)}\u79D2)`;
    case "LOW_CLEAR_EFFICIENCY":
      return `\u9996\u6740\u65F6\u95F4(${metrics.firstKillTime === null ? "\u65E0" : `${metrics.firstKillTime.toFixed(1)}\u79D2`})`;
    case "LOW_SINGLE_TARGET_FINISH":
    case "LOW_RAW_DAMAGE":
    case "LOW_DAMAGE":
      return `\u654C\u65B9\u5269\u4F59\u8840\u91CF\u6BD4(${(metrics.enemyRemainingHpRatio * 100).toFixed(1)}%)`;
    case "RESOURCE_WASTE":
    case "RESOURCE_OVERFLOW":
      return `\u8D44\u6E90\u6EA2\u51FA\u7387(${(metrics.resourceOverflowRate * 100).toFixed(1)}%)`;
    case "RESOURCE_STARVED":
      return `\u8D44\u6E90\u532E\u4E4F\u7387(${(metrics.resourceStarvedRate * 100).toFixed(1)}%)`;
    case "LOW_SURVIVAL":
      return `\u5269\u4F59\u751F\u547D(${metrics.remainingHp.toFixed(0)})`;
    default:
      return "\u673A\u5236\u8D21\u732E";
  }
}
function mapIssueToCandidates(code, archetype) {
  switch (code) {
    case "SLOW_STARTUP":
      return archetype === "engine" ? ["core_feedback_prism", "w_threshold_accumulator"] : ["r_venom_timer"];
    case "LOW_CLEAR_EFFICIENCY":
      return archetype === "dot" ? ["r_plague_resonator", "core_spore_hive"] : ["r_engine_loop"];
    case "LOW_SINGLE_TARGET_FINISH":
      return archetype === "crit" ? ["r_mercy_trigger", "w_execution_scope"] : ["core_assassin_relay"];
    case "LOW_RAW_DAMAGE":
    case "LOW_DAMAGE":
      return archetype === "dot" ? ["w_serrated_reaper", "r_rupture_sigil"] : archetype === "crit" ? ["w_predator_rifle", "r_guillotine_coil"] : ["w_reactor_lance", "core_singularity_drive"];
    case "RESOURCE_WASTE":
    case "RESOURCE_OVERFLOW":
      return ["core_feedback_prism", "core_overflow_matrix", "w_threshold_accumulator"];
    case "RESOURCE_STARVED":
      return ["r_rupture_sigil", "core_singularity_drive", "r_engine_loop"];
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return archetype === "dot" ? ["core_spore_hive", "r_plague_resonator"] : archetype === "crit" ? ["r_mercy_trigger", "core_assassin_relay"] : ["core_feedback_prism", "w_threshold_accumulator"];
    case "LOW_SURVIVAL":
      return ["a_reactive_shell", "core_overflow_matrix", "h_flux_reservoir"];
    default:
      return [];
  }
}
function firstUnequippedCandidate(candidates, loadout2) {
  return candidates.find((itemId) => !isEquipped(itemId, loadout2));
}
function isEquipped(itemId, loadout2) {
  return [loadout2.weapon, loadout2.helm, loadout2.armor, loadout2.ring1, loadout2.ring2, loadout2.core].filter(Boolean).some((item) => item?.id === itemId);
}
function uniqueStrings(values) {
  return [...new Set(values)];
}

// src/core/report/reportBuilder.ts
function buildBattleReport(args) {
  const { input: input2, simulation: simulation2 } = args;
  const diagnosis = diagnoseBattle({
    win: simulation2.win,
    floor: input2.floor,
    archetype: input2.archetype,
    metrics: simulation2.metrics
  });
  const loot = generateLoot({
    win: simulation2.win,
    floor: input2.floor,
    archetype: input2.archetype,
    seed: `${input2.floor.floor}:${simulation2.metrics.totalDamage.toFixed(1)}:${simulation2.metrics.duration.toFixed(
      1
    )}`
  });
  return {
    win: simulation2.win,
    floor: input2.floor.floor,
    pressure: input2.floor.pressure,
    metrics: simulation2.metrics,
    diagnosis,
    guidance: buildReportGuidance({
      floor: input2.floor,
      archetype: input2.archetype,
      metrics: simulation2.metrics,
      diagnosis,
      loadout: input2.loadout
    }),
    combatLog: simulation2.combatLog,
    loot
  };
}

// src/core/build/itemRecommendations.ts
var DIMENSION_TAG = {
  startup: "\u6539\u5584\u9996\u6740",
  clear: "\u6539\u5584\u6E05\u573A",
  single: "\u6539\u5584\u5355\u4F53",
  survival: "\u6539\u5584\u751F\u5B58",
  resource: "\u6539\u5584\u8D44\u6E90\u5151\u73B0",
  mechanic: "\u5F3A\u5316\u673A\u5236\u5151\u73B0"
};
function recommendItemForBuild(input2) {
  const dimensions = inferItemDimensions(input2.item, input2.archetype);
  const tags = /* @__PURE__ */ new Set();
  let score = 0;
  for (const dimension of dimensions) {
    tags.add(DIMENSION_TAG[dimension]);
    score += 1.4;
  }
  if (dimensions.includes("mechanic")) {
    if (input2.archetype === "dot") {
      tags.add("\u5F3A\u5316DOT\u5F15\u7206");
      score += 1.2;
    } else if (input2.archetype === "crit") {
      tags.add("\u5F3A\u5316\u66B4\u51FB\u6536\u5C3E");
      score += 1.2;
    } else {
      tags.add("\u5F3A\u5316\u5F15\u64CE\u5151\u73B0");
      score += 1.2;
    }
  }
  const issueCodes = input2.lastReport?.diagnosis.map((entry) => entry.code) ?? [];
  const helpsLastIssue = issueCodes.some((code) => canAddressIssue(code, dimensions));
  if (helpsLastIssue) {
    tags.add("\u5BF9\u75C7");
    score += 2.4;
  }
  if (input2.floorGuidance && fitsFloor(input2.floorGuidance.bottleneckTags, dimensions)) {
    tags.add("\u9002\u5408\u5F53\u524D\u5C42");
    score += 2.2;
  }
  const topPriorityId = input2.lastReport?.guidance?.priorityAdjustment.topPriorityCandidateItemId;
  if (topPriorityId && topPriorityId === input2.item.id) {
    tags.add("\u4F18\u5148\u5C1D\u8BD5");
    score += 3.2;
  } else if (input2.reportCandidateItemIds?.includes(input2.item.id)) {
    score += 1.6;
  }
  if (input2.item.archetypeBias === input2.archetype) {
    score += 1.4;
  }
  if (isEquippedTemplate(input2.item, input2.loadout)) {
    score -= 1.1;
  }
  const priorityLabel = resolvePriorityLabel(score);
  const recommendedToTry = priorityLabel === "\u4F18\u5148\u5C1D\u8BD5";
  return {
    tags: pickTopTags(tags),
    recommendedToTry,
    helpsLastIssue,
    priorityLabel,
    score
  };
}
function inferItemDimensions(item, archetype) {
  const dimensions = /* @__PURE__ */ new Set();
  const effects = item.mechanicEffects ?? [];
  if ((item.stats.speed ?? 0) > 0 || (item.stats.cdr ?? 0) > 0 || (item.stats.resourceRegen ?? 0) > 2) {
    dimensions.add("startup");
  }
  if ((item.stats.dotPower ?? 0) > 0.1 || (item.stats.procPower ?? 0) > 0.12 || effects.some((effect) => effect.id === "DOT_FULLSTACK_ECHO")) {
    dimensions.add("clear");
    dimensions.add("mechanic");
  }
  if ((item.stats.atk ?? 0) > 22 || (item.stats.crit ?? 0) > 0.1 || (item.stats.critDamage ?? 0) > 0.2 || effects.some((effect) => effect.id === "CRIT_FINISHER_REFUND" || effect.id === "CRIT_FINISHER_VALUE")) {
    dimensions.add("single");
  }
  if ((item.stats.hp ?? 0) >= 160 || (item.stats.def ?? 0) >= 24 || (item.stats.shieldPower ?? 0) > 0 || (item.stats.resist ?? 0) > 0) {
    dimensions.add("survival");
  }
  if ((item.stats.resourceMax ?? 0) > 0 || (item.stats.resourceRegen ?? 0) > 0 || effects.some(
    (effect) => effect.id === "ENGINE_HIGH_RESOURCE_CHAIN" || effect.id === "LOW_RESOURCE_CYCLE_SURGE" || effect.id === "SPEND_EMPOWER_NEXT_PROC"
  )) {
    dimensions.add("resource");
  }
  if (archetype === "dot" && ((item.stats.dotPower ?? 0) > 0 || effects.some((effect) => effect.id.includes("DOT")))) {
    dimensions.add("mechanic");
  }
  if (archetype === "crit" && ((item.stats.crit ?? 0) > 0 || effects.some((effect) => effect.id.includes("CRIT_FINISHER")))) {
    dimensions.add("mechanic");
  }
  if (archetype === "engine" && ((item.stats.procPower ?? 0) > 0 || effects.some((effect) => effect.id.includes("ENGINE") || effect.id.includes("PROC")))) {
    dimensions.add("mechanic");
  }
  return [...dimensions];
}
function fitsFloor(floorTags, dimensions) {
  const tagToDimension = {
    startup: "startup",
    clear: "clear",
    single: "single",
    survival: "survival",
    resource: "resource",
    mechanic: "mechanic",
    throughput: "single"
  };
  return floorTags.some((tag) => {
    const mapped = tagToDimension[tag];
    return mapped ? dimensions.includes(mapped) : false;
  });
}
function canAddressIssue(code, dimensions) {
  switch (code) {
    case "SLOW_STARTUP":
      return dimensions.includes("startup");
    case "LOW_CLEAR_EFFICIENCY":
      return dimensions.includes("clear");
    case "LOW_SINGLE_TARGET_FINISH":
      return dimensions.includes("single");
    case "LOW_SURVIVAL":
      return dimensions.includes("survival");
    case "RESOURCE_WASTE":
    case "RESOURCE_STARVED":
    case "RESOURCE_OVERFLOW":
      return dimensions.includes("resource");
    case "LOW_MECHANIC_CONTRIBUTION":
    case "LOW_DOT_RATIO":
    case "LOW_PROC_RATIO":
      return dimensions.includes("mechanic");
    case "LOW_DAMAGE":
    case "LOW_RAW_DAMAGE":
    default:
      return dimensions.includes("single") || dimensions.includes("clear");
  }
}
function resolvePriorityLabel(score) {
  if (score >= 7) {
    return "\u4F18\u5148\u5C1D\u8BD5";
  }
  if (score >= 4.2) {
    return "\u53EF\u5C1D\u8BD5";
  }
  return "\u6682\u975E\u4F18\u5148";
}
function pickTopTags(tags) {
  const ordered = [...tags];
  const priorityOrder = [
    "\u4F18\u5148\u5C1D\u8BD5",
    "\u9002\u5408\u5F53\u524D\u5C42",
    "\u5BF9\u75C7",
    "\u6539\u5584\u9996\u6740",
    "\u6539\u5584\u6E05\u573A",
    "\u6539\u5584\u5355\u4F53",
    "\u6539\u5584\u751F\u5B58",
    "\u6539\u5584\u8D44\u6E90\u5151\u73B0",
    "\u5F3A\u5316DOT\u5F15\u7206",
    "\u5F3A\u5316\u66B4\u51FB\u6536\u5C3E",
    "\u5F3A\u5316\u5F15\u64CE\u5151\u73B0"
  ];
  ordered.sort((left, right) => priorityOrder.indexOf(left) - priorityOrder.indexOf(right));
  return ordered.slice(0, 3);
}
function isEquippedTemplate(item, loadout2) {
  return [loadout2.weapon, loadout2.helm, loadout2.armor, loadout2.ring1, loadout2.ring2, loadout2.core].filter(Boolean).some((entry) => entry?.id === item.id);
}

// tmp/round6_example.ts
var loadout = {
  weapon: ITEM_BY_ID["w_bone_knife"],
  helm: ITEM_BY_ID["h_stitched_hood"],
  armor: ITEM_BY_ID["a_scaled_vest"],
  ring1: ITEM_BY_ID["r_dot_band"],
  ring2: ITEM_BY_ID["r_plain_loop"],
  core: RELIC_BY_ID["core_venom_crown"],
  skillIds: ["toxic_lance", "contagion_wave", "rupture_bloom"]
};
var floor = TOWER_FLOORS.find((entry) => entry.floor === 18);
var finalStats = aggregateStats(BASE_PLAYER_STATS, loadout);
var skills = loadout.skillIds.map((id) => SKILL_BY_ID[id]);
var input = { floor, finalStats, skills, loadout, archetype: "dot" };
var simulation = runAutoBattle(input);
var report = buildBattleReport({ input, simulation });
var candidateId = report.guidance?.priorityAdjustment.topPriorityCandidateItemId ?? "r_plague_resonator";
var candidateItem = ITEM_BY_ID[candidateId] ?? RELIC_BY_ID[candidateId];
var recommendation = recommendItemForBuild({
  item: candidateItem,
  archetype: "dot",
  loadout,
  lastReport: report,
  floorGuidance: report.guidance?.floorObjective,
  reportCandidateItemIds: report.guidance?.candidateItemIds
});
console.log(JSON.stringify({
  floor: report.floor,
  floorObjective: report.guidance?.floorObjective,
  floorBuildGoal: report.guidance?.floorBuildGoal,
  primaryIssue: report.guidance?.primaryIssue,
  topPriorityAdjustment: report.guidance?.priorityAdjustment.topPriorityAdjustment,
  topPriorityTarget: report.guidance?.priorityAdjustment.topPriorityTarget,
  candidate: {
    id: candidateId,
    name: candidateItem?.name ?? candidateId,
    priorityLabel: recommendation.priorityLabel,
    tags: recommendation.tags
  },
  explanation: report.guidance?.priorityAdjustment.reasoning
}, null, 2));
