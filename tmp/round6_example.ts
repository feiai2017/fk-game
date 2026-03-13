import { aggregateStats } from "../src/core/build/statAggregator";
import { BASE_PLAYER_STATS } from "../src/data/constants";
import { ITEM_BY_ID } from "../src/data/items";
import { RELIC_BY_ID } from "../src/data/relics";
import { SKILL_BY_ID } from "../src/data/skills";
import { TOWER_FLOORS } from "../src/data/tower";
import { runAutoBattle } from "../src/core/battle/simulator";
import { buildBattleReport } from "../src/core/report/reportBuilder";
import { recommendItemForBuild } from "../src/core/build/itemRecommendations";

const loadout = {
  weapon: ITEM_BY_ID["w_bone_knife"],
  helm: ITEM_BY_ID["h_stitched_hood"],
  armor: ITEM_BY_ID["a_scaled_vest"],
  ring1: ITEM_BY_ID["r_dot_band"],
  ring2: ITEM_BY_ID["r_plain_loop"],
  core: RELIC_BY_ID["core_venom_crown"],
  skillIds: ["toxic_lance", "contagion_wave", "rupture_bloom"],
};
const floor = TOWER_FLOORS.find((entry) => entry.floor === 18)!;
const finalStats = aggregateStats(BASE_PLAYER_STATS, loadout as any);
const skills = loadout.skillIds.map((id: string) => SKILL_BY_ID[id]);
const input = { floor, finalStats, skills, loadout: loadout as any, archetype: "dot" as const };

const simulation = runAutoBattle(input);
const report = buildBattleReport({ input, simulation });
const candidateId = report.guidance?.priorityAdjustment.topPriorityCandidateItemId ?? "r_plague_resonator";
const candidateItem = ITEM_BY_ID[candidateId] ?? RELIC_BY_ID[candidateId];
const recommendation = recommendItemForBuild({
  item: candidateItem,
  archetype: "dot",
  loadout: loadout as any,
  lastReport: report,
  floorGuidance: report.guidance?.floorObjective,
  reportCandidateItemIds: report.guidance?.candidateItemIds,
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
    tags: recommendation.tags,
  },
  explanation: report.guidance?.priorityAdjustment.reasoning,
}, null, 2));
