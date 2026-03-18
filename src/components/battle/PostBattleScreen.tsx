import type { BattleReport, RunRewardOption } from "@/core/battle/types";
import { BattleRecapCard } from "@/components/report/BattleRecapCard";
import { KeyTimelineCard } from "@/components/report/KeyTimelineCard";
import { RewardSelectionCard } from "@/components/report/RewardSelectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatSeconds } from "@/lib/format";

interface PostBattleScreenProps {
  report: BattleReport;
  rewardPending: boolean;
  pendingRewards?: RunRewardOption[];
  rewardNote: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onSelectReward: (optionId: string) => void;
  onRetry: () => void;
  onBackBuild: () => void;
  onPrepareNext: () => void;
  onOpenRunSummary: () => void;
  runEnded: boolean;
}

export function PostBattleScreen(props: PostBattleScreenProps): JSX.Element {
  const {
    report,
    rewardPending,
    pendingRewards,
    rewardNote,
    showDetails,
    onToggleDetails,
    onSelectReward,
    onRetry,
    onBackBuild,
    onPrepareNext,
    onOpenRunSummary,
    runEnded,
  } = props;

  const conclusion = report.recap?.reasonSummary ?? (report.win ? "本层通关。" : "本层失败。请调整后再试。");
  const failReason = report.win ? undefined : report.recap?.keyWinOrFailPoint ?? report.diagnosis[0]?.message;
  const nextActionText = !report.win
    ? "建议先补前中段稳定性，再快速重开验证。"
    : rewardPending
      ? "请选择1个战利品，强化后再进入下一层。"
      : runEnded
        ? "已到达短程演示终点，查看本局结算。"
        : "准备进入下一层，延续当前节奏。";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl font-bold">{report.win ? "胜利" : "失败"}</span>
            <Badge variant={report.win ? "default" : "outline"}>第 {report.floor} 层</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div
            className={`rounded-md border p-2 ${
              report.win ? "border-emerald-300/70 bg-emerald-50/60" : "border-rose-300/70 bg-rose-50/60"
            }`}
          >
            <p className="text-xs text-muted-foreground">下一步</p>
            <p className="font-semibold">{nextActionText}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <MiniStat label={report.win ? "战斗时长" : "坚持时间"} value={formatSeconds(report.metrics.duration)} />
            <MiniStat label="总伤害" value={formatNumber(report.metrics.totalDamage)} />
            <MiniStat label="结果要点" value={report.win ? "成功压过本层机制" : "关键窗口处理失败"} />
          </div>

          <div className="rounded-md border bg-background p-2">
            <p className="font-semibold">关键结论：{conclusion}</p>
            {failReason ? <p className="mt-1 text-muted-foreground">失败原因：{failReason}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {!report.win ? (
              <>
                <Button onClick={onRetry}>重开一局</Button>
                <Button variant="secondary" onClick={onBackBuild}>返回构筑</Button>
              </>
            ) : rewardPending ? (
              <Badge variant="secondary">请先选择奖励，再进入下一层。</Badge>
            ) : runEnded ? (
              <Button onClick={onOpenRunSummary}>查看结算</Button>
            ) : (
              <>
                <Button onClick={onPrepareNext}>进入下一层准备</Button>
                <Button variant="secondary" onClick={onBackBuild}>返回构筑</Button>
              </>
            )}

            <Button variant="ghost" onClick={onToggleDetails}>
              {showDetails ? "收起详细复盘" : "查看详细复盘"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rewardPending && report.win && pendingRewards ? (
        <RewardSelectionCard floor={report.floor} rewards={pendingRewards} onSelect={onSelectReward} />
      ) : null}

      {showDetails ? (
        <div className="grid gap-4">
          {report.recap ? <BattleRecapCard recap={report.recap} rewardNote={rewardNote} /> : null}
          {report.timeline && report.timeline.length > 0 ? (
            <KeyTimelineCard
              entries={report.timeline}
              deathTime={report.combatEvents?.find((event) => event.type === "PLAYER_DEATH")?.time}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
