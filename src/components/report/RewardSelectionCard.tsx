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
        <CardTitle>胜利奖励（三选一）- 第 {floor} 层</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">
        {rewards.map((option) => (
          <div key={option.id} className="rounded-md border bg-background p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{categoryLabel(option.category)}</Badge>
              <p className="text-sm font-semibold">{option.title}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            <Button className="mt-2 w-full" size="sm" onClick={() => onSelect(option.id)}>
              选择此奖励
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function categoryLabel(category: RunRewardOption["category"]): string {
  switch (category) {
    case "stat_bonus":
      return "属性";
    case "skill_upgrade":
      return "技能强化";
    case "passive_modifier":
      return "被动";
    case "relic_pick":
      return "遗物";
    default:
      return category;
  }
}
