import { useMemo, useState } from "react";
import type { ArchetypeKey, FloorDef, Stats } from "@/core/battle/types";
import { explainSkillForBuild } from "@/core/build/skillExplain";
import { SKILLS, SKILL_BY_ID } from "@/data/skills";
import { SkillDetailCard } from "@/components/build/SkillDetailCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tArchetype } from "@/lib/i18n";

interface SkillPanelProps {
  skillIds: string[];
  archetype: ArchetypeKey;
  finalStats: Stats;
  currentFloor?: FloorDef;
  onSetSkill: (index: number, skillId: string) => void;
}

export function SkillPanel({
  skillIds,
  archetype,
  finalStats,
  currentFloor,
  onSetSkill,
}: SkillPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const detailCards = useMemo(
    () =>
      skillIds
        .map((skillId) => SKILL_BY_ID[skillId])
        .filter(Boolean)
        .map((skill) =>
          explainSkillForBuild({
            skill,
            archetype,
            stats: finalStats,
            floor: currentFloor,
          }),
        ),
    [archetype, currentFloor, finalStats, skillIds],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>主动技能</span>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "收起实战说明" : "展开实战说明"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2].map((slotIndex) => (
          <label key={slotIndex} className="grid gap-1">
            <span className="text-xs text-muted-foreground">槽位 {slotIndex + 1}</span>
            <select
              className="rounded-md border bg-background p-2 text-sm"
              value={skillIds[slotIndex] ?? ""}
              onChange={(event) => onSetSkill(slotIndex, event.target.value)}
            >
              {SKILLS.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name} [{tArchetype(skill.archetype)}]
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">当前构筑倾向</span>
          <Badge variant={archetype === "dot" ? "default" : "secondary"}>持续伤害</Badge>
          <Badge variant={archetype === "crit" ? "default" : "secondary"}>暴击直伤</Badge>
          <Badge variant={archetype === "engine" ? "default" : "secondary"}>资源引擎</Badge>
        </div>
        {expanded ? (
          <div className="space-y-2">
            {detailCards.map((detail) => (
              <SkillDetailCard key={detail.skillId} detail={detail} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
