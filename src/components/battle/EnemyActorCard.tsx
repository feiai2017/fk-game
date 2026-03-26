import type { EnemyFormationUnit } from "@/components/battle/useBattlePresentation";
import { Badge } from "@/components/ui/badge";

interface EnemyActorCardProps {
  unit: EnemyFormationUnit;
}

export function EnemyActorCard({ unit }: EnemyActorCardProps): JSX.Element {
  const sizeClass =
    unit.size === "xl"
      ? "w-[196px]"
      : unit.size === "lg"
        ? "w-[164px]"
        : unit.size === "md"
          ? "w-[136px]"
          : "w-[112px]";

  const roleText =
    unit.role === "boss" ? "Boss" : unit.role === "elite" ? "精英" : unit.role === "summon" ? "召唤物" : "普通怪";
  const roleClass =
    unit.role === "boss"
      ? "border-amber-300/65 bg-amber-500/12"
      : unit.role === "elite"
        ? "border-fuchsia-300/50 bg-fuchsia-500/10"
        : unit.role === "summon"
          ? "border-violet-300/45 bg-violet-500/10"
          : "border-rose-300/35 bg-rose-500/10";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
      style={{
        left: `${unit.x}%`,
        top: `${unit.y}%`,
        opacity: unit.justDefeated ? 0.45 : 1,
      }}
    >
      <div
        className={`${sizeClass} rounded-xl border p-2 ${roleClass} ${
          unit.targeted ? "ring-2 ring-rose-300/75 shadow-[0_0_22px_rgba(244,63,94,0.3)]" : ""
        } ${unit.acting ? "ring-2 ring-amber-300/75 animate-pulse" : ""} ${unit.justHit ? "brightness-125 saturate-125" : ""} ${
          unit.justSummoned ? "animate-in fade-in duration-300" : ""
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <PortraitShell role={unit.role} targeted={unit.targeted} acting={unit.acting} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-100">{unit.name}</p>
            <p className="text-[10px] text-slate-300">{roleText}</p>
          </div>
        </div>

        <TinyBar ratio={unit.hpRatio} tone="hp" />
        {unit.shield > 0 ? <TinyBar ratio={Math.min(1, unit.shield / Math.max(1, unit.hpMax))} tone="shield" /> : null}

        <div className="mt-1 flex flex-wrap gap-1">
          {unit.statuses.slice(0, unit.targeted ? 2 : 1).map((status) => (
            <Badge key={status} variant="outline" className="h-4 border-white/20 bg-white/10 px-1 text-[9px] text-slate-100">
              {status}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortraitShell(props: { role: EnemyFormationUnit["role"]; targeted: boolean; acting: boolean }): JSX.Element {
  const colorClass =
    props.role === "boss"
      ? "from-amber-700/70 to-rose-700/70 border-amber-300/50"
      : props.role === "elite"
        ? "from-fuchsia-700/70 to-violet-700/70 border-fuchsia-300/45"
        : props.role === "summon"
          ? "from-violet-700/70 to-slate-800/80 border-violet-300/45"
          : "from-rose-700/70 to-red-900/80 border-rose-300/45";
  return (
    <div className={`relative h-9 w-9 overflow-hidden rounded-full border bg-gradient-to-br ${colorClass}`}>
      <div className="absolute inset-2 rounded-full bg-black/35" />
      {props.targeted ? <div className="absolute inset-0 rounded-full border-2 border-rose-300/70" /> : null}
      {props.acting ? <div className="absolute inset-0 animate-pulse bg-amber-300/15" /> : null}
    </div>
  );
}

function TinyBar(props: { ratio: number; tone: "hp" | "shield" }): JSX.Element {
  const toneClass = props.tone === "shield" ? "bg-sky-400" : "bg-rose-400";
  return (
    <div className="mt-1 h-1.5 rounded-full bg-slate-900/65">
      <div className={`h-1.5 rounded-full ${toneClass}`} style={{ width: `${clamp01(props.ratio) * 100}%` }} />
    </div>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

