import type { ActionLink, FloatingTextItem } from "@/components/battle/useBattlePresentation";

interface BattleEffectLayerProps {
  links: ActionLink[];
  floatingTexts: FloatingTextItem[];
}

export function BattleEffectLayer({ links, floatingTexts }: BattleEffectLayerProps): JSX.Element {
  return (
    <>
      <CombatLinkLayer links={links} />
      <FloatingTextLayer entries={floatingTexts} />
    </>
  );
}

function CombatLinkLayer({ links }: { links: ActionLink[] }): JSX.Element | null {
  if (links.length <= 0) {
    return null;
  }
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      {links.map((link) => {
        const tone =
          link.tone === "danger"
            ? "#fb7185"
            : link.tone === "spread"
              ? "#22d3ee"
              : link.tone === "aoe"
                ? "#f59e0b"
                : "#34d399";
        return (
          <line
            key={link.key}
            x1={`${link.x1}%`}
            y1={`${link.y1}%`}
            x2={`${link.x2}%`}
            y2={`${link.y2}%`}
            stroke={tone}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray={link.tone === "spread" ? "4 4" : undefined}
            opacity={0.92}
          />
        );
      })}
    </svg>
  );
}

function FloatingTextLayer({ entries }: { entries: FloatingTextItem[] }): JSX.Element | null {
  if (entries.length <= 0) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {entries.map((entry, index) => {
        const toneClass =
          entry.tone === "damage"
            ? "text-rose-300"
            : entry.tone === "dot"
              ? "text-emerald-300"
              : entry.tone === "heal"
                ? "text-lime-300"
                : entry.tone === "shield"
                  ? "text-sky-300"
                  : "text-amber-300";
        return (
          <div
            key={entry.key}
            className={`absolute text-sm font-semibold ${toneClass} ${index === 0 ? "animate-pulse" : ""}`}
            style={{
              top: `${18 + index * 7}%`,
              left: entry.side === "player" ? "22%" : `${74 + (index % 2) * 9}%`,
              transform: "translate(-50%, 0)",
            }}
          >
            {entry.text}
          </div>
        );
      })}
    </div>
  );
}

