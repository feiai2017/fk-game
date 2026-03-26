import { Badge } from "@/components/ui/badge";

interface BattleAnnouncementProps {
  action: string;
  actor: string;
  target: string;
  tags: string[];
  summary: string;
  burstHighlight?: boolean;
}

export function BattleAnnouncement({
  action,
  actor,
  target,
  tags,
  summary,
  burstHighlight = false,
}: BattleAnnouncementProps): JSX.Element {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-3 z-30 w-[72%] -translate-x-1/2 rounded-full border px-4 py-2 text-center transition-all ${
        burstHighlight
          ? "border-amber-300/65 bg-[linear-gradient(90deg,rgba(127,29,29,0.72),rgba(180,83,9,0.55),rgba(127,29,29,0.72))] shadow-[0_0_24px_rgba(251,191,36,0.28)]"
          : "border-indigo-300/40 bg-[linear-gradient(90deg,rgba(15,23,42,0.85),rgba(30,41,59,0.75),rgba(15,23,42,0.85))] shadow-[0_0_20px_rgba(99,102,241,0.2)]"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-semibold text-indigo-100">[{action}]</span>
        <span className="text-xs text-slate-200">
          {actor} → {target}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="h-4 px-1.5 text-[10px]">
            {tag}
          </Badge>
        ))}
        <span className="line-clamp-1 text-[11px] text-indigo-100/90">{summary}</span>
      </div>
    </div>
  );
}

