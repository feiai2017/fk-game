import { aggregateStats } from "../src/core/build/statAggregator";
import { runAutoBattle } from "../src/core/battle/simulator";
import { buildBattleReport } from "../src/core/report/reportBuilder";
import { BASE_PLAYER_STATS } from "../src/data/constants";
import { ITEM_BY_ID } from "../src/data/items";
import { RELIC_BY_ID } from "../src/data/relics";
import { SKILL_BY_ID } from "../src/data/skills";
import { TOWER_FLOORS } from "../src/data/tower";

const floor = TOWER_FLOORS.find((f) => f.floor === 7)!;
const loadout = {
  weapon: ITEM_BY_ID["w_serrated_reaper"],
  helm: ITEM_BY_ID["h_stitched_hood"],
  armor: ITEM_BY_ID["a_scaled_vest"],
  ring1: ITEM_BY_ID["r_dot_band"],
  ring2: ITEM_BY_ID["r_plague_resonator"],
  core: RELIC_BY_ID["core_spore_hive"],
  skillIds: ["toxic_lance", "contagion_wave", "rupture_bloom"],
};
const skills = loadout.skillIds.map((id) => SKILL_BY_ID[id]);
const finalStats = aggregateStats(BASE_PLAYER_STATS, loadout as any);

const runCount = 50;
let wins = 0;
let totalFirstKill = 0;
let firstKillCount = 0;
let totalRemain = 0;
let totalTaken = 0;
let totalDuration = 0;
let failDuration = 0;
let failCount = 0;
let totalDotRatio = 0;
let totalProcRatio = 0;
let totalDirectRatio = 0;

const sourceTotal = new Map<string, number>();
for (let i = 0; i < runCount; i += 1) {
  const input = {
    floor,
    finalStats,
    skills,
    loadout: loadout as any,
    archetype: "dot" as const,
    seedTag: `before-${i}`,
  };
  const sim = runAutoBattle(input);
  const report = buildBattleReport({ input, simulation: sim });

  if (report.win) wins += 1;
  totalRemain += report.metrics.enemyRemainingHpRatio;
  totalTaken += report.metrics.damageTaken;
  totalDuration += report.metrics.duration;
  totalDotRatio += report.metrics.dotDamageRatio;
  totalProcRatio += report.metrics.procDamageRatio;
  totalDirectRatio += report.metrics.directDamageRatio;

  if (report.metrics.firstKillTime !== null) {
    totalFirstKill += report.metrics.firstKillTime;
    firstKillCount += 1;
  }
  if (!report.win) {
    failCount += 1;
    failDuration += report.metrics.duration;
  }

  for (const entry of report.metrics.damageBySource) {
    sourceTotal.set(entry.sourceName, (sourceTotal.get(entry.sourceName) ?? 0) + entry.total);
  }
}

const topSources = [...sourceTotal.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, total]) => ({ name, total: total / runCount }));

console.log(JSON.stringify({
  mode: "before",
  runCount,
  winRate: wins / runCount,
  avgFirstKillTime: firstKillCount > 0 ? totalFirstKill / firstKillCount : null,
  avgEnemyRemainingHpRatio: totalRemain / runCount,
  avgDamageTaken: totalTaken / runCount,
  avgDuration: totalDuration / runCount,
  avgFailDuration: failCount > 0 ? failDuration / failCount : null,
  avgDotRatio: totalDotRatio / runCount,
  avgProcRatio: totalProcRatio / runCount,
  avgDirectRatio: totalDirectRatio / runCount,
  topSources,
}, null, 2));
