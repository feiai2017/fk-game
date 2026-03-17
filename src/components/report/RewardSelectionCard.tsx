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
        <CardTitle>胜利奖励（3选1）- 第 {floor} 层</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {rewards.map((option) => (
          <div key={option.id} className="rounded-md border bg-background p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{themeLabel(option.theme)}</Badge>
              {option.routeTag ? <Badge>{option.routeTag}</Badge> : null}
            </div>
            <p className="text-sm font-semibold">{option.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
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
