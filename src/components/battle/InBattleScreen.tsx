import type { BattleReport } from "@/core/battle/types";
import type { PlaybackViewModel } from "@/core/report/playbackView";
import { BattlefieldStage } from "@/components/battle/BattlefieldStage";
import { BattleDebugDrawer } from "@/components/battle/BattleDebugDrawer";
import { CombatBottomBar } from "@/components/battle/CombatBottomBar";
import { RunHudBar } from "@/components/battle/RunHudBar";
import {
  derivePriorityStatusBadges,
  useBattlePresentation,
} from "@/components/battle/useBattlePresentation";
import { formatPercent, formatSeconds } from "@/lib/format";

interface InBattleScreenProps {
  report: BattleReport;
  playback: PlaybackViewModel;
  status: "进行中" | "暂停" | "已结束";
  speed: 1 | 2;
  canPause: boolean;
  onTogglePause: () => void;
  onSetSpeed: (speed: 1 | 2) => void;
  onSkip: () => void;
  secondaryActions?: JSX.Element;
}

export function InBattleScreen(props: InBattleScreenProps): JSX.Element {
  const { report, playback, status, speed, canPause, onTogglePause, onSetSpeed, onSkip, secondaryActions } = props;
  const presentation = useBattlePresentation({ report, playback, speed });

  const playerStatuses = derivePriorityStatusBadges(
    [
      playback.playerStateLabel,
      playback.dotStageLabel,
      playback.dotWindowHint ?? "",
      playback.stageAlert ?? "",
      playback.dotStageHighlighted ? "引爆窗口" : "",
      presentation.activeAction.actorSide === "player" ? "当前行动者" : "",
      presentation.activeAction.targetSide === "player" ? "当前目标" : "",
    ],
    5,
  );

  const keywords = buildKeywords(report, playback);
  const waveLabel = deriveWaveLabel(report);
  const roomTypeLabel = deriveRoomTypeLabel(report);

  return (
    <div className="space-y-4">
      <RunHudBar
        report={report}
        playback={playback}
        status={status}
        speed={speed}
        canPause={canPause}
        onTogglePause={onTogglePause}
        onSetSpeed={onSetSpeed}
        onSkip={onSkip}
        secondaryActions={secondaryActions}
        turnOrder={presentation.turnOrder}
        buildKeywords={keywords}
        waveLabel={waveLabel}
        roomTypeLabel={roomTypeLabel}
      />

      <BattlefieldStage
        player={{
          name: resolveArchetypeName(report),
          hpCurrent: playback.playerHp,
          hpMax: report.context?.finalStats.hp ?? 1,
          shieldCurrent: playback.playerShield,
          shieldMax: report.context?.finalStats.hp ?? 1,
          energyCurrent: playback.playerEnergy,
          energyMax: report.context?.finalStats.resourceMax ?? 1,
          statuses: playerStatuses.visible,
          extraStatusCount: playerStatuses.overflow,
        }}
        enemyUnits={presentation.enemyUnits}
        activeAction={presentation.activeAction}
        actionLinks={presentation.actionLinks}
        floatingTexts={presentation.floatingTexts}
      />

      <CombatBottomBar
        report={report}
        playback={playback}
        elapsed={playback.elapsed}
        activeSkillId={presentation.activeAction.activeSkillId}
        recommendedSkillId={presentation.recommendedSkillId}
        buildKeywords={keywords}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <QuickMetric label="战斗进度" value={`${formatSeconds(playback.elapsed)} / ${formatSeconds(report.metrics.duration)}`} />
        <QuickMetric
          label="首杀进度"
          value={report.metrics.firstKillTime !== null && playback.elapsed >= report.metrics.firstKillTime ? "已完成" : "未完成"}
        />
        <QuickMetric label="剩余敌人数" value={String(playback.enemyAliveCount)} />
        <QuickMetric label="召唤物数量" value={String(playback.summonCount)} />
        <QuickMetric label="危险提示" value={playback.enemyPressureReason} />
      </div>

      <BattleDebugDrawer detailFeed={presentation.detailFeed} turnOrder={presentation.turnOrder} />
    </div>
  );
}

function QuickMetric(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-900/65 px-3 py-2 text-xs text-slate-100">
      <p className="mb-1 uppercase tracking-[0.16em] text-slate-400">{props.label}</p>
      <p className="font-semibold">{props.value}</p>
    </div>
  );
}

function resolveArchetypeName(report: BattleReport): string {
  if (report.context?.archetype === "dot") {
    return "腐蚀构筑";
  }
  if (report.context?.archetype === "crit") {
    return "处决构筑";
  }
  return "回路引擎";
}

function deriveRoomTypeLabel(report: BattleReport): string {
  if (report.context?.floor.boss) {
    return "Boss房";
  }
  const count = report.context?.floor.enemyCount ?? 1;
  if (count >= 4) return "群压房";
  if (count >= 2) return "精英房";
  return "普通房";
}

function deriveWaveLabel(report: BattleReport): string {
  const waveCount = report.context?.floor.enemyConfig?.length ?? 1;
  if (waveCount <= 1) {
    return "第 1 波 / 共 1 波";
  }
  return `第 1 波 / 共 ${waveCount} 波`;
}

function buildKeywords(report: BattleReport, playback: PlaybackViewModel): string[] {
  const rows: string[] = [];
  rows.push(resolveArchetypeName(report));
  if (report.context?.archetype === "dot") {
    rows.push("铺毒");
    rows.push("扩散");
    rows.push("引爆");
    rows.push(playback.dotStageLabel);
    if (playback.dotStageHighlighted) {
      rows.push("爆发窗口");
    }
  } else if (report.context?.archetype === "crit") {
    rows.push("暴击");
    rows.push("收割");
  } else {
    rows.push("资源循环");
    rows.push("触发兑现");
  }
  rows.push(`DOT占比 ${formatPercent(report.metrics.dotDamageRatio)}`);
  rows.push(`普攻占比 ${formatPercent(report.metrics.basicAttackRatio)}`);
  return rows.filter((entry, index, list) => entry && list.indexOf(entry) === index).slice(0, 6);
}
