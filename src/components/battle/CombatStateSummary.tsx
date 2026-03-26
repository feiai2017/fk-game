import { Badge } from "@/components/ui/badge";

interface CombatStateSummaryProps {
  keywords: string[];
  targetLogic: string;
  stage: string;
  burstWindow: string;
}

export function CombatStateSummary({
  keywords,
  targetLogic,
  stage,
  burstWindow,
}: CombatStateSummaryProps): JSX.Element {
  return (
    <div className="h-full rounded-xl border border-slate-700/80 bg-slate-900/65 p-3 text-xs text-slate-100">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">循环摘要</p>
      <div className="space-y-1.5">
        <SummaryLine label="构筑阶段" value={stage} />
        <SummaryLine label="目标逻辑" value={targetLogic} />
        <SummaryLine label="爆发窗口" value={burstWindow} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {keywords.slice(0, 3).map((keyword) => (
          <Badge key={keyword} variant="outline" className="h-5 border-white/20 bg-white/10 px-1.5 text-[10px] text-slate-100">
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 px-2 py-1">
      <span className="text-slate-300">{label}: </span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}

