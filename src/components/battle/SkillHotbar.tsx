import type { BattleReport, SkillDef } from "@/core/battle/types";
import { scaleCooldown } from "@/core/battle/formulas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { tSkillId } from "@/lib/i18n";

interface SkillHotbarProps {
  report: BattleReport;
  elapsed: number;
  activeSkillId?: string;
  currentEnergy?: number;
  recommendedSkillId?: string;
  compact?: boolean;
}

interface SkillHotbarEntry {
  skill: SkillDef;
  visual: SkillVisual;
  cooldownRatio: number;
  remainingCooldown: number;
  ready: boolean;
  affordable: boolean;
  active: boolean;
  recommended: boolean;
}

interface SkillVisual {
  kind: "dot" | "spread" | "explode" | "finisher" | "resource" | "defense" | "general";
  icon: string;
  label: string;
  accentClass: string;
}

export function SkillHotbar({
  report,
  elapsed,
  activeSkillId,
  currentEnergy,
  recommendedSkillId,
  compact = false,
}: SkillHotbarProps): JSX.Element | null {
  const skills = report.context?.selectedSkills ?? [];
  if (skills.length === 0) {
    return null;
  }

  const entries = skills.map((skill) =>
    buildEntry(report, skill, elapsed, activeSkillId, currentEnergy, recommendedSkillId),
  );

  return (
    <Card className="overflow-hidden border-slate-800/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.9))] text-slate-50">
      <CardContent className={compact ? "px-3 py-2" : "px-4 py-3"}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">技能托盘</p>
          <p className="text-[11px] text-slate-400">可读冷却 · 资源态</p>
        </div>
        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
          {entries.map((entry) => (
            <SkillSlot key={entry.skill.id} entry={entry} compact={compact} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillSlot(props: { entry: SkillHotbarEntry; compact: boolean }): JSX.Element {
  const { entry, compact } = props;
  const tags = buildSkillTags(entry.skill, entry.visual.label);

  return (
    <div
      className={`rounded-xl border p-2 ${
        entry.active
          ? "border-amber-300/80 bg-amber-400/10 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
          : entry.recommended
            ? "border-indigo-300/70 bg-indigo-500/12"
            : "border-white/12 bg-white/5"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="relative h-14 w-14 shrink-0">
          <div className={`absolute inset-0 rounded-xl ${entry.visual.accentClass} ${!entry.affordable ? "grayscale" : ""}`} />
          {entry.cooldownRatio > 0 ? (
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `conic-gradient(rgba(15,23,42,0.84) ${entry.cooldownRatio * 360}deg, rgba(15,23,42,0) 0deg)`,
              }}
            />
          ) : null}
          <div className="absolute inset-[8px] flex items-center justify-center rounded-lg bg-black/40 text-2xl">
            {entry.visual.icon}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {entry.ready ? (entry.affordable ? "READY" : "缺蓝") : `${entry.remainingCooldown.toFixed(1)}s`}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <p className="truncate text-sm font-semibold text-slate-100">{tSkillId(entry.skill.id)}</p>
            {entry.active ? <Badge className="h-5 px-1.5 text-[10px]">施放中</Badge> : null}
            {!entry.active && entry.recommended ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                推荐
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-300">
            消耗 {entry.skill.cost} · CD {entry.skill.cooldown.toFixed(1)}s
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.slice(0, compact ? 2 : 3).map((tag) => (
              <Badge key={`${entry.skill.id}-${tag}`} variant="outline" className="h-4 border-white/20 bg-white/10 px-1 text-[9px] text-slate-100">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEntry(
  report: BattleReport,
  skill: SkillDef,
  elapsed: number,
  activeSkillId?: string,
  currentEnergy?: number,
  recommendedSkillId?: string,
): SkillHotbarEntry {
  const cooldown = effectiveCooldown(skill, report);
  const castEvents = (report.combatEvents ?? []).filter(
    (event) =>
      event.type === "SKILL_CAST" &&
      event.sourceId === skill.id &&
      (event.tags ?? []).includes("cast") &&
      event.time <= elapsed,
  );
  const lastCastAt = castEvents.length > 0 ? castEvents[castEvents.length - 1].time : null;
  const remainingCooldown =
    lastCastAt === null ? 0 : Math.max(0, cooldown - Math.max(0, elapsed - lastCastAt));

  return {
    skill,
    visual: deriveSkillVisual(skill),
    cooldownRatio: cooldown > 0 ? remainingCooldown / cooldown : 0,
    remainingCooldown,
    ready: remainingCooldown <= 0.01,
    affordable: currentEnergy === undefined ? true : currentEnergy >= skill.cost,
    active: activeSkillId === skill.id,
    recommended: recommendedSkillId === skill.id,
  };
}

function deriveSkillVisual(skill: SkillDef): SkillVisual {
  if (skill.id === "rupture_bloom" || skill.tags.includes("finisher")) {
    return {
      kind: skill.id === "rupture_bloom" ? "explode" : "finisher",
      icon: skill.id === "rupture_bloom" ? "✹" : "✦",
      label: skill.id === "rupture_bloom" ? "引爆" : "收割",
      accentClass:
        skill.id === "rupture_bloom"
          ? "bg-gradient-to-br from-orange-600 via-rose-600 to-red-700"
          : "bg-gradient-to-br from-fuchsia-700 via-rose-700 to-violet-700",
    };
  }
  if (skill.id === "contagion_wave" || skill.tags.includes("spread")) {
    return {
      kind: "spread",
      icon: "◉",
      label: "扩散",
      accentClass: "bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700",
    };
  }
  if (skill.id === "toxic_lance" || skill.tags.includes("dot") || skill.dot) {
    return {
      kind: "dot",
      icon: "☣",
      label: "DOT",
      accentClass: "bg-gradient-to-br from-emerald-700 via-lime-600 to-green-700",
    };
  }
  if (skill.tags.includes("shield") || skill.tags.includes("heal") || skill.tags.includes("defense")) {
    return {
      kind: "defense",
      icon: "🛡",
      label: "防御",
      accentClass: "bg-gradient-to-br from-sky-700 via-blue-600 to-cyan-600",
    };
  }
  if (skill.tags.includes("proc") || skill.tags.includes("cycle") || skill.tags.includes("spender")) {
    return {
      kind: "resource",
      icon: "⟳",
      label: "资源",
      accentClass: "bg-gradient-to-br from-indigo-700 via-violet-600 to-fuchsia-600",
    };
  }
  return {
    kind: "general",
    icon: "✷",
    label: "战斗",
    accentClass: "bg-gradient-to-br from-slate-700 to-slate-500",
  };
}

function buildSkillTags(skill: SkillDef, primaryLabel: string): string[] {
  const tags = [primaryLabel];
  for (const tag of skill.tags) {
    if (tag === "dot") tags.push("DOT");
    else if (tag === "spread") tags.push("扩散");
    else if (tag === "burst") tags.push("爆发");
    else if (tag === "finisher") tags.push("收割");
    else if (tag === "shield") tags.push("护盾");
    else if (tag === "heal") tags.push("治疗");
    else if (tag === "proc") tags.push("触发");
    else if (tag === "cycle") tags.push("循环");
  }
  return tags.filter((item, index, list) => list.indexOf(item) === index);
}

function effectiveCooldown(skill: SkillDef, report: BattleReport): number {
  const cdr = report.context?.finalStats.cdr ?? 0;
  return scaleCooldown(skill.cooldown, cdr);
}

