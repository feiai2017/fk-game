import { useMemo, useState } from "react";
import type { BattleReport, CombatEvent, CombatEventCategory } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CombatLogPanelProps {
  report: BattleReport;
}

type EventFilter = "all" | CombatEventCategory;

const FILTER_OPTIONS: Array<{ key: EventFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "offense", label: "进攻" },
  { key: "defense", label: "防御" },
  { key: "resource", label: "资源" },
  { key: "danger", label: "危险" },
  { key: "system", label: "系统" },
];

export function CombatLogPanel({ report }: CombatLogPanelProps): JSX.Element {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [preDeathOnly, setPreDeathOnly] = useState(false);
  const events = report.combatEvents ?? [];

  const deathTime = useMemo(
    () => events.find((event) => event.type === "PLAYER_DEATH")?.time,
    [events],
  );

  const visibleEvents = useMemo(() => {
    if (events.length === 0) {
      return [];
    }
    return events.filter((event) => {
      const byFilter = filter === "all" ? true : event.category === filter;
      if (!byFilter) {
        return false;
      }
      if (!preDeathOnly || deathTime === undefined) {
        return true;
      }
      return event.time >= Math.max(0, deathTime - 8) && event.time <= deathTime;
    });
  }, [deathTime, events, filter, preDeathOnly]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>详细战斗事件（调试）</span>
          {deathTime !== undefined ? (
            <Button
              size="sm"
              variant={preDeathOnly ? "default" : "secondary"}
              onClick={() => setPreDeathOnly((value) => !value)}
            >
              {preDeathOnly ? "显示全程" : "聚焦死亡前8秒"}
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((option) => (
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
        {events.length === 0 ? (
          <div className="max-h-[320px] space-y-1 overflow-auto rounded-md border bg-background p-2">
            {report.combatLog.map((line, index) => (
              <p key={`${line}-${index}`} className="font-mono text-xs">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="max-h-[360px] space-y-1 overflow-auto rounded-md border bg-background p-2">
            {visibleEvents.map((event, index) => (
              <TimelineLine key={`${event.time}-${event.type}-${index}`} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineLine({ event }: { event: CombatEvent }): JSX.Element {
  const badgeVariant =
    event.category === "danger"
      ? "default"
      : event.category === "resource"
        ? "secondary"
        : "outline";

  return (
    <div
      className={`grid grid-cols-[56px_72px_1fr] items-start gap-2 rounded px-1 py-0.5 text-xs ${
        event.category === "danger" ? "bg-destructive/10" : ""
      }`}
    >
      <span className="font-mono text-muted-foreground">{event.time.toFixed(1)}s</span>
      <Badge variant={badgeVariant} className="h-5 px-1.5 text-[10px]">
        {labelForCategory(event.category)}
      </Badge>
      <span>{event.summary}</span>
    </div>
  );
}

function labelForCategory(category: CombatEventCategory): string {
  switch (category) {
    case "offense":
      return "进攻";
    case "defense":
      return "防御";
    case "resource":
      return "资源";
    case "danger":
      return "危险";
    case "system":
    default:
      return "系统";
  }
}
