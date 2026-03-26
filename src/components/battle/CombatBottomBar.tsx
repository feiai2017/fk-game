import type { BattleReport } from "@/core/battle/types";
import type { PlaybackViewModel } from "@/core/report/playbackView";
import { SkillHotbar } from "@/components/battle/SkillHotbar";
import { CombatStateSummary } from "@/components/battle/CombatStateSummary";
import { formatNumber } from "@/lib/format";

interface CombatBottomBarProps {
  report: BattleReport;
  playback: PlaybackViewModel;
  elapsed: number;
  activeSkillId?: string;
  recommendedSkillId?: string;
  buildKeywords: string[];
}

export function CombatBottomBar(props: CombatBottomBarProps): JSX.Element {
  const { report, playback, elapsed, activeSkillId, recommendedSkillId, buildKeywords } = props;
  const hpMax = report.context?.finalStats.hp ?? 1;
  const manaMax = report.context?.finalStats.resourceMax ?? 1;

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr_310px]">
      <div className="rounded-xl border border-slate-700/85 bg-slate-900/70 p-3 text-slate-100">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">主角状态</p>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-10 w-10 rounded-full border border-emerald-300/40 bg-emerald-500/20" />
          <div>
            <p className="text-sm font-semibold">{resolveHeroLabel(report)}</p>
            <p className="text-xs text-slate-400">自动战斗进行中</p>
          </div>
        </div>
        <StatLine label="HP" current={playback.playerHp} max={hpMax} tone="hp" />
        <StatLine label="Shield" current={playback.playerShield} max={hpMax} tone="shield" />
        <StatLine label="Mana" current={playback.playerEnergy} max={manaMax} tone="mana" />
      </div>

      <SkillHotbar
        report={report}
        elapsed={elapsed}
        activeSkillId={activeSkillId}
        currentEnergy={playback.playerEnergy}
        recommendedSkillId={recommendedSkillId}
        compact
      />

      <CombatStateSummary
        keywords={buildKeywords}
        targetLogic={playback.mainTargetLabel}
        stage={playback.playerStateLabel}
        burstWindow={playback.dotWindowHint ?? "等待窗口"}
      />
    </div>
  );
}

function StatLine(props: { label: string; current: number; max: number; tone: "hp" | "shield" | "mana" }): JSX.Element {
  const ratio = clamp01(props.current / Math.max(1, props.max));
  const toneClass =
    props.tone === "shield"
      ? "from-sky-500 to-cyan-400"
      : props.tone === "mana"
        ? "from-violet-500 to-indigo-400"
        : "from-emerald-500 to-green-400";
  return (
    <div className="mb-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span>{props.label}</span>
        <span>
          {formatNumber(props.current)} / {formatNumber(props.max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/10">
        <div className={`h-2 rounded-full bg-gradient-to-r ${toneClass}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function resolveHeroLabel(report: BattleReport): string {
  if (report.context?.archetype === "dot") return "腐蚀构筑";
  if (report.context?.archetype === "crit") return "处决构筑";
  return "回路引擎";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

