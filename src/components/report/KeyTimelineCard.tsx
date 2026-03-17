import { useMemo, useState } from "react";
import type { BattleTimelineEntry, CombatEventCategory } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeyTimelineCardProps {
  entries: BattleTimelineEntry[];
  deathTime?: number;
}

type TimelineFilter = "all" | CombatEventCategory;

const FILTERS: Array<{ key: TimelineFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "offense", label: "进攻" },
  { key: "defense", label: "防御" },
  { key: "resource", label: "资源" },
  { key: "danger", label: "危险" },
  { key: "system", label: "系统" },
];

export function KeyTimelineCard({ entries, deathTime }: KeyTimelineCardProps): JSX.Element {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [focusPreDeath, setFocusPreDeath] = useState(false);

  const visible = useMemo(() => {
    if (entries.length === 0) {
      return [];
    }
    return entries.filter((entry) => {
      if (filter !== "all" && entry.category !== filter) {
        return false;
      }
      if (!focusPreDeath || deathTime === undefined) {
        return true;
      }
      return entry.time >= Math.max(0, deathTime - 10) && entry.time <= deathTime;
    });
  }, [deathTime, entries, filter, focusPreDeath]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>战斗关键事件时间轴</span>
          {deathTime !== undefined ? (
            <Button
              size="sm"
              variant={focusPreDeath ? "default" : "secondary"}
              onClick={() => setFocusPreDeath((value) => !value)}
            >
              {focusPreDeath ? "显示全程" : "聚焦失败前10秒"}
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={filter === option.key ? "default" : "secondary"}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            暂无可展示的关键事件。
          </p>
        ) : (
          <div className="max-h-[360px] space-y-1 overflow-auto rounded-md border bg-background p-2">
            {visible.map((entry, index) => (
              <div
                key={`${entry.time}-${entry.typeLabel}-${index}`}
                className={`grid grid-cols-[52px_70px_1fr] items-start gap-2 rounded px-1 py-0.5 text-xs ${
                  entry.severity === "critical"
                    ? "bg-destructive/10"
                    : entry.severity === "warning"
                      ? "bg-amber-100/60"
                      : ""
                }`}
              >
                <span className="font-mono text-muted-foreground">{entry.timeLabel}</span>
                <Badge variant={badgeVariant(entry.severity)} className="h-5 px-1.5 text-[10px]">
                  {entry.typeLabel}
                </Badge>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function badgeVariant(severity: BattleTimelineEntry["severity"]): "default" | "secondary" | "outline" {
  if (severity === "critical") {
    return "default";
  }
  if (severity === "warning") {
    return "secondary";
  }
  return "outline";
}
