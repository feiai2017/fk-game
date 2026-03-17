import type {
  Loadout,
  PassiveEffectDef,
  PassiveEventType,
  SkillDef,
} from "@/core/battle/types";
import type { SeededRng } from "@/core/battle/formulas";

interface PassiveEffectInstance extends PassiveEffectDef {
  key: string;
  sourceId: string;
  sourceName: string;
}

export interface PassiveRuntime {
  effects: PassiveEffectInstance[];
  cooldowns: Map<string, number>;
  nextProcBonusRatio: number;
  flags: Map<string, boolean>;
}

export interface PassiveEventPayload {
  now: number;
  skill?: SkillDef;
  targetHpRatio?: number;
  targetDotStacks?: number;
  didCrit?: boolean;
  resourceSpent?: number;
  playerResourceRatio?: number;
}

export interface PassiveAction {
  sourceId: string;
  sourceName: string;
  grantResource?: number;
  addShield?: number;
  reduceAllCooldowns?: number;
  dotBurstMultiplierBonus?: number;
  bonusProcRatio?: number;
  setNextProcBonusRatio?: number;
}

export function createPassiveRuntime(loadout: Loadout): PassiveRuntime {
  const effects = collectPassiveEffects(loadout);
  return {
    effects,
    cooldowns: new Map(effects.map((effect) => [effect.key, 0])),
    nextProcBonusRatio: 0,
    flags: new Map(),
  };
}

export function advancePassiveCooldowns(runtime: PassiveRuntime, delta: number): void {
  for (const [key, cooldown] of runtime.cooldowns.entries()) {
    runtime.cooldowns.set(key, Math.max(0, cooldown - delta));
  }
}

export function resolvePassiveActions(
  runtime: PassiveRuntime,
  event: PassiveEventType,
  payload: PassiveEventPayload,
  rng: SeededRng,
): PassiveAction[] {
  const actions: PassiveAction[] = [];
  for (const effect of runtime.effects) {
    if (effect.event !== event) {
      continue;
    }
    const cooldown = runtime.cooldowns.get(effect.key) ?? 0;
    if (cooldown > 0) {
      continue;
    }
    if (effect.chance !== undefined && rng.next() > effect.chance) {
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

function evaluateEffect(
  effect: PassiveEffectInstance,
  payload: PassiveEventPayload,
): PassiveAction | undefined {
  switch (effect.id) {
    case "DOT_BURST_REFUND": {
      if ((payload.skill?.burstDotPercent ?? 0) <= 0 || (payload.targetDotStacks ?? 0) <= 0) {
        return undefined;
      }
      const stacks = Math.min(4, payload.targetDotStacks ?? 0);
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: (effect.value ?? 5) * stacks,
        dotBurstMultiplierBonus: effect.value2 ?? 0.12,
      };
    }
    case "DOT_COVERAGE_CDR": {
      if (!payload.skill?.dot) {
        return undefined;
      }
      if ((payload.targetDotStacks ?? 0) < 2) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        reduceAllCooldowns: effect.value ?? 1.1,
      };
    }
    case "DOT_FULLSTACK_ECHO": {
      if (!payload.skill?.tags.includes("dot")) {
        return undefined;
      }
      if ((payload.targetDotStacks ?? 0) < 4) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        bonusProcRatio: effect.value ?? 0.28,
        dotBurstMultiplierBonus: effect.value2 ?? 0.18,
      };
    }
    case "CRIT_FINISHER_CDR": {
      if (!payload.skill?.tags.includes("finisher") || !payload.didCrit) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        reduceAllCooldowns: effect.value ?? 1.8,
      };
    }
    case "CRIT_FINISHER_VALUE": {
      if (!payload.skill?.tags.includes("finisher")) {
        return undefined;
      }
      if ((payload.targetHpRatio ?? 1) > 0.45) {
        return undefined;
      }
      if (!payload.didCrit) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        bonusProcRatio: effect.value ?? 0.35,
      };
    }
    case "CRIT_FINISHER_REFUND": {
      if (!payload.skill?.tags.includes("finisher") || !payload.didCrit) {
        return undefined;
      }
      if ((payload.targetHpRatio ?? 1) > 0.5) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: effect.value ?? 12,
        reduceAllCooldowns: effect.value2 ?? 1.2,
      };
    }
    case "ENGINE_OVERFLOW_GUARD": {
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        addShield: effect.value ?? 22,
        bonusProcRatio: effect.value2 ?? 0.3,
      };
    }
    case "SPEND_EMPOWER_NEXT_PROC": {
      if ((payload.resourceSpent ?? 0) < (effect.value2 ?? 24)) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        setNextProcBonusRatio: effect.value ?? 0.35,
      };
    }
    case "ENGINE_HIGH_RESOURCE_CHAIN": {
      if ((payload.playerResourceRatio ?? 0) < (effect.value2 ?? 0.72)) {
        return undefined;
      }
      if (!payload.skill?.tags.some((tag) => tag === "proc" || tag === "spender")) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        setNextProcBonusRatio: effect.value ?? 0.34,
      };
    }
    case "LOW_RESOURCE_CYCLE_SURGE": {
      if (!payload.skill?.tags.includes("cycle")) {
        return undefined;
      }
      if ((payload.playerResourceRatio ?? 1) > (effect.value2 ?? 0.3)) {
        return undefined;
      }
      return {
        sourceId: effect.sourceId,
        sourceName: effect.sourceName,
        grantResource: effect.value ?? 10,
        reduceAllCooldowns: 0.7,
      };
    }
    default:
      return undefined;
  }
}

function collectPassiveEffects(loadout: Loadout): PassiveEffectInstance[] {
  const equipped = [
    loadout.weapon,
    loadout.helm,
    loadout.armor,
    loadout.ring1,
    loadout.ring2,
    loadout.core,
  ];
  const effects: PassiveEffectInstance[] = [];
  for (const item of equipped) {
    if (!item?.mechanicEffects?.length) {
      continue;
    }
    item.mechanicEffects.forEach((effect, index) => {
      effects.push({
        ...effect,
        key: `${item.instanceId ?? item.id}:${effect.id}:${index}`,
        sourceId: item.id,
        sourceName: item.name,
      });
    });
  }
  return effects;
}

export function consumeNextProcBonus(runtime: PassiveRuntime): number {
  const current = runtime.nextProcBonusRatio;
  runtime.nextProcBonusRatio = 0;
  return current;
}
