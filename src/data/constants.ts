import type { Stats } from "@/core/battle/types";

export const APP_VERSION = "0.1.0";

export const BASE_PLAYER_STATS: Stats = {
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
  resourceRegen: 6,
};

export const DEFAULT_SKILL_IDS = [
  "toxic_lance",
  "contagion_wave",
  "rupture_bloom",
];

export const STARTING_INVENTORY_IDS = [
  "w_bone_knife",
  "h_stitched_hood",
  "a_scaled_vest",
  "r_dot_band",
  "r_plain_loop",
  "core_venom_crown",
  "w_marksman_bow",
  "w_flux_pistol",
  "r_crit_band",
  "r_engine_loop",
];

export const TOTAL_TOWER_FLOORS = 20;
export const DEMO_RUN_TARGET_FLOOR = 10;
export const MAX_BATTLE_DURATION = 90;
export const SIMULATION_TICK = 0.1;
export const ENEMY_ATTACK_INTERVAL = 1.6;
