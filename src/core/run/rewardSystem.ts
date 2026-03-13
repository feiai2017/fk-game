import { createSeededRng } from "@/core/battle/formulas";
import type {
  ArchetypeKey,
  RunRewardRecord,
  RunProgress,
  RunRewardOption,
  RunSkillUpgrade,
  SkillDef,
  Stats,
} from "@/core/battle/types";
import { RELICS } from "@/data/relics";

interface GenerateRunRewardsInput {
  floor: number;
  archetype: ArchetypeKey;
  skills: SkillDef[];
  progress: RunProgress;
}

export function generateRunRewards(input: GenerateRunRewardsInput): RunRewardOption[] {
  const rng = createSeededRng(
    `reward:${input.floor}:${input.archetype}:${input.progress.selectedRewards.length}`,
  );
  const chosenSkill = pickSkill(input.skills, rng.next());
  const relicOption = pickRelicOption(input, rng.next());

  return [
    buildStatBonusOption(input, rng.next()),
    buildSkillUpgradeOption(input, chosenSkill, rng.next()),
    relicOption ?? buildPassiveOption(input, rng.next()),
  ];
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
    const current = next.skillUpgrades[skillId] ?? {};
    const incoming = option.effect.skillUpgrade.upgrade;
    next.skillUpgrades[skillId] = {
      cooldownReduction: (current.cooldownReduction ?? 0) + (incoming.cooldownReduction ?? 0),
      costReduction: (current.costReduction ?? 0) + (incoming.costReduction ?? 0),
      directRatioBonus: (current.directRatioBonus ?? 0) + (incoming.directRatioBonus ?? 0),
      dotTickBonus: (current.dotTickBonus ?? 0) + (incoming.dotTickBonus ?? 0),
      procRatioBonus: (current.procRatioBonus ?? 0) + (incoming.procRatioBonus ?? 0),
    };
  }
  if (option.effect.passiveEffect) {
    next.passiveEffects.push({ ...option.effect.passiveEffect });
  }
  if (option.effect.relicId && !next.relicIds.includes(option.effect.relicId)) {
    next.relicIds.push(option.effect.relicId);
  }

  const record: RunRewardRecord = {
    floor,
    optionId: option.id,
    category: option.category,
    title: option.title,
  };
  next.selectedRewards.push(record);
  return next;
}

function buildStatBonusOption(
  input: GenerateRunRewardsInput,
  roll: number,
): RunRewardOption {
  const pools: Array<{ title: string; description: string; stats: Partial<Stats> }> =
    input.archetype === "dot"
      ? [
          { title: "腐蚀增压", description: "dotPower +12%，atk +10", stats: { dotPower: 0.12, atk: 10 } },
          { title: "稳态护甲", description: "hp +90，def +12", stats: { hp: 90, def: 12 } },
        ]
      : input.archetype === "crit"
        ? [
            { title: "致命瞄准", description: "crit +8%，critDamage +16%", stats: { crit: 0.08, critDamage: 0.16 } },
            { title: "火力校准", description: "atk +14，speed +0.05", stats: { atk: 14, speed: 0.05 } },
          ]
        : [
            { title: "过载导通", description: "procPower +12%，resourceRegen +1.5", stats: { procPower: 0.12, resourceRegen: 1.5 } },
            { title: "回路稳压", description: "resourceMax +10，cdr +4%", stats: { resourceMax: 10, cdr: 0.04 } },
          ];

  const picked = pools[Math.floor(roll * pools.length)];
  return {
    id: `reward-${input.floor}-stat-${Math.floor(roll * 1000)}`,
    category: "stat_bonus",
    title: picked.title,
    description: picked.description,
    effect: {
      stats: picked.stats,
    },
  };
}

function buildSkillUpgradeOption(
  input: GenerateRunRewardsInput,
  skill: SkillDef,
  roll: number,
): RunRewardOption {
  const upgrade = skillUpgradeByArchetype(skill, input.archetype, roll);
  return {
    id: `reward-${input.floor}-skill-${skill.id}`,
    category: "skill_upgrade",
    title: `强化：${skill.name}`,
    description: describeUpgrade(upgrade),
    effect: {
      skillUpgrade: {
        skillId: skill.id,
        upgrade,
      },
    },
  };
}

function buildPassiveOption(
  input: GenerateRunRewardsInput,
  roll: number,
): RunRewardOption {
  const passive =
    input.archetype === "dot"
      ? {
          title: "引爆返能",
          description: "释放 DOT 引爆技能时返还能量并小幅增益引爆倍率。",
          effect: {
            id: "DOT_BURST_REFUND" as const,
            event: "onSkillCast" as const,
            value: 4 + Math.floor(roll * 2),
            value2: 0.1,
            cooldown: 2.4,
          },
        }
      : input.archetype === "crit"
        ? {
            title: "收尾追击",
            description: "终结技能低血暴击后返还能量并缩短全局冷却。",
            effect: {
              id: "CRIT_FINISHER_REFUND" as const,
              event: "onSkillHit" as const,
              value: 10 + Math.floor(roll * 4),
              value2: 1.0,
              cooldown: 3,
            },
          }
        : {
            title: "溢流护持",
            description: "资源溢出时转化护盾并追加一次小触发。",
            effect: {
              id: "ENGINE_OVERFLOW_GUARD" as const,
              event: "onResourceOverflowTick" as const,
              value: 18 + Math.floor(roll * 8),
              value2: 0.24,
              cooldown: 1.1,
            },
          };

  return {
    id: `reward-${input.floor}-passive-${passive.effect.id}`,
    category: "passive_modifier",
    title: passive.title,
    description: passive.description,
    effect: {
      passiveEffect: passive.effect,
    },
  };
}

function pickRelicOption(
  input: GenerateRunRewardsInput,
  roll: number,
): RunRewardOption | undefined {
  if (input.floor % 2 !== 0) {
    return undefined;
  }
  const pool = RELICS.filter(
    (relic) => relic.archetypeBias === input.archetype && !input.progress.relicIds.includes(relic.id),
  );
  if (pool.length === 0) {
    return undefined;
  }
  const relic = pool[Math.floor(roll * pool.length)];
  return {
    id: `reward-${input.floor}-relic-${relic.id}`,
    category: "relic_pick",
    title: `获得遗物祝福：${relic.name}`,
    description: "立即获得该遗物的核心机制与属性加成（本次跑局生效）。",
    effect: {
      relicId: relic.id,
    },
  };
}

function pickSkill(skills: SkillDef[], roll: number): SkillDef {
  if (skills.length === 0) {
    throw new Error("No skill available for reward generation.");
  }
  return skills[Math.floor(roll * skills.length)];
}

function skillUpgradeByArchetype(
  _skill: SkillDef,
  archetype: ArchetypeKey,
  roll: number,
): RunSkillUpgrade {
  if (archetype === "dot") {
    return {
      cooldownReduction: 0.4 + roll * 0.2,
      dotTickBonus: 0.04,
      directRatioBonus: 0.08,
    };
  }
  if (archetype === "crit") {
    return {
      cooldownReduction: 0.3 + roll * 0.2,
      directRatioBonus: 0.12,
      costReduction: 2,
    };
  }
  return {
    cooldownReduction: 0.35 + roll * 0.2,
    procRatioBonus: 0.08,
    costReduction: 3,
  };
}

function describeUpgrade(upgrade: RunSkillUpgrade): string {
  const desc: string[] = [];
  if ((upgrade.cooldownReduction ?? 0) > 0) {
    desc.push(`冷却 -${(upgrade.cooldownReduction ?? 0).toFixed(1)}s`);
  }
  if ((upgrade.costReduction ?? 0) > 0) {
    desc.push(`消耗 -${(upgrade.costReduction ?? 0).toFixed(0)}`);
  }
  if ((upgrade.directRatioBonus ?? 0) > 0) {
    desc.push(`直伤系数 +${(upgrade.directRatioBonus ?? 0).toFixed(2)}`);
  }
  if ((upgrade.dotTickBonus ?? 0) > 0) {
    desc.push(`DOT tick系数 +${(upgrade.dotTickBonus ?? 0).toFixed(2)}`);
  }
  if ((upgrade.procRatioBonus ?? 0) > 0) {
    desc.push(`触发系数 +${(upgrade.procRatioBonus ?? 0).toFixed(2)}`);
  }
  return desc.join("，");
}
