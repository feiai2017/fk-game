import { Link } from "react-router-dom";
import { useMemo } from "react";
import { BuildPanel } from "@/components/build/BuildPanel";
import { BuildComparisonCard } from "@/components/build/BuildComparisonCard";
import { BuildProfileCard } from "@/components/build/BuildProfileCard";
import { FloorTuningCard } from "@/components/build/FloorTuningCard";
import { InventoryPanel } from "@/components/build/InventoryPanel";
import type { ArchetypeKey, Loadout } from "@/core/battle/types";
import { compareBuildProfiles, estimateBuildProfile } from "@/core/build/profile";
import { aggregateStats } from "@/core/build/statAggregator";
import { buildFloorPreviewGuidance } from "@/core/report/guidance";
import { BASE_PLAYER_STATS } from "@/data/constants";
import { SKILL_BY_ID } from "@/data/skills";
import { TOWER_FLOORS } from "@/data/tower";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameState } from "@/hooks/useGameState";

export function BuildPage(): JSX.Element {
  const {
    state,
    finalStats,
    selectedSkills,
    loadoutIssues,
    equipFromInventory,
    unequip,
    setSkillId,
    setArchetype,
  } = useGameState();

  const currentSignature = useMemo(
    () => buildSignature(state.archetype, state.loadout),
    [state.archetype, state.loadout],
  );
  const lastSnapshotSignature = useMemo(
    () =>
      state.lastBattleSnapshot
        ? buildSignature(state.lastBattleSnapshot.archetype, state.lastBattleSnapshot.loadout)
        : undefined,
    [state.lastBattleSnapshot],
  );
  const currentFloorDef = useMemo(
    () => TOWER_FLOORS.find((entry) => entry.floor === state.run.currentFloor),
    [state.run.currentFloor],
  );
  const floorAwareGuidance = useMemo(() => {
    if (!currentFloorDef) {
      return undefined;
    }
    const useLastReportForFloor = state.lastReport && state.lastReport.floor === currentFloorDef.floor;
    return buildFloorPreviewGuidance({
      floor: currentFloorDef,
      archetype: state.archetype,
      loadout: state.loadout,
      metrics: useLastReportForFloor ? state.lastReport?.metrics : undefined,
      diagnosis: useLastReportForFloor ? state.lastReport?.diagnosis : undefined,
    });
  }, [currentFloorDef, state.archetype, state.lastReport, state.loadout]);

  const currentProfile = useMemo(
    () =>
      estimateBuildProfile({
        archetype: state.archetype,
        finalStats,
        loadout: state.loadout,
        skills: selectedSkills,
        lastReport: state.lastReport && currentSignature === lastSnapshotSignature ? state.lastReport : undefined,
      }),
    [currentSignature, finalStats, lastSnapshotSignature, selectedSkills, state],
  );

  const baselineProfile = useMemo(() => {
    if (!state.lastBattleSnapshot) {
      return undefined;
    }
    const snapshotSkills = state.lastBattleSnapshot.loadout.skillIds
      .map((skillId) => SKILL_BY_ID[skillId])
      .filter(Boolean);
    const snapshotStats = aggregateStats(BASE_PLAYER_STATS, state.lastBattleSnapshot.loadout);

    return estimateBuildProfile({
      archetype: state.lastBattleSnapshot.archetype,
      finalStats: snapshotStats,
      loadout: state.lastBattleSnapshot.loadout,
      skills: snapshotSkills,
      lastReport: state.lastReport,
    });
  }, [state.lastBattleSnapshot, state.lastReport]);

  const comparisonHints = useMemo(() => {
    if (!baselineProfile || !lastSnapshotSignature || currentSignature === lastSnapshotSignature) {
      return [];
    }
    return compareBuildProfiles(baselineProfile, currentProfile);
  }, [baselineProfile, currentProfile, currentSignature, lastSnapshotSignature]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>构筑完成后即可挑战</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">当前可挑战层：{state.run.currentFloor}</p>
          <p className="text-sm text-muted-foreground">跑局状态：{state.run.status}</p>
          <Button asChild size="sm">
            <Link to="/tower">前往爬塔</Link>
          </Button>
        </CardContent>
      </Card>

      <BuildProfileCard profile={currentProfile} />
      {floorAwareGuidance && currentFloorDef ? (
        <FloorTuningCard floor={currentFloorDef.floor} guidance={floorAwareGuidance} />
      ) : null}
      {baselineProfile ? <BuildComparisonCard hints={comparisonHints} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <BuildPanel
          archetype={state.archetype}
          loadout={state.loadout}
          finalStats={finalStats}
          currentFloor={currentFloorDef}
          loadoutIssues={loadoutIssues}
          onUnequip={unequip}
          onSetArchetype={setArchetype}
          onSetSkill={setSkillId}
        />
        <InventoryPanel
          inventory={state.inventory}
          archetype={state.archetype}
          loadout={state.loadout}
          lastReport={state.lastReport}
          floorGuidance={floorAwareGuidance?.floorObjective}
          reportCandidateItemIds={floorAwareGuidance?.candidateItemIds ?? state.lastReport?.guidance?.candidateItemIds}
          onEquip={equipFromInventory}
        />
      </div>
    </div>
  );
}

function buildSignature(archetype: ArchetypeKey, loadout: Loadout): string {
  const slots = ["weapon", "helm", "armor", "ring1", "ring2", "core"] as const;
  const equipped = slots
    .map((slot) => loadout[slot]?.id ?? "none")
    .join("|");
  return `${archetype}:${equipped}:${loadout.skillIds.join("|")}`;
}
