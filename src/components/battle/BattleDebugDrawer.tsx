import { useState } from "react";
import type { BattleTimelineEntry } from "@/core/battle/types";
import type { TurnOrderItem } from "@/components/battle/useBattlePresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BattleDebugDrawerProps {
  detailFeed: BattleTimelineEntry[];
  turnOrder: TurnOrderItem[];
}

export function BattleDebugDrawer({ detailFeed, turnOrder }: BattleDebugDrawerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-950/55">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-semibold text-slate-100">战斗调试面板（折叠）</p>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? "收起" : "展开"}
        </Button>
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-white/10 p-3 lg:grid-cols-[260px_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">行动序列</p>
            <div className="space-y-1">
              {turnOrder.map((entry) => (
                <div
                  key={entry.key}
                  className={`rounded px-2 py-1 text-xs ${
                    entry.current
                      ? entry.side === "player"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "bg-rose-500/20 text-rose-100"
                      : "bg-white/5 text-slate-300"
                  }`}
                >
                  {entry.label}
                </div>
              ))}
            </div>
          </div>

          <div className="max-h-[300px] overflow-auto rounded-lg border border-white/10 bg-white/5 p-2">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">关键日志</p>
            <div className="space-y-1">
              {detailFeed.length > 0 ? (
                detailFeed.map((entry, index) => (
                  <div key={`${entry.time}-${entry.typeLabel}-${index}`} className="grid grid-cols-[58px_62px_1fr] gap-2 text-xs">
                    <span className="font-mono text-slate-400">{entry.timeLabel}</span>
                    <Badge variant={badgeVariant(entry.severity)} className="h-5 px-1.5 text-[10px]">
                      {entry.typeLabel}
                    </Badge>
                    <span className="text-slate-100">{entry.text}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">暂无可展示日志</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function badgeVariant(severity: "normal" | "warning" | "critical"): "default" | "secondary" | "outline" {
  if (severity === "critical") return "default";
  if (severity === "warning") return "secondary";
  return "outline";
}

