import type { BattleReport } from "@/core/battle/types";
import type { PlaybackViewModel } from "@/core/report/playbackView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";

interface InBattleScreenProps {
  report: BattleReport;
  playback: PlaybackViewModel;
  status: "进行中" | "暂停" | "已结束";
  speed: 1 | 2;
  canPause: boolean;
  onTogglePause: () => void;
  onSetSpeed: (speed: 1 | 2) => void;
  onSkip: () => void;
}

export function InBattleScreen(props: InBattleScreenProps): JSX.Element {
  const {
    report,
    playback,
    status,
    speed,
    canPause,
    onTogglePause,
    onSetSpeed,
    onSkip,
  } = props;

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>第 {report.floor} 层</Badge>
            <Badge variant="outline">时间 {playback.elapsedLabel}</Badge>
            <Badge variant="outline">状态：{status}</Badge>
            <Badge variant="outline">{playback.phaseLabel}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={speed === 1 ? "default" : "secondary"} onClick={() => onSetSpeed(1)}>
              1x
            </Button>
            <Button size="sm" variant={speed === 2 ? "default" : "secondary"} onClick={() => onSetSpeed(2)}>
              2x
            </Button>
            <Button size="sm" variant="secondary" onClick={onTogglePause}>
              {canPause ? "暂停" : "继续"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSkip}>
              跳过演出
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>战斗主舞台</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-semibold">我方</p>
              <p className="text-xs text-muted-foreground">{report.context?.archetype ?? "build"}</p>
              <BarRow label="HP" ratio={playback.playerHpRatio} text={`${formatNumber(playback.playerHp)}`} />
              <BarRow
                label="护盾"
                ratio={Math.min(1, playback.playerShield / Math.max(1, report.context?.finalStats.hp ?? 1))}
                text={formatNumber(playback.playerShield)}
                tone="defense"
              />
              <BarRow
                label="能量"
                ratio={Math.min(1, playback.playerEnergy / Math.max(1, report.context?.finalStats.resourceMax ?? 1))}
                text={formatNumber(playback.playerEnergy)}
                tone="resource"
              />
              <p className="mt-2 text-xs text-muted-foreground">状态：{playback.playerStateLabel}</p>
              {report.context?.archetype === "dot" ? (
                <div className="mt-2 space-y-2 rounded border border-emerald-300/50 bg-emerald-50/60 p-2">
                  <p className="text-xs">
                    DOT阶段：
                    <span className={playback.dotStageHighlighted ? "font-semibold text-emerald-700" : "text-emerald-700"}>
                      {` ${playback.dotStageLabel}`}
                    </span>
                  </p>
                  <BarRow
                    label="引爆准备度"
                    ratio={playback.dotBurstReadiness}
                    text={formatPercent(playback.dotBurstReadiness)}
                    tone={playback.dotStageHighlighted ? "highlight" : "resource"}
                  />
                  <p className="text-xs">DOT累计伤害：{formatNumber(playback.dotAccumulatedDamage)}</p>
                  {playback.dotWindowHint ? (
                    <p
                      className={`text-xs ${
                        playback.dotStageHighlighted ? "font-semibold text-amber-700" : "text-muted-foreground"
                      }`}
                    >
                      {playback.dotWindowHint}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-semibold">敌方</p>
              <p className="text-xs text-muted-foreground">
                {playback.isBossFight ? "首领战" : "普通战"} · 主目标：{playback.mainTargetLabel}
              </p>
              <BarRow label="敌方血量池" ratio={playback.enemyHpRatio} text={formatPercent(playback.enemyHpRatio)} />
              <BarRow
                label="敌方护盾"
                ratio={Math.min(1, playback.enemyShield / Math.max(1, report.context?.floor.enemyHp ?? 1))}
                text={formatNumber(playback.enemyShield)}
                tone="defense"
              />
              {report.context?.archetype === "dot" ? (
                <div className="mt-2 rounded border border-emerald-200/60 bg-emerald-50/50 p-2 text-xs">
                  <p>主目标DOT层数：{playback.targetDotStacks}</p>
                  <p className={playback.dotStageHighlighted ? "font-semibold text-emerald-700" : "text-muted-foreground"}>
                    持续压力：{playback.dotPressureLabel}
                  </p>
                </div>
              ) : null}
              <p className="mt-1 text-xs">剩余敌人数：{playback.enemyAliveCount}</p>
              <p className="text-xs">召唤物数量：{playback.summonCount}</p>
              <p className="text-xs text-muted-foreground">状态：{playback.enemyStateLabel}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>战斗播报</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-1 overflow-auto rounded-md border bg-background p-2">
              {playback.visibleEvents.length > 0 ? (
                playback.visibleEvents.map((entry, index) => {
                  const isLatest = index === playback.visibleEvents.length - 1;
                  return (
                    <div
                      key={`${entry.time}-${entry.typeLabel}-${index}`}
                      className={`grid grid-cols-[48px_56px_1fr] items-start gap-2 rounded px-1 py-0.5 text-xs ${
                        isLatest ? "bg-emerald-100/70" : ""
                      }`}
                    >
                      <span className="font-mono text-muted-foreground">{entry.timeLabel}</span>
                      <Badge variant={badgeVariant(entry.severity)} className="h-5 px-1.5 text-[10px]">
                        {entry.typeLabel}
                      </Badge>
                      <span>{entry.text}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">等待战斗事件...</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              进度：{formatSeconds(playback.elapsed)} / {formatSeconds(report.metrics.duration)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BarRow(props: {
  label: string;
  ratio: number;
  text: string;
  tone?: "hp" | "defense" | "resource" | "highlight";
}): JSX.Element {
  const ratio = Math.max(0, Math.min(1, props.ratio));
  const tone = props.tone ?? "hp";
  const colorClass =
    tone === "defense"
      ? "bg-sky-500"
      : tone === "resource"
        ? "bg-violet-500"
        : tone === "highlight"
          ? "bg-amber-500"
          : "bg-emerald-500";

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span>{props.label}</span>
        <span>{props.text}</span>
      </div>
      <div className="h-2 rounded bg-muted">
        <div className={`h-2 rounded ${colorClass}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function badgeVariant(severity: "normal" | "warning" | "critical"): "default" | "secondary" | "outline" {
  if (severity === "critical") {
    return "default";
  }
  if (severity === "warning") {
    return "secondary";
  }
  return "outline";
}
