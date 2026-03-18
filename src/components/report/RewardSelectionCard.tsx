import type { RunRewardOption } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RewardSelectionCardProps {
  floor: number;
  rewards: RunRewardOption[];
  onSelect: (optionId: string) => void;
}

export function RewardSelectionCard({
  floor,
  rewards,
  onSelect,
}: RewardSelectionCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>战利品抉择（3选1）- 第 {floor} 层</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {rewards.map((option) => (
          <div
            key={option.id}
            className={`rounded-md border p-3 ${
              option.theme === "route"
                ? "border-amber-300/70 bg-amber-50/60"
                : option.theme === "mechanic"
                  ? "border-sky-300/70 bg-sky-50/60"
                  : "border-emerald-300/70 bg-emerald-50/60"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{themeLabel(option.theme)}</Badge>
              {option.routeTag ? <Badge>{option.routeTag}</Badge> : null}
            </div>
            <p className="text-sm font-semibold">{option.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            {summarizeRewardEffect(option).length > 0 ? (
              <div className="mt-2 rounded-md border bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">即时提升</p>
                {summarizeRewardEffect(option).map((line) => (
                  <p key={`${option.id}-${line}`} className="text-xs">
                    - {line}
                  </p>
                ))}
              </div>
            ) : null}
            {option.routeHint ? (
              <p className="mt-1 text-xs text-muted-foreground">路线提示：{option.routeHint}</p>
            ) : null}
            <Button className="mt-3 w-full" size="sm" onClick={() => onSelect(option.id)}>
              选择该奖励
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function themeLabel(theme: RunRewardOption["theme"]): string {
  switch (theme) {
    case "numeric":
      return "数值强化";
    case "mechanic":
      return "机制强化";
    case "route":
      return "路线强化";
    default:
      return "奖励";
  }
}

function summarizeRewardEffect(option: RunRewardOption): string[] {
  const lines: string[] = [];
  const stats = option.effect.stats;
  if (stats) {
    if ((stats.dotPower ?? 0) > 0) {
      lines.push(`DOT伤害 +${Math.round((stats.dotPower ?? 0) * 100)}%`);
    }
    if ((stats.crit ?? 0) > 0) {
      lines.push(`暴击率 +${Math.round((stats.crit ?? 0) * 100)}%`);
    }
    if ((stats.procPower ?? 0) > 0) {
      lines.push(`触发强度 +${Math.round((stats.procPower ?? 0) * 100)}%`);
    }
    if ((stats.resourceRegen ?? 0) > 0) {
      lines.push(`能量回复 +${(stats.resourceRegen ?? 0).toFixed(1)}`);
    }
    if ((stats.hp ?? 0) > 0) {
      lines.push(`生命 +${Math.round(stats.hp ?? 0)}`);
    }
    if ((stats.cdr ?? 0) > 0) {
      lines.push(`冷却缩减 +${Math.round((stats.cdr ?? 0) * 100)}%`);
    }
  }
  if (option.effect.skillUpgrade) {
    lines.push(`强化技能：${option.effect.skillUpgrade.skillId}`);
  }
  if (option.effect.passiveEffect) {
    lines.push(`机制效果：${option.effect.passiveEffect.id}`);
  }
  return lines.slice(0, 3);
}
