import type {
  BattleInput,
  BattleMetrics,
  CombatEvent,
  DamageEntry,
  EnemyState,
  PassiveEventType,
  SkillDef,
} from "@/core/battle/types";
import { applyDotToEnemy, burstDotDamage, tickDots } from "@/core/battle/effects";
import {
  calcAttackInterval,
  clamp,
  createSeededRng,
  critMultiplier,
  enemyPressureAttackModifier,
  pressureDamageModifier,
  reducedByDefense,
  reducedByResist,
  rollCrit,
  scaleCooldown,
} from "@/core/battle/formulas";
import {
  advancePassiveCooldowns,
  consumeNextProcBonus,
  createPassiveRuntime,
  resolvePassiveActions,
  type PassiveAction,
  type PassiveEventPayload,
  type PassiveRuntime,
} from "@/core/battle/passiveEngine";
import { reduceAllCooldowns, reduceCooldowns, selectReadySkill } from "@/core/battle/skillRunner";
import { mergeDamageEntries, ratio } from "@/core/report/breakdown";
import { ENEMY_ATTACK_INTERVAL, MAX_BATTLE_DURATION, SIMULATION_TICK } from "@/data/constants";

export interface SimulationOutput {
  win: boolean;
  metrics: BattleMetrics;
  combatLog: string[];
  combatEvents: CombatEvent[];
}

interface RuntimeState {
  playerHp: number;
  shield: number;
  resource: number;
  damageTaken: number;
  dotDamage: number;
  procDamage: number;
  starvedTicks: number;
  overflowTicks: number;
  totalTicks: number;
  firstSkillCastAt?: number;
  firstKillTime: number | null;
  nextBasicAt: number;
  nextEnemyAttackAt: number;
}

const MAX_COMBAT_LOG = 220;
const MAX_COMBAT_EVENTS = 420;
const DOT_ROUTE_TUNING = {
  starterSpreadTickMultiplier: 0.75,
  ruptureBonusPerStack: 0.06,
  ruptureBonusCap: 0.24,
  ruptureExecuteThreshold: 0.45,
  ruptureExecuteBonus: 0.12,
  ruptureBurstBonusPerStack: 0.025,
  ruptureBurstBonusCap: 0.12,
  dotCycleRefund: 2,
  dotBurstRefundPerStack: 1.5,
  dotBurstCooldownRelief: 0.45,
  coverageMitigationPerEnemy: 0.03,
  coverageMitigationCap: 0.1,
  killShieldRatio: 0.12,
  killHealRatio: 0.025,
  killResourceRefund: 3,
};

export function runAutoBattle(input: BattleInput): SimulationOutput {
  const loadoutSeed = [
    input.loadout.weapon?.id ?? "none",
    input.loadout.helm?.id ?? "none",
    input.loadout.armor?.id ?? "none",
    input.loadout.ring1?.id ?? "none",
    input.loadout.ring2?.id ?? "none",
    input.loadout.core?.id ?? "none",
  ].join("|");
  const rng = createSeededRng(
    `${input.floor.floor}:${input.archetype}:${input.skills.map((skill) => skill.id).join("|")}:${loadoutSeed}:${input.seedTag ?? "single"}`,
  );
  const passiveRuntime = createPassiveRuntime(input.loadout);
  const enemies: EnemyState[] = Array.from({ length: input.floor.enemyCount }, (_, index) => ({
    id: index + 1,
    hp: input.floor.enemyHp,
    dots: [],
  }));

  const cooldowns = new Map<string, number>();
  for (const skill of input.skills) {
    cooldowns.set(skill.id, 0);
  }

  const damageEntries = new Map<string, DamageEntry>();
  const damageTimeline: number[] = [];
  const combatLog: string[] = [];
  const combatEvents: CombatEvent[] = [];

  const state: RuntimeState = {
    playerHp: input.finalStats.hp,
    shield: 0,
    resource: 0,
    damageTaken: 0,
    dotDamage: 0,
    procDamage: 0,
    starvedTicks: 0,
    overflowTicks: 0,
    totalTicks: 0,
    firstKillTime: null,
    nextBasicAt: 0,
    nextEnemyAttackAt: ENEMY_ATTACK_INTERVAL,
  };

  let time = 0;
  while (time <= MAX_BATTLE_DURATION && state.playerHp > 0 && aliveEnemies(enemies).length > 0) {
    state.totalTicks += 1;
    advancePassiveCooldowns(passiveRuntime, SIMULATION_TICK);

    const resourceBefore = state.resource;
    state.resource += input.finalStats.resourceRegen * SIMULATION_TICK;
    if (state.resource >= input.finalStats.resourceMax) {
      state.overflowTicks += 1;
      state.resource = clamp(state.resource, 0, input.finalStats.resourceMax);
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "RESOURCE_OVERFLOW",
        category: "resource",
        summary: `资源溢出（${state.resource.toFixed(1)}）`,
      });
      applyPassiveActions({
        actions: resolvePassive(passiveRuntime, "onResourceOverflowTick", { now: time, playerResourceRatio: 1 }, rng),
        passiveRuntime,
        input,
        enemies,
        damageEntries,
        damageTimeline,
        onProcDamage: (value) => {
          state.procDamage += value;
        },
        onGrantResource: (value, sourceName) => {
          state.resource = clamp(state.resource + value, 0, input.finalStats.resourceMax);
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "RESOURCE_GAIN",
            category: "resource",
            summary: `${sourceName ?? "效果"} 回能 ${value.toFixed(1)}`,
          });
        },
        onShieldGain: (value, sourceName) => {
          state.shield = Math.max(0, state.shield + value);
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "SHIELD_GAIN",
            category: "defense",
            summary: `${sourceName ?? "效果"} 护盾 +${Math.round(value)}`,
          });
        },
        onReduceAllCooldowns: (value) => reduceAllCooldowns(cooldowns, value),
        onFirstKill: (killAt) => {
          if (state.firstKillTime === null) {
            state.firstKillTime = killAt;
          }
        },
        onCombatEvent: (event) => pushCombatEvent(combatEvents, combatLog, event),
        time,
      });
    } else {
      state.resource = clamp(state.resource, 0, input.finalStats.resourceMax);
    }

    if (shouldLogPerSecond(time) && state.resource > resourceBefore) {
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "RESOURCE_GAIN",
        category: "resource",
        summary: `自然回能 ${input.finalStats.resourceRegen.toFixed(1)}/s`,
      });
    }

    state.playerHp = Math.min(input.finalStats.hp, state.playerHp + input.finalStats.regen * SIMULATION_TICK);
    reduceCooldowns(cooldowns, SIMULATION_TICK);

    for (const enemy of aliveEnemies(enemies)) {
      tickDots(enemy, time, (dot, damage) => {
        const dealt = applyDamage(enemy, damage);
        if (dealt <= 0) {
          return;
        }
        state.dotDamage += dealt;
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: dot.sourceId, sourceName: dot.sourceName, category: "dot", total: 0 },
          dealt,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_TICK",
          category: "offense",
          summary: `${dot.name} 跳伤 ${Math.round(dealt)}（敌${enemy.id}）`,
          sourceId: dot.sourceId,
          sourceName: dot.sourceName,
        });
        if (enemy.hp <= 0) {
          if (state.firstKillTime === null) {
            state.firstKillTime = time;
          }
          const hadDotsOnKill = getDotStacks(enemy) > 0;
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "ENEMY_KILL",
            category: "offense",
            summary: `敌人 ${enemy.id} 被 ${dot.name} 击败`,
          });
          if (hadDotsOnKill) {
            applyDotKillStabilizer({
              input,
              gainResource: (value, sourceName) => {
                state.resource = clamp(state.resource + value, 0, input.finalStats.resourceMax);
                pushCombatEvent(combatEvents, combatLog, {
                  time,
                  type: "RESOURCE_GAIN",
                  category: "resource",
                  summary: `${sourceName} 回能 ${value.toFixed(1)}`,
                });
              },
              gainShield: (value, sourceName) => {
                state.shield = Math.max(0, state.shield + value);
                pushCombatEvent(combatEvents, combatLog, {
                  time,
                  type: "SHIELD_GAIN",
                  category: "defense",
                  summary: `${sourceName} 护盾 +${Math.round(value)}`,
                });
              },
              healPlayer: (value, sourceName) => {
                const prev = state.playerHp;
                state.playerHp = Math.min(input.finalStats.hp, state.playerHp + value);
                const heal = Math.max(0, state.playerHp - prev);
                if (heal > 0) {
                  pushCombatEvent(combatEvents, combatLog, {
                    time,
                    type: "HEAL_GAIN",
                    category: "defense",
                    summary: `${sourceName} 治疗 ${Math.round(heal)}`,
                  });
                }
              },
              reduceAllCooldownsBy: (value) => reduceAllCooldowns(cooldowns, value),
            });
          }
        }
      });
    }

    const living = aliveEnemies(enemies);
    const primaryTarget = living[0];
    const selection = selectReadySkill(input.skills, cooldowns, {
      archetype: input.archetype,
      elapsedTime: time,
      resource: state.resource,
      resourceMax: input.finalStats.resourceMax,
      playerHpRatio: clamp(state.playerHp / input.finalStats.hp, 0, 1),
      targetHpRatio: primaryTarget ? clamp(primaryTarget.hp / input.floor.enemyHp, 0, 1) : 1,
      targetDotStacks: primaryTarget ? getDotStacks(primaryTarget) : 0,
      enemyCount: living.length,
      resourceStarvedRate: state.totalTicks > 0 ? state.starvedTicks / state.totalTicks : 0,
      resourceOverflowRate: state.totalTicks > 0 ? state.overflowTicks / state.totalTicks : 0,
    });

    if (selection) {
      const skill = input.skills[selection.index];
      if (state.resource < skill.cost) {
        state.starvedTicks += 1;
      } else {
        if (selection.readyCount > 1 && selection.reasons.length > 0) {
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "SKILL_DECISION",
            category: "system",
            summary: `技能决策：${skill.name}（${selection.reasons.join("，")}）`,
          });
        }
        if (state.firstSkillCastAt === undefined) {
          state.firstSkillCastAt = time;
        }
        castSkill({
          input,
          skill,
          enemies,
          damageEntries,
          damageTimeline,
          combatLog,
          combatEvents,
          time,
          rng,
          passiveRuntime,
          currentResource: state.resource,
          onProcDamage: (value) => {
            state.procDamage += value;
          },
          consumeResource: (value) => {
            state.resource = clamp(state.resource - value, 0, input.finalStats.resourceMax);
            pushCombatEvent(combatEvents, combatLog, {
              time,
              type: "RESOURCE_SPEND",
              category: "resource",
              summary: `${skill.name} 消耗资源 ${Math.round(value)}`,
            });
          },
          gainResource: (value, sourceName) => {
            state.resource = clamp(state.resource + value, 0, input.finalStats.resourceMax);
            pushCombatEvent(combatEvents, combatLog, {
              time,
              type: "RESOURCE_GAIN",
              category: "resource",
              summary: `${sourceName ?? skill.name} 回能 ${value.toFixed(1)}`,
            });
          },
          setShield: (value, sourceName) => {
            const prev = state.shield;
            state.shield = Math.max(0, value);
            const gain = Math.max(0, state.shield - prev);
            if (gain > 0) {
              pushCombatEvent(combatEvents, combatLog, {
                time,
                type: "SHIELD_GAIN",
                category: "defense",
                summary: `${sourceName ?? skill.name} 护盾 +${Math.round(gain)}`,
              });
            }
          },
          setPlayerHp: (value, sourceName) => {
            const prev = state.playerHp;
            state.playerHp = clamp(value, 0, input.finalStats.hp);
            const heal = Math.max(0, state.playerHp - prev);
            if (heal > 0) {
              pushCombatEvent(combatEvents, combatLog, {
                time,
                type: "HEAL_GAIN",
                category: "defense",
                summary: `${sourceName ?? skill.name} 治疗 ${Math.round(heal)}`,
              });
            }
          },
          getShield: () => state.shield,
          getPlayerHp: () => state.playerHp,
          setCooldown: (skillId, value) => cooldowns.set(skillId, value),
          reduceAllCooldownsBy: (value) => reduceAllCooldowns(cooldowns, value),
          onFirstKill: (killAt) => {
            if (state.firstKillTime === null) {
              state.firstKillTime = killAt;
            }
          },
        });
      }
    }

    if (time >= state.nextBasicAt && aliveEnemies(enemies).length > 0) {
      const target = aliveEnemies(enemies)[0];
      const base = input.finalStats.atk * pressureDamageModifier("direct", input.floor.pressure);
      const crit = rollCrit(input.finalStats.crit, rng);
      const critApplied = crit ? base * critMultiplier(input.finalStats.critDamage) : base;
      const dealt = applyDamage(target, reducedByResist(reducedByDefense(critApplied, input.floor.enemyDef), input.floor.enemyResist));
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: "basic_attack", sourceName: "基础攻击", category: "direct", total: 0 },
          dealt,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "BASIC_ATTACK",
          category: "offense",
          summary: `基础攻击 ${Math.round(dealt)}${crit ? "（暴击）" : ""}`,
        });
      }
      const gain = 8 + (input.archetype === "engine" ? 1 : 0);
      state.resource = clamp(state.resource + gain, 0, input.finalStats.resourceMax);
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "RESOURCE_GAIN",
        category: "resource",
        summary: `普攻回能 ${gain}`,
      });
      state.nextBasicAt = time + calcAttackInterval(input.finalStats.speed);
      if (dealt > 0 && target.hp <= 0) {
        if (state.firstKillTime === null) {
          state.firstKillTime = time;
        }
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "ENEMY_KILL",
          category: "offense",
          summary: `敌人 ${target.id} 被基础攻击击败`,
        });
      }
    }

    while (time >= state.nextEnemyAttackAt && aliveEnemies(enemies).length > 0) {
      const livingEnemies = aliveEnemies(enemies);
      const incomingRaw =
        livingEnemies.length *
        input.floor.enemyAtk *
        enemyPressureAttackModifier(input.floor.pressure);
      const reduced = reducedByResist(
        reducedByDefense(incomingRaw, input.finalStats.def),
        input.finalStats.resist,
      );
      const mitigationRatio = computeDotCoverageMitigation(input.archetype, livingEnemies);
      const incomingAfterMitigation = reduced * (1 - mitigationRatio);
      const prevShield = state.shield;
      const afterShield = Math.max(0, incomingAfterMitigation - state.shield);
      state.shield = Math.max(0, state.shield - incomingAfterMitigation);
      if (prevShield > state.shield) {
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "SHIELD_LOSS",
          category: "defense",
          summary: `护盾吸收 ${Math.round(prevShield - state.shield)}`,
        });
      }
      state.playerHp = Math.max(0, state.playerHp - afterShield);
      state.damageTaken += afterShield;
      const heavy = afterShield >= input.finalStats.hp * 0.18;
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: heavy ? "ENEMY_HEAVY_HIT" : "ENEMY_HIT",
        category: heavy ? "danger" : "defense",
        summary:
          mitigationRatio > 0
            ? `敌方攻击造成 ${Math.round(afterShield)} 伤害（DOT压制减伤 ${Math.round(mitigationRatio * 100)}%）`
            : `敌方攻击造成 ${Math.round(afterShield)} 伤害`,
      });
      const cadence = input.floor.pressure === "swarm" ? ENEMY_ATTACK_INTERVAL / 1.08 : ENEMY_ATTACK_INTERVAL;
      state.nextEnemyAttackAt += cadence;
    }

    time += SIMULATION_TICK;
  }

  const duration = Math.min(MAX_BATTLE_DURATION, Math.max(SIMULATION_TICK, time));
  const merged = mergeDamageEntries([...damageEntries.values()]);
  const totalDamage = merged.reduce((sum, entry) => sum + entry.total, 0);
  const basicDamage = merged.filter((entry) => entry.sourceId === "basic_attack").reduce((sum, entry) => sum + entry.total, 0);
  const coreTriggerDamage = merged
    .filter((entry) => entry.sourceId.startsWith("trigger:") || entry.sourceId.startsWith("core_"))
    .reduce((sum, entry) => sum + entry.total, 0);
  const skillDamage = Math.max(0, totalDamage - basicDamage - coreTriggerDamage);
  const directDamage = merged.filter((entry) => entry.category === "direct").reduce((sum, entry) => sum + entry.total, 0);
  const remainingEnemyHp = aliveEnemies(enemies).reduce((sum, enemy) => sum + enemy.hp, 0);
  const totalEnemyHp = input.floor.enemyHp * input.floor.enemyCount;

  const win = aliveEnemies(enemies).length === 0 && state.playerHp > 0;
  const basicRatio = ratio(basicDamage, totalDamage);
  const skillRatio = ratio(skillDamage, totalDamage);
  const coreTriggerRatio = ratio(coreTriggerDamage, totalDamage);
  const dotRatio = ratio(state.dotDamage, totalDamage);
  const procRatio = ratio(state.procDamage, totalDamage);
  const directRatio = ratio(directDamage, totalDamage);

  const metrics: BattleMetrics = {
    duration,
    totalDamage,
    damageTaken: state.damageTaken,
    remainingHp: Math.max(0, state.playerHp),
    burstDps: computeBurstDps(damageTimeline, 3),
    sustainDps: totalDamage / duration,
    startupTime: state.firstSkillCastAt ?? duration,
    resourceStarvedRate: state.totalTicks > 0 ? state.starvedTicks / state.totalTicks : 0,
    resourceOverflowRate: state.totalTicks > 0 ? state.overflowTicks / state.totalTicks : 0,
    dotDamage: state.dotDamage,
    procDamage: state.procDamage,
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
    firstKillTime: state.firstKillTime,
    enemyRemainingHpRatio: win ? 0 : clamp(remainingEnemyHp / Math.max(1, totalEnemyHp), 0, 1),
    damageBySource: merged,
  };

  if (!win && duration >= MAX_BATTLE_DURATION) {
    pushCombatEvent(combatEvents, combatLog, { time: duration, type: "BATTLE_END", category: "danger", summary: "战斗超时" });
  }
  if (!win && state.playerHp <= 0) {
    pushCombatEvent(combatEvents, combatLog, { time: duration, type: "PLAYER_DEATH", category: "danger", summary: "角色被击败" });
  }
  if (win) {
    pushCombatEvent(combatEvents, combatLog, { time: duration, type: "BATTLE_END", category: "system", summary: "战斗通关" });
  }

  return { win, metrics, combatLog, combatEvents };
}
interface CastSkillArgs {
  input: BattleInput;
  skill: SkillDef;
  enemies: EnemyState[];
  damageEntries: Map<string, DamageEntry>;
  damageTimeline: number[];
  combatLog: string[];
  combatEvents: CombatEvent[];
  time: number;
  rng: ReturnType<typeof createSeededRng>;
  passiveRuntime: PassiveRuntime;
  currentResource: number;
  onProcDamage: (value: number) => void;
  consumeResource: (value: number) => void;
  gainResource: (value: number, sourceName?: string) => void;
  setShield: (value: number, sourceName?: string) => void;
  setPlayerHp: (value: number, sourceName?: string) => void;
  getShield: () => number;
  getPlayerHp: () => number;
  setCooldown: (skillId: string, value: number) => void;
  reduceAllCooldownsBy: (value: number) => void;
  onFirstKill: (time: number) => void;
}

function castSkill(args: CastSkillArgs): void {
  const {
    input,
    skill,
    enemies,
    damageEntries,
    damageTimeline,
    combatLog,
    combatEvents,
    time,
    rng,
    passiveRuntime,
    currentResource,
    onProcDamage,
    consumeResource,
    gainResource,
    setShield,
    setPlayerHp,
    getShield,
    getPlayerHp,
    setCooldown,
    reduceAllCooldownsBy,
    onFirstKill,
  } = args;

  consumeResource(skill.cost);
  pushCombatEvent(combatEvents, combatLog, {
    time,
    type: "SKILL_CAST",
    category: "offense",
    summary: `释放技能：${skill.name}`,
    sourceId: skill.id,
    sourceName: skill.name,
  });

  const playerResourceRatio = clamp(currentResource / Math.max(1, input.finalStats.resourceMax), 0, 1);
  const targets = skill.tags.includes("aoe") ? aliveEnemies(enemies) : aliveEnemies(enemies).slice(0, 1);
  const pressureDirect = pressureDamageModifier("direct", input.floor.pressure);

  const castActions = resolvePassive(
    passiveRuntime,
    "onSkillCast",
    {
      now: time,
      skill,
      resourceSpent: skill.cost,
      targetHpRatio: targets[0] ? clamp(targets[0].hp / input.floor.enemyHp, 0, 1) : 1,
      targetDotStacks: targets[0] ? getDotStacks(targets[0]) : 0,
      playerResourceRatio,
    },
    rng,
  );

  const castOutcome = applyPassiveActions({
    actions: castActions,
    passiveRuntime,
    input,
    enemies,
    damageEntries,
    damageTimeline,
    onProcDamage,
    onGrantResource: gainResource,
    onShieldGain: (value, sourceName) => setShield(getShield() + value, sourceName),
    onReduceAllCooldowns: reduceAllCooldownsBy,
    onFirstKill,
    onCombatEvent: (event) => pushCombatEvent(combatEvents, combatLog, event),
    time,
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
      let raw = input.finalStats.atk * perHitRatio * (1 + input.finalStats.skillPower) * pressureDirect;
      const targetDotStacksBeforeHit = getDotStacks(target);
      const critChance = input.finalStats.crit + (skill.critBonus ?? 0);
      const didCrit = rollCrit(critChance, rng);
      if (didCrit) {
        raw *= critMultiplier(input.finalStats.critDamage);
      }
      if (skill.id === "rupture_bloom" && targetDotStacksBeforeHit > 0) {
        const stackBonus = Math.min(
          DOT_ROUTE_TUNING.ruptureBonusCap,
          targetDotStacksBeforeHit * DOT_ROUTE_TUNING.ruptureBonusPerStack,
        );
        raw *= 1 + stackBonus;
        if (target.hp <= input.floor.enemyHp * DOT_ROUTE_TUNING.ruptureExecuteThreshold) {
          raw *= 1 + DOT_ROUTE_TUNING.ruptureExecuteBonus;
        }
      }
      const executeBonus = input.loadout.core?.mechanicModifiers?.executeBonus ?? 0;
      if (executeBonus > 0 && target.hp <= input.floor.enemyHp * 0.3 && skill.tags.includes("finisher")) {
        raw *= 1 + executeBonus;
      }

      const dealt = applyDamage(target, reducedByResist(reducedByDefense(raw, input.floor.enemyDef), input.floor.enemyResist));
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "direct", total: 0 },
          dealt,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "SKILL_CAST",
          category: "offense",
          summary: `${skill.name} 命中 ${Math.round(dealt)}${didCrit ? "（暴击）" : ""}`,
        });
      }

      const hitActions = resolvePassive(
        passiveRuntime,
        "onSkillHit",
        {
          now: time,
          skill,
          targetHpRatio: clamp(target.hp / input.floor.enemyHp, 0, 1),
          targetDotStacks: getDotStacks(target),
          didCrit,
          playerResourceRatio,
        },
        rng,
      );
      applyPassiveActions({
        actions: hitActions,
        passiveRuntime,
        input,
        enemies,
        damageEntries,
        damageTimeline,
        onProcDamage,
        onGrantResource: gainResource,
        onShieldGain: (value, sourceName) => setShield(getShield() + value, sourceName),
        onReduceAllCooldowns: reduceAllCooldownsBy,
        onFirstKill,
        onCombatEvent: (event) => pushCombatEvent(combatEvents, combatLog, event),
        time,
      });

      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "ENEMY_KILL",
          category: "offense",
          summary: `敌人 ${target.id} 被 ${skill.name} 击败`,
        });
        if (targetDotStacksBeforeHit > 0) {
          applyDotKillStabilizer({
            input,
            gainResource,
            gainShield: (value, sourceName) => setShield(getShield() + value, sourceName),
            healPlayer: (value, sourceName) => setPlayerHp(getPlayerHp() + value, sourceName),
            reduceAllCooldownsBy,
          });
        }
      }
    }
  }

  if (skill.dot) {
    const extraStacks = input.loadout.core?.mechanicModifiers?.extraDotStacks ?? 0;
    const targetsForDot = skill.tags.includes("aoe") ? aliveEnemies(enemies) : aliveEnemies(enemies).slice(0, 1);
    const rawDot = input.finalStats.atk * skill.dot.tickRatio * (1 + input.finalStats.dotPower);
    const adjusted = reducedByResist(
      reducedByDefense(rawDot * pressureDamageModifier("dot", input.floor.pressure), input.floor.enemyDef),
      input.floor.enemyResist,
    );
    for (const target of targetsForDot) {
      applyDotToEnemy({ enemy: target, skill, now: time, damagePerTick: adjusted, extraStacks });
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "DOT_APPLY",
        category: "offense",
        summary: `${skill.name} 施加 DOT（敌${target.id}）`,
      });
    }
    if (input.archetype === "dot" && skill.tags.includes("starter") && !skill.tags.includes("aoe")) {
      const spreadTarget = selectSpreadTarget(enemies, targetsForDot[0]?.id);
      if (spreadTarget) {
        applyDotToEnemy({
          enemy: spreadTarget,
          skill,
          now: time,
          damagePerTick: adjusted * DOT_ROUTE_TUNING.starterSpreadTickMultiplier,
          extraStacks: Math.max(0, extraStacks - 1),
        });
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_APPLY",
          category: "offense",
          summary: `${skill.name} 扩散 DOT（敌${spreadTarget.id}）`,
        });
      }
    }
    if (input.archetype === "dot") {
      gainResource(DOT_ROUTE_TUNING.dotCycleRefund, "DOT循环回能");
    }
  }

  if ((skill.burstDotPercent ?? 0) > 0) {
    const target =
      skill.id === "rupture_bloom"
        ? selectRuptureTarget(enemies, input.floor.enemyHp)
        : aliveEnemies(enemies)[0];
    if (target) {
      const burstBonus = input.loadout.core?.mechanicModifiers?.dotBurstBonus ?? 0;
      const targetDotStacks = getDotStacks(target);
      const ruptureBurstBonus =
        skill.id === "rupture_bloom"
          ? Math.min(
              DOT_ROUTE_TUNING.ruptureBurstBonusCap,
              targetDotStacks * DOT_ROUTE_TUNING.ruptureBurstBonusPerStack,
            )
          : 0;
      const burstPercent =
        (skill.burstDotPercent ?? 0) *
        (1 + burstBonus + castOutcome.dotBurstMultiplierBonus + ruptureBurstBonus);
      const burst = burstDotDamage(target, burstPercent);
      if (burst > 0) {
        const dealt = applyDamage(target, burst);
        registerDamage(damageEntries, damageTimeline, time, { sourceId: skill.id, sourceName: skill.name, category: "dot", total: 0 }, dealt);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_BURST",
          category: "offense",
          summary: `${skill.name} 引爆 DOT ${Math.round(dealt)}`,
        });
        if (input.archetype === "dot" && skill.id === "rupture_bloom" && targetDotStacks > 0) {
          const refund = targetDotStacks * DOT_ROUTE_TUNING.dotBurstRefundPerStack;
          gainResource(refund, "裂蚀转化回能");
          reduceAllCooldownsBy(DOT_ROUTE_TUNING.dotBurstCooldownRelief);
        }
      }
      if (target.hp <= 0 && targetDotStacks > 0) {
        onFirstKill(time);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "ENEMY_KILL",
          category: "offense",
          summary: `敌人 ${target.id} 被 ${skill.name} 引爆击败`,
        });
        applyDotKillStabilizer({
          input,
          gainResource,
          gainShield: (value, sourceName) => setShield(getShield() + value, sourceName),
          healPlayer: (value, sourceName) => setPlayerHp(getPlayerHp() + value, sourceName),
          reduceAllCooldownsBy,
        });
      }
    }
  }

  if ((skill.procRatio ?? 0) > 0) {
    const target = aliveEnemies(enemies)[0];
    if (target) {
      const procRatio = (skill.procRatio ?? 0) + consumeNextProcBonus(passiveRuntime);
      const raw = input.finalStats.atk * procRatio * (1 + input.finalStats.procPower);
      const dealt = applyDamage(
        target,
        reducedByResist(reducedByDefense(raw * pressureDamageModifier("proc", input.floor.pressure), input.floor.enemyDef), input.floor.enemyResist),
      );
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(damageEntries, damageTimeline, time, { sourceId: skill.id, sourceName: skill.name, category: "proc", total: 0 }, dealt);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${skill.name} 触发 ${Math.round(dealt)}`,
        });
      }
    }
  }

  if (input.loadout.core?.mechanicModifiers?.procTriggerOnSpend && skill.cost > 0) {
    const target = aliveEnemies(enemies)[0];
    if (target) {
      const procRatio = 0.3 + consumeNextProcBonus(passiveRuntime);
      const raw = input.finalStats.atk * procRatio * (1 + input.finalStats.procPower);
      const dealt = applyDamage(
        target,
        reducedByResist(reducedByDefense(raw * pressureDamageModifier("proc", input.floor.pressure), input.floor.enemyDef), input.floor.enemyResist),
      );
      if (dealt > 0 && input.loadout.core) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: input.loadout.core.id, sourceName: `${input.loadout.core.name}触发`, category: "proc", total: 0 },
          dealt,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${input.loadout.core.name} 触发 ${Math.round(dealt)}`,
        });
      }
    }
  }

  if ((skill.shieldRatio ?? 0) > 0) {
    const shieldGain = input.finalStats.atk * (skill.shieldRatio ?? 0) * (1 + input.finalStats.shieldPower);
    setShield(getShield() + shieldGain, skill.name);
  }
  if ((skill.healRatio ?? 0) > 0) {
    const healGain = input.finalStats.atk * (skill.healRatio ?? 0) * (1 + input.finalStats.skillPower * 0.6);
    setPlayerHp(getPlayerHp() + healGain, skill.name);
  }
  if (skill.tags.includes("cycle")) {
    gainResource(5, skill.name);
  }
  if ((input.loadout.core?.mechanicModifiers?.resourceRefundBonus ?? 0) > 0) {
    gainResource(skill.cost * (input.loadout.core?.mechanicModifiers?.resourceRefundBonus ?? 0), input.loadout.core?.name);
  }

  setCooldown(skill.id, scaleCooldown(skill.cooldown, input.finalStats.cdr));
}
interface ApplyPassiveActionsArgs {
  actions: PassiveAction[];
  passiveRuntime: PassiveRuntime;
  input: BattleInput;
  enemies: EnemyState[];
  damageEntries: Map<string, DamageEntry>;
  damageTimeline: number[];
  onProcDamage: (value: number) => void;
  onGrantResource: (value: number, sourceName?: string) => void;
  onShieldGain: (value: number, sourceName?: string) => void;
  onReduceAllCooldowns: (value: number) => void;
  onFirstKill: (time: number) => void;
  onCombatEvent: (event: CombatEvent) => void;
  time: number;
}

interface PassiveActionOutcome {
  dotBurstMultiplierBonus: number;
}

function applyPassiveActions(args: ApplyPassiveActionsArgs): PassiveActionOutcome {
  const {
    actions,
    passiveRuntime,
    input,
    enemies,
    damageEntries,
    damageTimeline,
    onProcDamage,
    onGrantResource,
    onShieldGain,
    onReduceAllCooldowns,
    onFirstKill,
    onCombatEvent,
    time,
  } = args;
  let dotBurstMultiplierBonus = 0;

  for (const action of actions) {
    if ((action.grantResource ?? 0) > 0) {
      onGrantResource(action.grantResource ?? 0, action.sourceName);
    }
    if ((action.addShield ?? 0) > 0) {
      onShieldGain(action.addShield ?? 0, action.sourceName);
    }
    if ((action.reduceAllCooldowns ?? 0) > 0) {
      onReduceAllCooldowns(action.reduceAllCooldowns ?? 0);
    }
    if ((action.dotBurstMultiplierBonus ?? 0) > 0) {
      dotBurstMultiplierBonus += action.dotBurstMultiplierBonus ?? 0;
    }
    if ((action.setNextProcBonusRatio ?? 0) > 0) {
      passiveRuntime.nextProcBonusRatio = Math.min(1.5, passiveRuntime.nextProcBonusRatio + (action.setNextProcBonusRatio ?? 0));
    }
    if ((action.bonusProcRatio ?? 0) > 0) {
      const target = aliveEnemies(enemies)[0];
      if (!target) {
        continue;
      }
      const procRatio = (action.bonusProcRatio ?? 0) + consumeNextProcBonus(passiveRuntime);
      const raw = input.finalStats.atk * procRatio * (1 + input.finalStats.procPower);
      const dealt = applyDamage(
        target,
        reducedByResist(reducedByDefense(raw * pressureDamageModifier("proc", input.floor.pressure), input.floor.enemyDef), input.floor.enemyResist),
      );
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: `trigger:${action.sourceId}`, sourceName: `${action.sourceName}触发`, category: "proc", total: 0 },
          dealt,
        );
        onCombatEvent({
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${action.sourceName} 触发 ${Math.round(dealt)}`,
          sourceId: action.sourceId,
          sourceName: action.sourceName,
        });
      }
      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
      }
    }
  }

  return { dotBurstMultiplierBonus };
}

function resolvePassive(
  runtime: PassiveRuntime,
  event: PassiveEventType,
  payload: PassiveEventPayload,
  rng: ReturnType<typeof createSeededRng>,
): PassiveAction[] {
  return resolvePassiveActions(runtime, event, payload, rng);
}

function registerDamage(
  board: Map<string, DamageEntry>,
  timeline: number[],
  time: number,
  source: DamageEntry,
  dealt: number,
): void {
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

function applyDamage(enemy: EnemyState, amount: number): number {
  if (enemy.hp <= 0 || amount <= 0) {
    return 0;
  }
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= dealt;
  return dealt;
}

function aliveEnemies(enemies: EnemyState[]): EnemyState[] {
  return enemies.filter((enemy) => enemy.hp > 0);
}

function getDotStacks(enemy: EnemyState): number {
  return enemy.dots.reduce((sum, dot) => sum + dot.stacks, 0);
}

function computeDotCoverageMitigation(archetype: BattleInput["archetype"], enemies: EnemyState[]): number {
  if (archetype !== "dot") {
    return 0;
  }
  const covered = enemies.filter((enemy) => enemy.hp > 0 && getDotStacks(enemy) > 0).length;
  if (covered <= 0) {
    return 0;
  }
  return Math.min(
    DOT_ROUTE_TUNING.coverageMitigationCap,
    covered * DOT_ROUTE_TUNING.coverageMitigationPerEnemy,
  );
}

function selectSpreadTarget(enemies: EnemyState[], skipId?: number): EnemyState | undefined {
  const candidates = enemies
    .filter((enemy) => enemy.hp > 0 && enemy.id !== skipId)
    .sort((left, right) => {
      const leftStacks = getDotStacks(left);
      const rightStacks = getDotStacks(right);
      if (leftStacks !== rightStacks) {
        return leftStacks - rightStacks;
      }
      if (left.hp !== right.hp) {
        return right.hp - left.hp;
      }
      return left.id - right.id;
    });
  return candidates[0];
}

function selectRuptureTarget(enemies: EnemyState[], floorEnemyHp: number): EnemyState | undefined {
  const living = enemies.filter((enemy) => enemy.hp > 0);
  if (living.length === 0) {
    return undefined;
  }
  return [...living].sort((left, right) => {
    const leftStacks = getDotStacks(left);
    const rightStacks = getDotStacks(right);
    if (leftStacks !== rightStacks) {
      return rightStacks - leftStacks;
    }
    const leftRatio = left.hp / Math.max(1, floorEnemyHp);
    const rightRatio = right.hp / Math.max(1, floorEnemyHp);
    if (leftRatio !== rightRatio) {
      return leftRatio - rightRatio;
    }
    return left.id - right.id;
  })[0];
}

interface DotKillStabilizerInput {
  input: BattleInput;
  gainResource: (value: number, sourceName: string) => void;
  gainShield: (value: number, sourceName: string) => void;
  healPlayer: (value: number, sourceName: string) => void;
  reduceAllCooldownsBy: (value: number) => void;
}

function applyDotKillStabilizer(args: DotKillStabilizerInput): void {
  const { input, gainResource, gainShield, healPlayer, reduceAllCooldownsBy } = args;
  if (input.archetype !== "dot") {
    return;
  }
  gainResource(DOT_ROUTE_TUNING.killResourceRefund, "毒蚀收割");
  gainShield(input.finalStats.atk * DOT_ROUTE_TUNING.killShieldRatio, "毒蚀收割");
  healPlayer(input.finalStats.hp * DOT_ROUTE_TUNING.killHealRatio, "毒蚀收割");
  reduceAllCooldownsBy(0.25);
}

function pushCombatEvent(events: CombatEvent[], logs: string[], event: CombatEvent): void {
  if (events.length < MAX_COMBAT_EVENTS) {
    events.push({ ...event, time: roundTime(event.time) });
  }
  if (logs.length < MAX_COMBAT_LOG) {
    logs.push(`[${roundTime(event.time).toFixed(1)}] ${event.summary}`);
  }
}

function roundTime(value: number): number {
  return Math.round(value * 10) / 10;
}

function shouldLogPerSecond(time: number): boolean {
  const rounded = Math.round(time * 10);
  return rounded % 10 === 0;
}

function computeBurstDps(timeline: number[], windowSeconds: number): number {
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
