import type {
  ArchetypeKey,
  PassiveEffectDef,
  RunProgress,
  RunRewardOption,
  RunSkillUpgrade,
  SkillDef,
  Stats,
} from "@/core/battle/types";

interface GenerateRunRewardsInput {
  floor: number;
  archetype: ArchetypeKey;
  skills: SkillDef[];
  progress: RunProgress;
}

interface NumericTemplate {
  id: string;
  title: string;
  description: string;
  stats: Partial<Stats>;
  debugTags: string[];
}

interface MechanicTemplate {
  id: string;
  title: string;
  description: string;
  passiveEffect?: PassiveEffectDef;
  skillUpgrade?: {
    skillId: string;
    upgrade: RunSkillUpgrade;
  };
  debugTags: string[];
}

interface RouteTemplate {
  id: string;
  routeTag: string;
  title: string;
  description: string;
  routeHint: string;
  stats?: Partial<Stats>;
  passiveEffect?: PassiveEffectDef;
  skillUpgrade?: {
    skillId: string;
    upgrade: RunSkillUpgrade;
  };
  debugTags: string[];
}

const DOT_NUMERIC_REWARDS: NumericTemplate[] = [
  {
    id: "dot_numeric_damage",
    title: "腐蚀增幅",
    description: "提高DOT伤害，并小幅提升攻击。",
    stats: { dotPower: 0.12, atk: 10 },
    debugTags: ["dot", "numeric", "damage"],
  },
  {
    id: "dot_numeric_survival",
    title: "腐蚀护壳",
    description: "提高生命与防御，帮助度过前中期压力。",
    stats: { hp: 120, def: 10 },
    debugTags: ["dot", "numeric", "survival"],
  },
  {
    id: "dot_numeric_cycle",
    title: "毒循环",
    description: "提升能量回复与冷却缩减，强化循环覆盖。",
    stats: { resourceRegen: 1.8, cdr: 0.05 },
    debugTags: ["dot", "numeric", "cycle"],
  },
];

const DOT_MECHANIC_REWARDS: MechanicTemplate[] = [
  {
    id: "dot_mechanic_lance",
    title: "毒枪扩散",
    description: "毒枪命中后额外扩散一层弱化DOT。",
    passiveEffect: {
      id: "DOT_LANCE_SPLASH",
      event: "onSkillHit",
      value: 1,
      value2: 0.58,
    },
    debugTags: ["dot", "mechanic", "lance_spread"],
  },
  {
    id: "dot_mechanic_wave",
    title: "传染开场",
    description: "传染波首次释放免费，并获得额外覆盖层数。",
    passiveEffect: {
      id: "CONTAGION_OPENING",
      event: "onSkillCast",
      value: 1,
      value2: 1,
    },
    debugTags: ["dot", "mechanic", "contagion_opening"],
  },
  {
    id: "dot_mechanic_rupture",
    title: "裂绽过载",
    description: "裂绽对高DOT层目标加成更高，且额外+1段命中。",
    passiveEffect: {
      id: "RUPTURE_STACK_SURGE",
      event: "onSkillCast",
      value: 0.08,
      value2: 0.22,
    },
    skillUpgrade: {
      skillId: "rupture_bloom",
      upgrade: { hitsBonus: 1 },
    },
    debugTags: ["dot", "mechanic", "rupture_overdrive"],
  },
];

const DOT_ROUTE_REWARDS: RouteTemplate[] = [
  {
    id: "dot_route_spread",
    routeTag: "DOT扩散",
    title: "路线：DOT扩散",
    description: "强化大范围覆盖与前期压血效率。",
    routeHint: "清场偏慢时优先选择。",
    stats: { dotPower: 0.08, resourceRegen: 1 },
    passiveEffect: {
      id: "DOT_LANCE_SPLASH",
      event: "onSkillHit",
      value: 1,
      value2: 0.62,
    },
    debugTags: ["dot", "route", "spread"],
  },
  {
    id: "dot_route_burst",
    routeTag: "DOT引爆",
    title: "路线：DOT引爆",
    description: "强化转换爆发，缩短首杀形成时间。",
    routeHint: "敌人长期残血不死时优先选择。",
    stats: { atk: 12, cdr: 0.04 },
    passiveEffect: {
      id: "RUPTURE_STACK_SURGE",
      event: "onSkillCast",
      value: 0.1,
      value2: 0.25,
    },
    skillUpgrade: {
      skillId: "rupture_bloom",
      upgrade: { directRatioBonus: 0.14, hitsBonus: 1 },
    },
    debugTags: ["dot", "route", "burst"],
  },
  {
    id: "dot_route_sustain",
    routeTag: "DOT续航",
    title: "路线：DOT续航",
    description: "提升生存和循环稳定，强化长线兑现。",
    routeHint: "容易在循环成型前暴毙时优先选择。",
    stats: { hp: 140, shieldPower: 0.1, resourceRegen: 1.2 },
    passiveEffect: {
      id: "CONTAGION_OPENING",
      event: "onSkillCast",
      value: 1,
      value2: 1,
    },
    debugTags: ["dot", "route", "sustain"],
  },
];

const GENERIC_NUMERIC_REWARDS: Record<ArchetypeKey, NumericTemplate[]> = {
  dot: DOT_NUMERIC_REWARDS,
  crit: [
    {
      id: "crit_numeric",
      title: "精准增幅",
      description: "提升暴击率、暴伤和攻击。",
      stats: { crit: 0.06, critDamage: 0.14, atk: 8 },
      debugTags: ["crit", "numeric"],
    },
  ],
  engine: [
    {
      id: "engine_numeric",
      title: "回路增幅",
      description: "提升触发强度与能量回复。",
      stats: { procPower: 0.1, resourceRegen: 1.6 },
      debugTags: ["engine", "numeric"],
    },
  ],
};

const GENERIC_MECHANIC_REWARDS: Record<ArchetypeKey, MechanicTemplate[]> = {
  dot: DOT_MECHANIC_REWARDS,
  crit: [
    {
      id: "crit_mechanic",
      title: "处决压缩",
      description: "强化处决印记的冷却与收割价值。",
      skillUpgrade: {
        skillId: "execution_mark",
        upgrade: { cooldownReduction: 0.35, directRatioBonus: 0.12 },
      },
      debugTags: ["crit", "mechanic"],
    },
  ],
  engine: [
    {
      id: "engine_mechanic",
      title: "溢出导流",
      description: "资源溢出可更稳定地转化为收益。",
      passiveEffect: {
        id: "ENGINE_OVERFLOW_GUARD",
        event: "onResourceOverflowTick",
        value: 26,
        value2: 0.28,
        cooldown: 1,
      },
      debugTags: ["engine", "mechanic"],
    },
  ],
};

const GENERIC_ROUTE_REWARDS: Record<ArchetypeKey, RouteTemplate[]> = {
  dot: DOT_ROUTE_REWARDS,
  crit: [
    {
      id: "crit_route_execute",
      routeTag: "暴击收割",
      title: "路线：暴击收割",
      description: "强化低血斩杀窗口的爆发能力。",
      routeHint: "敌人经常残血拖很久时优先选择。",
      stats: { crit: 0.04, cdr: 0.04 },
      skillUpgrade: {
        skillId: "execution_mark",
        upgrade: { directRatioBonus: 0.15, cooldownReduction: 0.3 },
      },
      debugTags: ["crit", "route"],
    },
  ],
  engine: [
    {
      id: "engine_route_convert",
      routeTag: "循环兑现",
      title: "路线：循环兑现",
      description: "更稳定地将资源循环转化为触发伤害。",
      routeHint: "资源溢出高但伤害仍低时优先选择。",
      stats: { procPower: 0.08, cdr: 0.03 },
      passiveEffect: {
        id: "SPEND_EMPOWER_NEXT_PROC",
        event: "onSkillCast",
        value: 0.36,
        value2: 20,
      },
      debugTags: ["engine", "route"],
    },
  ],
};

export function generateRunRewards(input: GenerateRunRewardsInput): RunRewardOption[] {
  if (input.skills.length === 0) {
    return [];
  }
  const seed = deterministicSeed(input.floor, input.archetype, input.progress.selectedRewards.length);

  const numeric = pickDeterministic(GENERIC_NUMERIC_REWARDS[input.archetype], seed + 3);
  const mechanic = pickDeterministic(GENERIC_MECHANIC_REWARDS[input.archetype], seed + 11);
  const route = pickDeterministic(GENERIC_ROUTE_REWARDS[input.archetype], seed + 19);

  const numericOption: RunRewardOption = {
    id: `reward-${input.floor}-numeric-${numeric.id}`,
    category: "stat_bonus",
    theme: "numeric",
    title: numeric.title,
    description: numeric.description,
    debugTags: [...numeric.debugTags],
    effect: {
      stats: numeric.stats,
    },
  };

  const mechanicOption: RunRewardOption = {
    id: `reward-${input.floor}-mechanic-${mechanic.id}`,
    category: mechanic.skillUpgrade ? "skill_upgrade" : "passive_modifier",
    theme: "mechanic",
    title: mechanic.title,
    description: mechanic.description,
    debugTags: [...mechanic.debugTags],
    effect: {
      passiveEffect: mechanic.passiveEffect ? { ...mechanic.passiveEffect } : undefined,
      skillUpgrade: mechanic.skillUpgrade ? { ...mechanic.skillUpgrade } : undefined,
    },
  };

  const routeOption: RunRewardOption = {
    id: `reward-${input.floor}-route-${route.id}`,
    category: route.skillUpgrade ? "skill_upgrade" : "passive_modifier",
    theme: "route",
    routeTag: route.routeTag,
    routeHint: route.routeHint,
    title: route.title,
    description: route.description,
    debugTags: [...route.debugTags],
    effect: {
      stats: route.stats,
      passiveEffect: route.passiveEffect ? { ...route.passiveEffect } : undefined,
      skillUpgrade: route.skillUpgrade ? { ...route.skillUpgrade } : undefined,
    },
  };

  return [numericOption, mechanicOption, routeOption];
}

export function applyRunReward(
  progress: RunProgress,
  option: RunRewardOption,
  floor: number,
): RunProgress {
  const next: RunProgress = {
    ...progress,
    statBonuses: { ...progress.statBonuses },
    skillUpgrades: { ...progress.skillUpgrades },
    passiveEffects: [...progress.passiveEffects],
    relicIds: [...progress.relicIds],
    selectedRewards: [...progress.selectedRewards],
    damageByStyle: { ...progress.damageByStyle },
  };

  if (option.effect.stats) {
    for (const [key, value] of Object.entries(option.effect.stats)) {
      const statKey = key as keyof Stats;
      next.statBonuses[statKey] = (next.statBonuses[statKey] ?? 0) + (value ?? 0);
    }
  }

  if (option.effect.skillUpgrade) {
    const skillId = option.effect.skillUpgrade.skillId;
    const prev = next.skillUpgrades[skillId] ?? {};
    const add = option.effect.skillUpgrade.upgrade;
    next.skillUpgrades[skillId] = mergeSkillUpgrade(prev, add);
  }

  if (option.effect.passiveEffect) {
    next.passiveEffects.push({ ...option.effect.passiveEffect });
  }

  if (option.effect.relicId && !next.relicIds.includes(option.effect.relicId)) {
    next.relicIds.push(option.effect.relicId);
  }

  next.selectedRewards.push({
    floor,
    optionId: option.id,
    category: option.category,
    title: option.title,
  });
  return next;
}

function mergeSkillUpgrade(prev: RunSkillUpgrade, add: RunSkillUpgrade): RunSkillUpgrade {
  return {
    cooldownReduction: (prev.cooldownReduction ?? 0) + (add.cooldownReduction ?? 0),
    costReduction: (prev.costReduction ?? 0) + (add.costReduction ?? 0),
    directRatioBonus: (prev.directRatioBonus ?? 0) + (add.directRatioBonus ?? 0),
    dotTickBonus: (prev.dotTickBonus ?? 0) + (add.dotTickBonus ?? 0),
    procRatioBonus: (prev.procRatioBonus ?? 0) + (add.procRatioBonus ?? 0),
    hitsBonus: (prev.hitsBonus ?? 0) + (add.hitsBonus ?? 0),
  };
}

function deterministicSeed(floor: number, archetype: ArchetypeKey, selectedCount: number): number {
  const archetypeValue = archetype === "dot" ? 17 : archetype === "crit" ? 31 : 47;
  return floor * 13 + selectedCount * 7 + archetypeValue;
}

function pickDeterministic<T>(list: T[], seed: number): T {
  const index = Math.abs(seed) % list.length;
  return list[index];
}
