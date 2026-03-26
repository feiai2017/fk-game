import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

interface PlayerActorCardProps {
  name: string;
  hpCurrent: number;
  hpMax: number;
  shieldCurrent: number;
  shieldMax: number;
  energyCurrent: number;
  energyMax: number;
  statuses: string[];
  extraStatusCount: number;
  acting: boolean;
  targeted: boolean;
}

export function PlayerActorCard(props: PlayerActorCardProps): JSX.Element {
  const {
    name,
    hpCurrent,
    hpMax,
    shieldCurrent,
    shieldMax,
    energyCurrent,
    energyMax,
    statuses,
    extraStatusCount,
    acting,
    targeted,
  } = props;

  return (
    <div
      className={`relative rounded-2xl border bg-emerald-500/12 p-3 transition-all ${
        acting ? "border-amber-300/90 shadow-[0_0_20px_rgba(251,191,36,0.35)] ring-2 ring-amber-300/70" : "border-emerald-300/35"
      } ${targeted ? "ring-2 ring-rose-300/80" : ""}`}
    >
      <div className="absolute -top-2 left-3 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
        我方主角
      </div>
      <div className="mb-3 mt-1 grid grid-cols-[72px_1fr] gap-3">
        <div className="relative h-[72px] w-[72px] overflow-hidden rounded-xl border border-emerald-300/35 bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.35),rgba(6,78,59,0.75))]">
          <div className="absolute inset-3 rounded-full border border-emerald-200/45 bg-black/30" />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-emerald-100">主角</div>
          {acting ? <div className="absolute inset-0 animate-pulse bg-amber-300/10" /> : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-100">{name}</p>
          <p className="text-xs text-slate-300">自动战斗 · 观战模式</p>
        </div>
      </div>

      <MiniBar label="HP" current={hpCurrent} max={hpMax} tone="hp" />
      <MiniBar label="Shield" current={shieldCurrent} max={Math.max(1, shieldMax)} tone="shield" />
      <MiniBar label="Mana" current={energyCurrent} max={Math.max(1, energyMax)} tone="mana" />

      <div className="mt-2 flex flex-wrap gap-1">
        {statuses.map((status) => (
          <Badge key={status} variant="outline" className="h-5 border-white/20 bg-white/10 px-1.5 text-[10px] text-slate-100">
            {status}
          </Badge>
        ))}
        {extraStatusCount > 0 ? (
          <Badge variant="outline" className="h-5 border-white/20 bg-white/10 px-1.5 text-[10px] text-slate-100">
            +{extraStatusCount}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function MiniBar(props: {
  label: string;
  current: number;
  max: number;
  tone: "hp" | "shield" | "mana";
}): JSX.Element {
  const ratio = clamp01(props.current / Math.max(1, props.max));
  const toneClass =
    props.tone === "shield"
      ? "from-sky-500 to-cyan-400"
      : props.tone === "mana"
        ? "from-violet-500 to-indigo-400"
        : "from-emerald-500 to-green-400";
  return (
    <div className="mt-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-200">
        <span>{props.label}</span>
        <span>
          {formatNumber(props.current)} / {formatNumber(props.max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-900/75 ring-1 ring-white/10">
        <div className={`h-2 rounded-full bg-gradient-to-r ${toneClass}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

