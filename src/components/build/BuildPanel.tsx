import type { ArchetypeKey, FloorDef, Loadout, Stats } from "@/core/battle/types";
import { ARCHETYPES } from "@/data/archetypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquipmentSlots } from "@/components/build/EquipmentSlots";
import { SkillPanel } from "@/components/build/SkillPanel";
import { formatPercent } from "@/lib/format";

interface BuildPanelProps {
  archetype: ArchetypeKey;
  loadout: Loadout;
  finalStats: Stats;
  currentFloor?: FloorDef;
  loadoutIssues: string[];
  onUnequip: (slot: keyof Omit<Loadout, "skillIds">) => void;
  onSetArchetype: (key: ArchetypeKey) => void;
  onSetSkill: (index: number, skillId: string) => void;
}

export function BuildPanel({
  archetype,
  loadout,
  finalStats,
  currentFloor,
  loadoutIssues,
  onUnequip,
  onSetArchetype,
  onSetSkill,
}: BuildPanelProps): JSX.Element {
  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle>流派选择</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {ARCHETYPES.map((entry) => (
            <button
              type="button"
              key={entry.key}
              onClick={() => onSetArchetype(entry.key)}
              className={`rounded-md border p-3 text-left ${
                archetype === entry.key ? "border-primary bg-primary/10" : "bg-background"
              }`}
            >
              <p className="text-sm font-semibold">{entry.name}</p>
              <p className="text-xs text-muted-foreground">{entry.summary}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>技能搭配建议</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {recommendedCombos(archetype).map((hint) => (
            <p key={hint}>- {hint}</p>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <EquipmentSlots loadout={loadout} onUnequip={onUnequip} />
        <SkillPanel
          skillIds={loadout.skillIds}
          archetype={archetype}
          finalStats={finalStats}
          currentFloor={currentFloor}
          onSetSkill={onSetSkill}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最终属性</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Stat label="生命" value={Math.round(finalStats.hp)} />
          <Stat label="攻击" value={Math.round(finalStats.atk)} />
          <Stat label="防御" value={Math.round(finalStats.def)} />
          <Stat label="攻速" value={finalStats.speed.toFixed(2)} />
          <Stat label="暴击率" value={formatPercent(finalStats.crit)} />
          <Stat label="暴伤" value={formatPercent(finalStats.critDamage)} />
          <Stat label="持续伤害加成" value={formatPercent(finalStats.dotPower)} />
          <Stat label="触发伤害加成" value={formatPercent(finalStats.procPower)} />
          <Stat label="冷却缩减" value={formatPercent(finalStats.cdr)} />
          <Stat label="抗性" value={formatPercent(finalStats.resist)} />
          <Stat label="资源上限" value={Math.round(finalStats.resourceMax)} />
          <Stat label="资源回复" value={finalStats.resourceRegen.toFixed(1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>构筑检查</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadoutIssues.length === 0 ? (
            <Badge>可挑战</Badge>
          ) : (
            loadoutIssues.map((issue) => (
              <div key={issue} className="flex items-center justify-between rounded-md border p-2">
                <p className="text-sm">{issue}</p>
                <Button size="sm" variant="ghost" disabled>
                  请在构筑页调整
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function recommendedCombos(archetype: ArchetypeKey): string[] {
  switch (archetype) {
    case "dot":
      return [
        "毒蚀穿刺 + 传染波 + 裂蚀绽放（先铺层再引爆）",
        "优先保证DOT覆盖，再找引爆窗口",
      ];
    case "crit":
      return [
        "精准狙击 + 弹射刃轮 + 处决印记（压血后收割）",
        "终结技能留到目标低血窗口释放",
      ];
    case "engine":
      return [
        "火花转换 + 超频回路 + 反应堆激涌（回能-触发循环）",
        "避免频繁溢出，保持消耗节奏触发词条",
      ];
    default:
      return ["选择同流派技能可获得更稳定的循环。"];
  }
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
