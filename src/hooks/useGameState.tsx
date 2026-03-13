import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  ArchetypeKey,
  BattleReport,
  EquipmentSlot,
  GameState,
  ItemDef,
  RelicDef,
  RunState,
  SkillDef,
  Stats,
} from "@/core/battle/types";
import { equipItem, updateSkillSlot } from "@/core/build/loadout";
import { aggregateStats } from "@/core/build/statAggregator";
import { validateLoadout } from "@/core/build/validators";
import { createItemInstance } from "@/core/loot/itemFactory";
import {
  applyRunProgressToSkills,
  applyRunProgressToStats,
  applyRunProgressToLoadout,
  appendBattleToRunProgress,
  buildRunEndSummary,
  createInitialRunState,
} from "@/core/run/progression";
import { applyRunReward, generateRunRewards } from "@/core/run/rewardSystem";
import {
  BASE_PLAYER_STATS,
  DEFAULT_SKILL_IDS,
  DEMO_RUN_TARGET_FLOOR,
  STARTING_INVENTORY_IDS,
} from "@/data/constants";
import { ITEM_BY_ID } from "@/data/items";
import { RELIC_BY_ID } from "@/data/relics";
import { SKILL_BY_ID } from "@/data/skills";
import { TOWER_FLOORS } from "@/data/tower";
import { useBattleRunner } from "@/hooks/useBattleRunner";
import { usePersistence } from "@/hooks/usePersistence";

interface GameContextValue {
  state: GameState;
  finalStats: Stats;
  selectedSkills: SkillDef[];
  loadoutIssues: string[];
  equipFromInventory: (slot: EquipmentSlot, instanceId: string) => void;
  unequip: (slot: EquipmentSlot) => void;
  setSkillId: (index: number, skillId: string) => void;
  setArchetype: (archetype: ArchetypeKey) => void;
  runFloor: (floorNumber: number) => BattleReport | undefined;
  continueRun: () => BattleReport | undefined;
  selectRunReward: (optionId: string) => void;
  startNewRun: () => void;
  clearReport: () => void;
}

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export function GameStateProvider({ children }: PropsWithChildren): JSX.Element {
  const { loadState, saveState } = usePersistence();
  const runBattle = useBattleRunner();

  const [state, setState] = useState<GameState>(() => {
    const loaded = loadState();
    return ensureRunState(loaded ?? createInitialGameState());
  });

  useEffect(() => {
    saveState(state);
  }, [saveState, state]);

  const baseStats = useMemo(() => aggregateStats(BASE_PLAYER_STATS, state.loadout), [state.loadout]);
  const finalStats = useMemo(
    () => applyRunProgressToStats(baseStats, state.run.progress),
    [baseStats, state.run.progress],
  );

  const selectedSkills = useMemo(() => {
    const baseSkills = state.loadout.skillIds
      .map((skillId) => SKILL_BY_ID[skillId])
      .filter((skill): skill is SkillDef => Boolean(skill));
    return applyRunProgressToSkills(baseSkills, state.run.progress);
  }, [state.loadout.skillIds, state.run.progress]);

  const loadoutIssues = useMemo(() => validateLoadout(state.loadout), [state.loadout]);

  const equipFromInventory = useCallback((slot: EquipmentSlot, instanceId: string) => {
    setState((current) => {
      const item = current.inventory.find((entry) => entry.instanceId === instanceId);
      if (!item || !isCompatible(item, slot)) {
        return current;
      }
      const currentSlotItem = current.loadout[slot];
      const inventory = current.inventory.filter((entry) => entry.instanceId !== instanceId);
      if (currentSlotItem) {
        inventory.push(currentSlotItem);
      }
      const nextLoadout = equipItem(
        current.loadout,
        slot,
        slot === "core" ? (item as RelicDef) : item,
      );
      return {
        ...current,
        inventory,
        loadout: nextLoadout,
      };
    });
  }, []);

  const unequip = useCallback((slot: EquipmentSlot) => {
    setState((current) => {
      const item = current.loadout[slot];
      if (!item) {
        return current;
      }
      const nextLoadout = equipItem(current.loadout, slot, undefined);
      return {
        ...current,
        loadout: nextLoadout,
        inventory: [...current.inventory, item],
      };
    });
  }, []);

  const setSkillId = useCallback((index: number, skillId: string) => {
    setState((current) => ({
      ...current,
      loadout: updateSkillSlot(current.loadout, index, skillId),
    }));
  }, []);

  const setArchetype = useCallback((archetype: ArchetypeKey) => {
    setState((current) => ({ ...current, archetype }));
  }, []);

  const clearReport = useCallback(() => {
    setState((current) => ({ ...current, lastReport: undefined }));
  }, []);

  const runFloor = useCallback(
    (floorNumber: number): BattleReport | undefined => {
      if (state.run.isOver || state.run.status !== "in_progress") {
        return undefined;
      }
      if (floorNumber !== state.run.currentFloor) {
        return undefined;
      }
      const floor = TOWER_FLOORS.find((entry) => entry.floor === floorNumber);
      if (!floor || selectedSkills.length === 0) {
        return undefined;
      }
      const battleLoadout = applyRunProgressToLoadout(state.loadout, state.run.progress);
      const report = runBattle({
        floor,
        finalStats,
        skills: selectedSkills,
        loadout: battleLoadout,
        archetype: state.archetype,
      });
      const rewardOptions =
        report.win && floorNumber < DEMO_RUN_TARGET_FLOOR
          ? generateRunRewards({
              floor: floorNumber,
              archetype: state.archetype,
              skills: selectedSkills,
              progress: state.run.progress,
            })
          : [];

      setState((current) => {
        const nextProgress = appendBattleToRunProgress(current.run.progress, report);
        const latestResult = {
          floor: floorNumber,
          win: report.win,
          duration: report.metrics.duration,
          enemyRemainingHpRatio: report.metrics.enemyRemainingHpRatio,
          timestamp: Date.now(),
        };

        let nextRun: RunState;
        if (!report.win) {
          const draftRun: RunState = {
            ...current.run,
            status: "over",
            isOver: true,
            canContinue: false,
            pendingRewards: undefined,
            progress: nextProgress,
            latestResult,
            currentFloor: floorNumber,
          };
          nextRun = {
            ...draftRun,
            endSummary: buildRunEndSummary({
              run: draftRun,
              archetype: current.archetype,
              reachedFloor: floorNumber,
              outcome: "defeat",
            }),
          };
        } else if (floorNumber >= DEMO_RUN_TARGET_FLOOR) {
          const draftRun: RunState = {
            ...current.run,
            status: "over",
            isOver: true,
            canContinue: false,
            pendingRewards: undefined,
            progress: nextProgress,
            latestResult,
            currentFloor: DEMO_RUN_TARGET_FLOOR,
          };
          nextRun = {
            ...draftRun,
            endSummary: buildRunEndSummary({
              run: draftRun,
              archetype: current.archetype,
              reachedFloor: DEMO_RUN_TARGET_FLOOR,
              outcome: "victory",
            }),
          };
        } else {
          nextRun = {
            ...current.run,
            status: "reward_pending",
            isOver: false,
            canContinue: false,
            pendingRewards: rewardOptions,
            progress: nextProgress,
            latestResult,
            currentFloor: floorNumber + 1,
          };
        }

        return {
          ...current,
          currentFloor: nextRun.currentFloor,
          inventory: [...current.inventory, ...report.loot],
          lastReport: report,
          run: nextRun,
          lastBattleSnapshot: {
            floor: floorNumber,
            archetype: current.archetype,
            loadout: cloneLoadout(current.loadout),
          },
        };
      });

      return report;
    },
    [finalStats, runBattle, selectedSkills, state.archetype, state.loadout, state.run],
  );

  const selectRunReward = useCallback((optionId: string) => {
    setState((current) => {
      if (current.run.status !== "reward_pending" || !current.run.pendingRewards?.length) {
        return current;
      }
      const option = current.run.pendingRewards.find((entry) => entry.id === optionId);
      if (!option) {
        return current;
      }
      const updatedProgress = applyRunReward(
        current.run.progress,
        option,
        Math.max(1, current.run.currentFloor - 1),
      );
      return {
        ...current,
        run: {
          ...current.run,
          status: "in_progress",
          canContinue: true,
          pendingRewards: undefined,
          progress: updatedProgress,
        },
      };
    });
  }, []);

  const startNewRun = useCallback(() => {
    setState((current) => ({
      ...current,
      currentFloor: 1,
      run: createInitialRunState(1),
      lastReport: undefined,
      lastBattleSnapshot: undefined,
    }));
  }, []);

  const continueRun = useCallback(() => {
    return runFloor(state.run.currentFloor);
  }, [runFloor, state.run.currentFloor]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      finalStats,
      selectedSkills,
      loadoutIssues,
      equipFromInventory,
      unequip,
      setSkillId,
      setArchetype,
      runFloor,
      continueRun,
      selectRunReward,
      startNewRun,
      clearReport,
    }),
    [
      clearReport,
      continueRun,
      equipFromInventory,
      finalStats,
      loadoutIssues,
      runFloor,
      selectRunReward,
      selectedSkills,
      setArchetype,
      setSkillId,
      startNewRun,
      state,
      unequip,
    ],
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState(): GameContextValue {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("useGameState must be used within GameStateProvider.");
  }
  return context;
}

function createInitialGameState(): GameState {
  const baseItems = STARTING_INVENTORY_IDS.map((id, index) => {
    const source = ITEM_BY_ID[id] ?? RELIC_BY_ID[id];
    return createItemInstance(source, `start-${index}`);
  });
  const loadout: GameState["loadout"] = {
    skillIds: [...DEFAULT_SKILL_IDS],
  };
  const inventory: ItemDef[] = [];

  for (const item of baseItems) {
    if (item.slot === "weapon" && !loadout.weapon) {
      loadout.weapon = item;
      continue;
    }
    if (item.slot === "helm" && !loadout.helm) {
      loadout.helm = item;
      continue;
    }
    if (item.slot === "armor" && !loadout.armor) {
      loadout.armor = item;
      continue;
    }
    if (item.slot === "ring1" && !loadout.ring1) {
      loadout.ring1 = item;
      continue;
    }
    if (item.slot === "ring2" && !loadout.ring2) {
      loadout.ring2 = item;
      continue;
    }
    if (item.slot === "core" && !loadout.core) {
      loadout.core = item as RelicDef;
      continue;
    }
    inventory.push(item);
  }

  const deterministicExtras = [
    "w_serrated_reaper",
    "w_predator_rifle",
    "w_execution_scope",
    "w_threshold_accumulator",
    "h_flux_reservoir",
    "h_processor_crown",
    "a_reactive_shell",
    "r_overflow_gem",
    "r_rupture_sigil",
    "r_guillotine_coil",
    "r_plague_resonator",
    "r_mercy_trigger",
    "r_venom_timer",
    "core_assassin_relay",
    "core_singularity_drive",
    "core_overflow_matrix",
    "core_spore_hive",
    "core_feedback_prism",
  ];
  for (const [index, itemId] of deterministicExtras.entries()) {
    const source = ITEM_BY_ID[itemId] ?? RELIC_BY_ID[itemId];
    if (!source || baseItems.some((entry) => entry.id === source.id)) {
      continue;
    }
    inventory.push(createItemInstance(source, `seed-${index}`));
  }

  return {
    currentFloor: 1,
    inventory,
    loadout,
    archetype: "dot",
    run: createInitialRunState(1),
    lastReport: undefined,
    lastBattleSnapshot: undefined,
  };
}

function ensureRunState(
  state: (Omit<GameState, "run"> & { run?: RunState }) | GameState,
): GameState {
  const maybeRun = (state as GameState).run;
  if (maybeRun) {
    return state as GameState;
  }
  const floor = state.currentFloor > 0 ? state.currentFloor : 1;
  return {
    ...state,
    run: createInitialRunState(floor),
  };
}

function isCompatible(item: ItemDef, slot: EquipmentSlot): boolean {
  if (slot === "ring1" || slot === "ring2") {
    return item.slot === "ring1" || item.slot === "ring2";
  }
  return item.slot === slot;
}

function cloneLoadout(loadout: GameState["loadout"]): GameState["loadout"] {
  return {
    weapon: loadout.weapon ? { ...loadout.weapon } : undefined,
    helm: loadout.helm ? { ...loadout.helm } : undefined,
    armor: loadout.armor ? { ...loadout.armor } : undefined,
    ring1: loadout.ring1 ? { ...loadout.ring1 } : undefined,
    ring2: loadout.ring2 ? { ...loadout.ring2 } : undefined,
    core: loadout.core ? { ...loadout.core } : undefined,
    skillIds: [...loadout.skillIds],
  };
}
