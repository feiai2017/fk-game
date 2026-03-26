import type { BattleReport } from "@/core/battle/types";
import type { PlaybackViewModel } from "@/core/report/playbackView";
import type { TurnOrderItem } from "@/components/battle/useBattlePresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RunHudBarProps {
  report: BattleReport;
  playback: PlaybackViewModel;
  status: "进行中" | "暂停" | "已结束";
  speed: 1 | 2;
  canPause: boolean;
  onTogglePause: () => void;
  onSetSpeed: (speed: 1 | 2) => void;
  onSkip: () => void;
  secondaryActions?: JSX.Element;
  turnOrder: TurnOrderItem[];
  buildKeywords: string[];
  waveLabel: string;
  roomTypeLabel: string;
}

export function RunHudBar(props: RunHudBarProps): JSX.Element {
  const {
    report,
    playback,
    status,
    speed,
    canPause,
    onTogglePause,
    onSetSpeed,
    onSkip,
    secondaryActions,
    turnOrder,
    buildKeywords,
    waveLabel,
    roomTypeLabel,
  } = props;
  const currentActor = turnOrder.find((item) => item.current) ?? turnOrder[0];

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.93))] px-4 py-3 text-slate-100 shadow-[0_18px_48px_rgba(2,6,23,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-indigo-300/25 bg-indigo-500/20 text-indigo-100" variant="outline">
            第 {report.floor} 层
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-slate-100" variant="outline">
            {waveLabel}
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-slate-100" variant="outline">
            {roomTypeLabel}
          </Badge>
          <Badge variant={status === "进行中" ? "default" : "secondary"}>{status}</Badge>
          <Badge className="border-white/20 bg-white/10 text-slate-100" variant="outline">
            {playback.elapsedLabel}
          </Badge>
          {currentActor ? (
            <Badge
              className={
                currentActor.side === "player"
                  ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                  : "border-rose-300/30 bg-rose-500/20 text-rose-100"
              }
              variant="outline"
            >
              行动中: {currentActor.label}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions ? <div className="mr-1 opacity-90">{secondaryActions}</div> : null}
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
          <Button size="sm" variant="ghost">
            设置
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="uppercase tracking-[0.16em] text-slate-400">本局构筑</span>
        {buildKeywords.length > 0 ? (
          buildKeywords.slice(0, 4).map((keyword) => (
            <Badge key={keyword} variant="outline" className="border-white/20 bg-white/5 text-slate-200">
              {keyword}
            </Badge>
          ))
        ) : (
          <span className="text-slate-400">未识别关键词</span>
        )}
      </div>
    </div>
  );
}

