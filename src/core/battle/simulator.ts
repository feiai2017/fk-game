import type {
  BattleInput,
  BattleMetrics,
  CombatEvent,
  CombatSnapshot,
  DamageEntry,
  EnemyState,
  PassiveEffectId,
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
  combatSnapshots: CombatSnapshot[];
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
}

interface DotFlowState {
  keyStackThreshold: number;
  keyStackTargets: Set<number>;
  loopReadyAnnounced: boolean;
  burstWindowAnnounced: boolean;
}

interface DamagePoint {
  time: number;
  amount: number;
}

interface EnemyTraitRuntime {
  nextCleanseAt: number;
}

const MAX_COMBAT_LOG = 220;
const MAX_COMBAT_EVENTS = 420;
const MAX_COMBAT_SNAPSHOTS = 260;
const SNAPSHOT_INTERVAL_SECONDS = 0.5;
const SNAPSHOT_RECENT_WINDOW_SECONDS = 2;
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

const ENEMY_TRAIT_TUNING = {
  antiDotCleanseInterval: 8.5,
  antiDotCleanseKeepRatio: 0.5,
  bossHalfHpThreshold: 0.5,
  bossRageAtkMultiplier: 1.22,
  bossRageSpeedMultiplier: 1.12,
};

const DOT_FLOW_TUNING = {
  keyStackThreshold: 4,
  loopReadyCoverage: 2,
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
  const enemies = buildEnemiesForFloor(input);
  const enemyTraitRuntime = buildEnemyTraitRuntime(enemies);
  const dotFlowState: DotFlowState = {
    keyStackThreshold: DOT_FLOW_TUNING.keyStackThreshold,
    keyStackTargets: new Set<number>(),
    loopReadyAnnounced: false,
    burstWindowAnnounced: false,
  };
  const totalEnemyHpPool = Math.max(
    1,
    enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0),
  );

  const cooldowns = new Map<string, number>();
  for (const skill of input.skills) {
    cooldowns.set(skill.id, 0);
  }

  const damageEntries = new Map<string, DamageEntry>();
  const damageTimeline: number[] = [];
  const combatLog: string[] = [];
  const combatEvents: CombatEvent[] = [];
  const combatSnapshots: CombatSnapshot[] = [];
  const outgoingDamagePoints: DamagePoint[] = [];
  const incomingDamagePoints: DamagePoint[] = [];
  let nextSnapshotAt = 0;

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
  };

  captureSnapshot({
    snapshots: combatSnapshots,
    time: 0,
    state,
    enemies,
    totalEnemyHp: totalEnemyHpPool,
    outgoingDamagePoints,
    incomingDamagePoints,
  });
  nextSnapshotAt = SNAPSHOT_INTERVAL_SECONDS;

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
        amount: state.resource,
        tags: ["overflow"],
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
            amount: value,
            sourceName,
            tags: ["passive", "resource"],
          });
        },
        onShieldGain: (value, sourceName) => {
          state.shield = Math.max(0, state.shield + value);
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "SHIELD_GAIN",
            category: "defense",
            summary: `${sourceName ?? "效果"} 护盾 +${Math.round(value)}`,
            amount: value,
            sourceName,
            tags: ["shield"],
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
        outgoingDamagePoints,
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
        amount: input.finalStats.resourceRegen * SIMULATION_TICK,
        sourceName: "自然回复",
        tags: ["regen"],
      });
    }

    state.playerHp = Math.min(input.finalStats.hp, state.playerHp + input.finalStats.regen * SIMULATION_TICK);
    reduceCooldowns(cooldowns, SIMULATION_TICK);

    resolveEnemyTraitMechanics({
      input,
      time,
      enemies,
      traitRuntime: enemyTraitRuntime,
      combatEvents,
      combatLog,
    });

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
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_TICK",
          category: "offense",
          summary: `${dot.name} 跳伤 ${Math.round(dealt)}（敌${enemy.id}）`,
          amount: dealt,
          sourceId: dot.sourceId,
          sourceName: dot.sourceName,
          targetId: enemy.id,
          targetName: `敌人${enemy.id}`,
          tags: ["dot", "tick"],
        });
        if (enemy.hp <= 0) {
          if (state.firstKillTime === null) {
            state.firstKillTime = time;
          }
          const hadDotsOnKill = getDotStacks(enemy) > 0;
          const killSummary = hadDotsOnKill
            ? `毒蚀收割：敌人 ${enemy.id} 倒下`
            : `敌人 ${enemy.id} 被 ${dot.name} 击败`;
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: "ENEMY_KILL",
            category: "offense",
            summary: killSummary,
            sourceId: dot.sourceId,
            sourceName: dot.sourceName,
            targetId: enemy.id,
            targetName: `敌人${enemy.id}`,
            tags: hadDotsOnKill ? ["kill", "dot", "harvest"] : ["kill", "dot"],
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
                  amount: value,
                  sourceName,
                  tags: ["kill", "resource"],
                });
              },
              gainShield: (value, sourceName) => {
                state.shield = Math.max(0, state.shield + value);
                pushCombatEvent(combatEvents, combatLog, {
                  time,
                  type: "SHIELD_GAIN",
                  category: "defense",
                  summary: `${sourceName} 护盾 +${Math.round(value)}`,
                  amount: value,
                  sourceName,
                  tags: ["kill", "shield"],
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
                    amount: heal,
                    sourceName,
                    tags: ["kill", "heal"],
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
      targetHpRatio: primaryTarget ? clamp(primaryTarget.hp / primaryTarget.maxHp, 0, 1) : 1,
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
            sourceId: skill.id,
            sourceName: skill.name,
            tags: ["decision"],
            metadata: {
              readyCount: selection.readyCount,
              score: selection.score,
            },
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
              amount: value,
              sourceId: skill.id,
              sourceName: skill.name,
              tags: ["skill", "spend"],
            });
          },
          gainResource: (value, sourceName) => {
            state.resource = clamp(state.resource + value, 0, input.finalStats.resourceMax);
            pushCombatEvent(combatEvents, combatLog, {
              time,
              type: "RESOURCE_GAIN",
              category: "resource",
              summary: `${sourceName ?? skill.name} 回能 ${value.toFixed(1)}`,
              amount: value,
              sourceName: sourceName ?? skill.name,
              tags: ["skill", "gain"],
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
                amount: gain,
                sourceName: sourceName ?? skill.name,
                tags: ["shield"],
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
                amount: heal,
                sourceName: sourceName ?? skill.name,
                tags: ["heal"],
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
          dotFlowState,
          outgoingDamagePoints,
        });
      }
    }

    if (time >= state.nextBasicAt && aliveEnemies(enemies).length > 0) {
      const target = aliveEnemies(enemies)[0];
      const base = input.finalStats.atk * pressureDamageModifier("direct", input.floor.pressure);
      const crit = rollCrit(input.finalStats.crit, rng);
      const critApplied = crit ? base * critMultiplier(input.finalStats.critDamage) : base;
      const dealt = applyDamage(target, reduceEnemyMitigation(critApplied, target));
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: "basic_attack", sourceName: "基础攻击", category: "direct", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "BASIC_ATTACK",
          category: "offense",
          summary: `基础攻击 ${Math.round(dealt)}${crit ? "（暴击）" : ""}`,
          amount: dealt,
          sourceId: "basic_attack",
          sourceName: "基础攻击",
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: crit ? ["basic", "crit"] : ["basic"],
        });
      }
      const gain = 8 + (input.archetype === "engine" ? 1 : 0);
      state.resource = clamp(state.resource + gain, 0, input.finalStats.resourceMax);
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "RESOURCE_GAIN",
        category: "resource",
        summary: `普攻回能 ${gain}`,
        amount: gain,
        sourceId: "basic_attack",
        sourceName: "基础攻击",
        tags: ["basic", "gain"],
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
          sourceId: "basic_attack",
          sourceName: "基础攻击",
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["kill", "basic"],
        });
      }
    }

    const livingEnemies = aliveEnemies(enemies);
    if (livingEnemies.length > 0) {
      const mitigationRatio = computeDotCoverageMitigation(input.archetype, livingEnemies);
      for (const enemy of livingEnemies) {
        while (time >= enemy.nextAttackAt && state.playerHp > 0) {
          const incomingRaw =
            enemy.atk *
            enemyPressureAttackModifier(input.floor.pressure);
          const reduced = reducedByResist(
            reducedByDefense(incomingRaw, input.finalStats.def),
            input.finalStats.resist,
          );
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
              amount: prevShield - state.shield,
              sourceName: "敌方攻击",
              tags: ["shield", "loss"],
            });
          }
          state.playerHp = Math.max(0, state.playerHp - afterShield);
          state.damageTaken += afterShield;
          if (afterShield > 0) {
            incomingDamagePoints.push({ time, amount: afterShield });
            pruneDamagePoints(incomingDamagePoints, time, SNAPSHOT_RECENT_WINDOW_SECONDS + 2);
          }
          const heavy = afterShield >= input.finalStats.hp * 0.18;
          const sourceName = `敌人${enemy.id}(${enemy.template})`;
          pushCombatEvent(combatEvents, combatLog, {
            time,
            type: heavy ? "ENEMY_HEAVY_HIT" : "ENEMY_HIT",
            category: heavy ? "danger" : "defense",
            summary:
              mitigationRatio > 0
                ? `${sourceName} 造成 ${Math.round(afterShield)} 伤害（DOT压制减伤 ${Math.round(mitigationRatio * 100)}%）`
                : `${sourceName} 造成 ${Math.round(afterShield)} 伤害`,
            amount: afterShield,
            sourceId: `enemy_${enemy.id}`,
            sourceName,
            tags: heavy ? ["incoming", "heavy"] : ["incoming"],
            metadata: {
              mitigationRatio,
              aliveEnemies: livingEnemies.length,
              enemyTemplate: enemy.template,
              enemySpeed: enemy.speed,
            },
          });
          enemy.nextAttackAt += enemyAttackCadence(enemy, input.floor.pressure);
        }
      }
    }

    while (time >= nextSnapshotAt) {
      captureSnapshot({
        snapshots: combatSnapshots,
        time: nextSnapshotAt,
        state,
        enemies,
        totalEnemyHp: totalEnemyHpPool,
        outgoingDamagePoints,
        incomingDamagePoints,
      });
      nextSnapshotAt += SNAPSHOT_INTERVAL_SECONDS;
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
  const totalEnemyHp = totalEnemyHpPool;

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
    pushCombatEvent(combatEvents, combatLog, {
      time: duration,
      type: "BATTLE_END",
      category: "danger",
      summary: "战斗超时",
      sourceId: "system",
      sourceName: "系统",
      tags: ["timeout"],
    });
  }
  if (!win && state.playerHp <= 0) {
    pushCombatEvent(combatEvents, combatLog, {
      time: duration,
      type: "PLAYER_DEATH",
      category: "danger",
      summary: "角色被击败",
      amount: state.damageTaken,
      sourceId: "enemy_attack",
      sourceName: "敌方攻击",
      tags: ["death"],
    });
  }
  if (win) {
    pushCombatEvent(combatEvents, combatLog, {
      time: duration,
      type: "BATTLE_END",
      category: "system",
      summary: "战斗通关",
      sourceId: "system",
      sourceName: "系统",
      tags: ["win"],
    });
  }

  captureSnapshot({
    snapshots: combatSnapshots,
    time: duration,
    state,
    enemies,
    totalEnemyHp: totalEnemyHpPool,
    outgoingDamagePoints,
    incomingDamagePoints,
  });

  return { win, metrics, combatLog, combatEvents, combatSnapshots };
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
  dotFlowState: DotFlowState;
  outgoingDamagePoints: DamagePoint[];
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
    dotFlowState,
    outgoingDamagePoints,
  } = args;

  consumeResource(skill.cost);
  let contagionExtraStacks = 0;
  if (skill.id === "contagion_wave" && hasPassiveEffect(passiveRuntime, "CONTAGION_OPENING")) {
    if (consumeBattleFlag(passiveRuntime, "contagion_opening_used")) {
      gainResource(skill.cost, "传染起手（免费首放）");
      contagionExtraStacks = Math.max(
        0,
        Math.round(maxPassiveEffectValue(passiveRuntime, "CONTAGION_OPENING", "value2")),
      );
    }
  }
  pushCombatEvent(combatEvents, combatLog, {
    time,
    type: "SKILL_CAST",
    category: "offense",
    summary: `释放技能：${skill.name}`,
    sourceId: skill.id,
    sourceName: skill.name,
    amount: skill.cost,
    tags: ["cast", ...skill.tags],
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
        targetHpRatio: targets[0] ? clamp(targets[0].hp / targets[0].maxHp, 0, 1) : 1,
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
    outgoingDamagePoints,
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
        const surgePerStack = maxPassiveEffectValue(passiveRuntime, "RUPTURE_STACK_SURGE", "value");
        const surgeCap = maxPassiveEffectValue(passiveRuntime, "RUPTURE_STACK_SURGE", "value2");
        const stackBonus = Math.min(
          DOT_ROUTE_TUNING.ruptureBonusCap + surgeCap,
          targetDotStacksBeforeHit * (DOT_ROUTE_TUNING.ruptureBonusPerStack + surgePerStack),
        );
        raw *= 1 + stackBonus;
        if (target.hp <= target.maxHp * DOT_ROUTE_TUNING.ruptureExecuteThreshold) {
          raw *= 1 + DOT_ROUTE_TUNING.ruptureExecuteBonus;
        }
      }
      const executeBonus = input.loadout.core?.mechanicModifiers?.executeBonus ?? 0;
      if (executeBonus > 0 && target.hp <= target.maxHp * 0.3 && skill.tags.includes("finisher")) {
        raw *= 1 + executeBonus;
      }

      const dealt = applyDamage(target, reduceEnemyMitigation(raw, target));
      if (dealt > 0) {
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "direct", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "SKILL_CAST",
          category: "offense",
          summary: `${skill.name} 命中 ${Math.round(dealt)}${didCrit ? "（暴击）" : ""}`,
          amount: dealt,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: didCrit ? ["hit", "crit"] : ["hit"],
        });
      }

      const hitActions = resolvePassive(
        passiveRuntime,
        "onSkillHit",
        {
          now: time,
          skill,
          targetHpRatio: clamp(target.hp / target.maxHp, 0, 1),
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
        outgoingDamagePoints,
      });

      if (dealt > 0 && target.hp <= 0) {
        onFirstKill(time);
        const harvestKill = targetDotStacksBeforeHit > 0;
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "ENEMY_KILL",
          category: "offense",
          summary: harvestKill ? `${skill.name} 收割击杀（敌${target.id}）` : `敌人 ${target.id} 被 ${skill.name} 击败`,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: harvestKill ? ["kill", "skill", "harvest"] : ["kill", "skill"],
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
    const extraStacks = (input.loadout.core?.mechanicModifiers?.extraDotStacks ?? 0) + contagionExtraStacks;
    const targetsForDot = skill.tags.includes("aoe") ? aliveEnemies(enemies) : aliveEnemies(enemies).slice(0, 1);
    const rawDot = input.finalStats.atk * skill.dot.tickRatio * (1 + input.finalStats.dotPower);
    for (const target of targetsForDot) {
      const stacksBefore = getDotStacks(target);
      const adjusted = reduceEnemyMitigation(rawDot * pressureDamageModifier("dot", input.floor.pressure), target);
      applyDotToEnemy({ enemy: target, skill, now: time, damagePerTick: adjusted, extraStacks });
      const stacksAfter = getDotStacks(target);
      const stackDelta = Math.max(0, stacksAfter - stacksBefore);
      const isFirstCover = stacksBefore <= 0 && stacksAfter > 0;
      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "DOT_APPLY",
        category: "offense",
        summary: `${skill.name} 附加 DOT x${Math.max(1, stackDelta)}（敌${target.id}）`,
        sourceId: skill.id,
        sourceName: skill.name,
        targetId: target.id,
        targetName: `敌人${target.id}`,
        amount: adjusted,
        tags: isFirstCover ? ["dot", "apply", "first_cover"] : ["dot", "apply"],
        metadata: {
          stacksBefore,
          stacksAfter,
          stackDelta,
          keyStackThreshold: dotFlowState.keyStackThreshold,
        },
      });
      maybeEmitDotKeyStackEvent({
        enemy: target,
        time,
        dotFlowState,
        combatEvents,
        combatLog,
      });
    }
    if (input.archetype === "dot" && skill.tags.includes("starter") && !skill.tags.includes("aoe")) {
      const spreadTarget = selectSpreadTarget(enemies, targetsForDot[0]?.id);
      if (spreadTarget) {
        const spreadBefore = getDotStacks(spreadTarget);
        const spreadAdjusted =
          reduceEnemyMitigation(rawDot * pressureDamageModifier("dot", input.floor.pressure), spreadTarget) *
          DOT_ROUTE_TUNING.starterSpreadTickMultiplier;
        applyDotToEnemy({
          enemy: spreadTarget,
          skill,
          now: time,
          damagePerTick: spreadAdjusted,
          extraStacks: Math.max(0, extraStacks - 1),
        });
        const spreadAfter = getDotStacks(spreadTarget);
        const spreadDelta = Math.max(0, spreadAfter - spreadBefore);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_APPLY",
          category: "offense",
          summary: `${skill.name} DOT扩散 x${Math.max(1, spreadDelta)}（敌${spreadTarget.id}）`,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: spreadTarget.id,
          targetName: `敌人${spreadTarget.id}`,
          amount: spreadAdjusted,
          tags: ["dot", "apply", "spread"],
          metadata: {
            stacksBefore: spreadBefore,
            stacksAfter: spreadAfter,
            stackDelta: spreadDelta,
            keyStackThreshold: dotFlowState.keyStackThreshold,
          },
        });
        maybeEmitDotKeyStackEvent({
          enemy: spreadTarget,
          time,
          dotFlowState,
          combatEvents,
          combatLog,
        });
      }
    }
    if (skill.id === "toxic_lance" && hasPassiveEffect(passiveRuntime, "DOT_LANCE_SPLASH")) {
      const extraSpreadTargets = Math.max(
        0,
        Math.round(maxPassiveEffectValue(passiveRuntime, "DOT_LANCE_SPLASH", "value")),
      );
      const weakRatio = clamp(
        maxPassiveEffectValue(passiveRuntime, "DOT_LANCE_SPLASH", "value2") || 0.58,
        0.35,
        0.95,
      );
      const used = new Set<number>(targetsForDot.map((entry) => entry.id));
      for (let index = 0; index < extraSpreadTargets; index += 1) {
        const extraTarget = selectSpreadTarget(enemies, undefined, used);
        if (!extraTarget) {
          break;
        }
        used.add(extraTarget.id);
        const extraBefore = getDotStacks(extraTarget);
        const extraAdjusted =
          reduceEnemyMitigation(rawDot * pressureDamageModifier("dot", input.floor.pressure), extraTarget) *
          weakRatio;
        applyDotToEnemy({
          enemy: extraTarget,
          skill,
          now: time,
          damagePerTick: extraAdjusted,
          extraStacks: Math.max(0, extraStacks - 1),
        });
        const extraAfter = getDotStacks(extraTarget);
        const extraDelta = Math.max(0, extraAfter - extraBefore);
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_APPLY",
          category: "offense",
          summary: `${skill.name} 奖励扩散 DOT x${Math.max(1, extraDelta)}（敌${extraTarget.id}）`,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: extraTarget.id,
          targetName: `敌人${extraTarget.id}`,
          amount: extraAdjusted,
          tags: ["dot", "spread", "reward"],
          metadata: {
            stacksBefore: extraBefore,
            stacksAfter: extraAfter,
            stackDelta: extraDelta,
            keyStackThreshold: dotFlowState.keyStackThreshold,
          },
        });
        maybeEmitDotKeyStackEvent({
          enemy: extraTarget,
          time,
          dotFlowState,
          combatEvents,
          combatLog,
        });
      }
    }
    maybeEmitDotLoopReadyEvent({
      archetype: input.archetype,
      enemies,
      time,
      dotFlowState,
      combatEvents,
      combatLog,
    });
    if (input.archetype === "dot") {
      gainResource(DOT_ROUTE_TUNING.dotCycleRefund, "DOT循环回能");
    }
  }

  if ((skill.burstDotPercent ?? 0) > 0) {
    const target =
      skill.id === "rupture_bloom"
        ? selectRuptureTarget(enemies)
        : aliveEnemies(enemies)[0];
    if (target) {
      const burstBonus = input.loadout.core?.mechanicModifiers?.dotBurstBonus ?? 0;
      const targetDotStacks = getDotStacks(target);
      if (
        input.archetype === "dot" &&
        !dotFlowState.burstWindowAnnounced &&
        targetDotStacks >= dotFlowState.keyStackThreshold
      ) {
        dotFlowState.burstWindowAnnounced = true;
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "BUFF_GAIN",
          category: "offense",
          summary: "引爆窗口打开：可执行转化收割",
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["dot", "dot_burst_window", "highlight"],
          metadata: {
            targetDotStacks,
            keyStackThreshold: dotFlowState.keyStackThreshold,
          },
        });
      }
      const ruptureBurstBonus =
        skill.id === "rupture_bloom"
          ? Math.min(
              DOT_ROUTE_TUNING.ruptureBurstBonusCap,
              targetDotStacks *
                (DOT_ROUTE_TUNING.ruptureBurstBonusPerStack +
                  maxPassiveEffectValue(passiveRuntime, "RUPTURE_STACK_SURGE", "value") * 0.4),
            )
          : 0;
      const burstPercent =
        (skill.burstDotPercent ?? 0) *
        (1 + burstBonus + castOutcome.dotBurstMultiplierBonus + ruptureBurstBonus);
      const burst = burstDotDamage(target, burstPercent);
      if (burst > 0) {
        const dealt = applyDamage(target, burst);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "dot", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_BURST",
          category: "offense",
          summary: `${skill.name} 引爆触发，造成 ${Math.round(dealt)}`,
          amount: dealt,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["dot", "burst"],
          metadata: {
            targetDotStacks,
            keyStackThreshold: dotFlowState.keyStackThreshold,
          },
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
          summary: `${skill.name} 收割击杀（敌${target.id}）`,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["kill", "burst", "harvest"],
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
        reduceEnemyMitigation(raw * pressureDamageModifier("proc", input.floor.pressure), target),
      );
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: skill.id, sourceName: skill.name, category: "proc", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${skill.name} 触发 ${Math.round(dealt)}`,
          amount: dealt,
          sourceId: skill.id,
          sourceName: skill.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["proc"],
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
        reduceEnemyMitigation(raw * pressureDamageModifier("proc", input.floor.pressure), target),
      );
      if (dealt > 0 && input.loadout.core) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: input.loadout.core.id, sourceName: `${input.loadout.core.name}触发`, category: "proc", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${input.loadout.core.name} 触发 ${Math.round(dealt)}`,
          amount: dealt,
          sourceId: input.loadout.core.id,
          sourceName: input.loadout.core.name,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["proc", "core"],
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
  outgoingDamagePoints: DamagePoint[];
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
    outgoingDamagePoints,
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
        reduceEnemyMitigation(raw * pressureDamageModifier("proc", input.floor.pressure), target),
      );
      if (dealt > 0) {
        onProcDamage(dealt);
        registerDamage(
          damageEntries,
          damageTimeline,
          time,
          { sourceId: `trigger:${action.sourceId}`, sourceName: `${action.sourceName}触发`, category: "proc", total: 0 },
          dealt,
          outgoingDamagePoints,
        );
        onCombatEvent({
          time,
          type: "PROC_TRIGGER",
          category: "offense",
          summary: `${action.sourceName} 触发 ${Math.round(dealt)}`,
          amount: dealt,
          sourceId: action.sourceId,
          sourceName: action.sourceName,
          targetId: target.id,
          targetName: `敌人${target.id}`,
          tags: ["proc", "trigger"],
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
  outgoingDamagePoints?: DamagePoint[],
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
  if (outgoingDamagePoints) {
    outgoingDamagePoints.push({ time, amount: dealt });
    pruneDamagePoints(outgoingDamagePoints, time, SNAPSHOT_RECENT_WINDOW_SECONDS + 2);
  }
}

interface ResolveEnemyTraitArgs {
  input: BattleInput;
  time: number;
  enemies: EnemyState[];
  traitRuntime: Map<number, EnemyTraitRuntime>;
  combatEvents: CombatEvent[];
  combatLog: string[];
}

function resolveEnemyTraitMechanics(args: ResolveEnemyTraitArgs): void {
  const { input, time, enemies, traitRuntime, combatEvents, combatLog } = args;
  for (const enemy of aliveEnemies(enemies)) {
    const runtime = traitRuntime.get(enemy.id);
    if (!runtime) {
      continue;
    }

    if (enemy.template === "antiDot" && time >= runtime.nextCleanseAt) {
      const removedStacks = cleanseEnemyDots(enemy, ENEMY_TRAIT_TUNING.antiDotCleanseKeepRatio);
      if (removedStacks > 0) {
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_CLEANSE",
          category: "danger",
          summary: `敌人${enemy.id} 净化了 ${removedStacks} 层DOT`,
          sourceId: `enemy_${enemy.id}`,
          sourceName: `敌人${enemy.id}(antiDot)`,
          targetId: enemy.id,
          targetName: `敌人${enemy.id}`,
          amount: removedStacks,
          tags: ["enemy_trait", "anti_dot", "cleanse"],
        });
      }
      runtime.nextCleanseAt += ENEMY_TRAIT_TUNING.antiDotCleanseInterval / clamp(enemy.speed, 0.55, 2.2);
    }

    if (
      enemy.template === "boss" &&
      !enemy.bossMechanicTriggered &&
      enemy.hp <= enemy.maxHp * ENEMY_TRAIT_TUNING.bossHalfHpThreshold
    ) {
      enemy.bossMechanicTriggered = true;
      const removedStacks = clearEnemyDots(enemy);
      enemy.atk = Math.max(1, Math.round(enemy.atk * ENEMY_TRAIT_TUNING.bossRageAtkMultiplier));
      enemy.speed = clamp(enemy.speed * ENEMY_TRAIT_TUNING.bossRageSpeedMultiplier, 0.55, 2.4);
      enemy.nextAttackAt = Math.min(enemy.nextAttackAt, time + 0.8);

      pushCombatEvent(combatEvents, combatLog, {
        time,
        type: "BOSS_MECHANIC",
        category: "danger",
        summary:
          removedStacks > 0
            ? `Boss 半血触发：净化DOT并进入狂怒`
            : `Boss 半血触发：进入狂怒`,
        sourceId: `enemy_${enemy.id}`,
        sourceName: `Boss敌人${enemy.id}`,
        targetId: enemy.id,
        targetName: `敌人${enemy.id}`,
        tags: ["boss", "mechanic", "rage"],
        metadata: {
          removedStacks,
          bossAtk: enemy.atk,
          bossSpeed: enemy.speed,
          floor: input.floor.floor,
        },
      });

      if (removedStacks > 0) {
        pushCombatEvent(combatEvents, combatLog, {
          time,
          type: "DOT_CLEANSE",
          category: "danger",
          summary: `Boss 净化了 ${removedStacks} 层DOT`,
          sourceId: `enemy_${enemy.id}`,
          sourceName: `Boss敌人${enemy.id}`,
          targetId: enemy.id,
          targetName: `敌人${enemy.id}`,
          amount: removedStacks,
          tags: ["boss", "cleanse"],
        });
      }
    }
  }
}

function buildEnemyTraitRuntime(enemies: EnemyState[]): Map<number, EnemyTraitRuntime> {
  const runtime = new Map<number, EnemyTraitRuntime>();
  for (const enemy of enemies) {
    runtime.set(enemy.id, {
      nextCleanseAt:
        enemy.template === "antiDot"
          ? 4.2 / clamp(enemy.speed, 0.55, 2.2)
          : Number.POSITIVE_INFINITY,
    });
  }
  return runtime;
}

function cleanseEnemyDots(enemy: EnemyState, keepRatio: number): number {
  const before = getDotStacks(enemy);
  if (before <= 0) {
    return 0;
  }
  const safeKeep = clamp(keepRatio, 0, 1);
  for (const dot of enemy.dots) {
    dot.stacks = Math.max(0, Math.floor(dot.stacks * safeKeep));
  }
  enemy.dots = enemy.dots.filter((dot) => dot.stacks > 0 && dot.remaining > 0);
  const after = getDotStacks(enemy);
  return Math.max(0, before - after);
}

function clearEnemyDots(enemy: EnemyState): number {
  const before = getDotStacks(enemy);
  if (before <= 0) {
    return 0;
  }
  enemy.dots = [];
  return before;
}

function buildEnemiesForFloor(input: BattleInput): EnemyState[] {
  const units = input.floor.enemyUnits;
  if (units && units.length > 0) {
    return units.map((unit) => ({
      id: unit.id,
      template: unit.template,
      maxHp: unit.hp,
      hp: unit.hp,
      atk: unit.atk,
      def: unit.def,
      resist: unit.resist,
      speed: unit.speed,
      nextAttackAt: enemyAttackCadenceBySpeed(unit.speed, input.floor.pressure),
      dots: [],
    }));
  }
  return Array.from({ length: input.floor.enemyCount }, (_, index) => ({
    id: index + 1,
    template: input.floor.boss ? "boss" : "balanced",
    maxHp: input.floor.enemyHp,
    hp: input.floor.enemyHp,
    atk: input.floor.enemyAtk,
    def: input.floor.enemyDef,
    resist: input.floor.enemyResist,
    speed: input.floor.enemySpeed || 1,
    nextAttackAt: enemyAttackCadenceBySpeed(input.floor.enemySpeed || 1, input.floor.pressure),
    dots: [],
  }));
}

function enemyAttackCadence(enemy: EnemyState, pressure: BattleInput["floor"]["pressure"]): number {
  return enemyAttackCadenceBySpeed(enemy.speed, pressure);
}

function enemyAttackCadenceBySpeed(speed: number, pressure: BattleInput["floor"]["pressure"]): number {
  const base = pressure === "swarm" ? ENEMY_ATTACK_INTERVAL / 1.08 : ENEMY_ATTACK_INTERVAL;
  return base / clamp(speed, 0.55, 2.2);
}

function reduceEnemyMitigation(rawDamage: number, target: EnemyState): number {
  return reducedByResist(reducedByDefense(rawDamage, target.def), target.resist);
}

function hasPassiveEffect(runtime: PassiveRuntime, id: PassiveEffectId): boolean {
  return runtime.effects.some((effect) => effect.id === id);
}

function maxPassiveEffectValue(
  runtime: PassiveRuntime,
  id: PassiveEffectId,
  field: "value" | "value2",
): number {
  let value = 0;
  for (const effect of runtime.effects) {
    if (effect.id !== id) {
      continue;
    }
    value = Math.max(value, effect[field] ?? 0);
  }
  return value;
}

function consumeBattleFlag(runtime: PassiveRuntime, key: string): boolean {
  if (runtime.flags.get(key)) {
    return false;
  }
  runtime.flags.set(key, true);
  return true;
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

interface EmitDotKeyStackArgs {
  enemy: EnemyState;
  time: number;
  dotFlowState: DotFlowState;
  combatEvents: CombatEvent[];
  combatLog: string[];
}

function maybeEmitDotKeyStackEvent(args: EmitDotKeyStackArgs): void {
  const { enemy, time, dotFlowState, combatEvents, combatLog } = args;
  const totalStacks = getDotStacks(enemy);
  if (totalStacks < dotFlowState.keyStackThreshold || dotFlowState.keyStackTargets.has(enemy.id)) {
    return;
  }
  dotFlowState.keyStackTargets.add(enemy.id);
  pushCombatEvent(combatEvents, combatLog, {
    time,
    type: "BUFF_GAIN",
    category: "offense",
    summary: `敌${enemy.id} DOT达到关键层数（${totalStacks}层）`,
    sourceId: "dot_flow",
    sourceName: "DOT循环",
    targetId: enemy.id,
    targetName: `敌人${enemy.id}`,
    tags: ["dot", "dot_milestone", "highlight"],
    metadata: {
      targetDotStacks: totalStacks,
      keyStackThreshold: dotFlowState.keyStackThreshold,
    },
  });
}

interface EmitDotLoopReadyArgs {
  archetype: BattleInput["archetype"];
  enemies: EnemyState[];
  time: number;
  dotFlowState: DotFlowState;
  combatEvents: CombatEvent[];
  combatLog: string[];
}

function maybeEmitDotLoopReadyEvent(args: EmitDotLoopReadyArgs): void {
  const { archetype, enemies, time, dotFlowState, combatEvents, combatLog } = args;
  if (archetype !== "dot" || dotFlowState.loopReadyAnnounced) {
    return;
  }
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const covered = living.filter((enemy) => getDotStacks(enemy) > 0).length;
  const highStackTargets = living.filter((enemy) => getDotStacks(enemy) >= dotFlowState.keyStackThreshold).length;
  if (covered < DOT_FLOW_TUNING.loopReadyCoverage && highStackTargets <= 0) {
    return;
  }
  dotFlowState.loopReadyAnnounced = true;
  pushCombatEvent(combatEvents, combatLog, {
    time,
    type: "BUFF_GAIN",
    category: "offense",
    summary: "DOT循环成型：压血节奏建立",
    sourceId: "dot_flow",
    sourceName: "DOT循环",
    tags: ["dot", "dot_loop_ready", "highlight"],
    metadata: {
      coveredEnemies: covered,
      highStackTargets,
    },
  });
}

function selectSpreadTarget(
  enemies: EnemyState[],
  skipId?: number,
  excludeIds?: Set<number>,
): EnemyState | undefined {
  const candidates = enemies
    .filter((enemy) => enemy.hp > 0 && enemy.id !== skipId && !(excludeIds?.has(enemy.id) ?? false))
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

function selectRuptureTarget(enemies: EnemyState[]): EnemyState | undefined {
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
    const leftRatio = left.hp / Math.max(1, left.maxHp);
    const rightRatio = right.hp / Math.max(1, right.maxHp);
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

interface CaptureSnapshotArgs {
  snapshots: CombatSnapshot[];
  time: number;
  state: RuntimeState;
  enemies: EnemyState[];
  totalEnemyHp: number;
  outgoingDamagePoints: DamagePoint[];
  incomingDamagePoints: DamagePoint[];
}

function captureSnapshot(args: CaptureSnapshotArgs): void {
  const {
    snapshots,
    time,
    state,
    enemies,
    totalEnemyHp,
    outgoingDamagePoints,
    incomingDamagePoints,
  } = args;
  if (snapshots.length >= MAX_COMBAT_SNAPSHOTS) {
    return;
  }
  const alive = enemies.filter((enemy) => enemy.hp > 0);
  const remainingEnemyHp = enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0);
  const dotCoveredEnemies = alive.filter((enemy) => getDotStacks(enemy) > 0).length;
  const outgoing = sumRecentDamage(outgoingDamagePoints, time, SNAPSHOT_RECENT_WINDOW_SECONDS);
  const incoming = sumRecentDamage(incomingDamagePoints, time, SNAPSHOT_RECENT_WINDOW_SECONDS);

  snapshots.push({
    time: roundTime(time),
    playerHp: Math.max(0, state.playerHp),
    playerShield: Math.max(0, state.shield),
    playerEnergy: Math.max(0, state.resource),
    aliveEnemies: alive.length,
    enemyRemainingHpRatio: clamp(remainingEnemyHp / Math.max(1, totalEnemyHp), 0, 1),
    dotCoveredEnemies,
    recentIncomingDamageWindow: incoming,
    recentOutgoingDamageWindow: outgoing,
  });
}

function sumRecentDamage(points: DamagePoint[], now: number, window: number): number {
  pruneDamagePoints(points, now, window);
  let sum = 0;
  for (const point of points) {
    if (point.time >= now - window && point.time <= now) {
      sum += point.amount;
    }
  }
  return sum;
}

function pruneDamagePoints(points: DamagePoint[], now: number, window: number): void {
  const cutoff = now - Math.max(window, 0);
  while (points.length > 0 && points[0].time < cutoff) {
    points.shift();
  }
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
