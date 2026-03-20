import { useEffect, useMemo, useState } from "react";
import { InBattleScreen } from "@/components/battle/InBattleScreen";
import { CombatLogPanel } from "@/components/report/CombatLogPanel";
import { ExportReportButton } from "@/components/report/ExportReportButton";
import { KeyTimelineCard } from "@/components/report/KeyTimelineCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ArchetypeKey,
  BattleReport,
  EquipmentSlot,
  FloorDef,
  FloorEnemyConfig,
  ItemDef,
  Loadout,
  RelicDef,
  RunProgress,
  SkillDef,
  Stats,
} from "@/core/battle/types";
import { aggregateStats } from "@/core/build/statAggregator";
import {
  applyRunProgressToLoadout,
  applyRunProgressToSkills,
  applyRunProgressToStats,
  createInitialRunProgress,
} from "@/core/run/progression";
import { buildPlaybackView } from "@/core/report/playbackView";
import {
  ENEMY_TEMPLATES,
  ENEMY_TRAITS,
  resolveFloorEnemyUnits,
  summarizeEnemyUnits,
} from "@/core/tower/enemyTemplates";
import { ITEMS, ITEM_BY_ID } from "@/data/items";
import { RELICS, RELIC_BY_ID } from "@/data/relics";
import { SKILLS, SKILL_BY_ID } from "@/data/skills";
import { useBattleRunner } from "@/hooks/useBattleRunner";
import { useGameState } from "@/hooks/useGameState";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";

type ProgressMode = "none" | "current" | "boosted";
type BattleScreenState = "preparing" | "battling" | "resolved";
type ScenarioId = "single" | "swarm" | "antiDot" | "boss";
type PresetId = "dot" | "crit" | "engine";

interface ScenarioDef {
  id: ScenarioId;
  label: string;
  description: string;
  pressure: FloorDef["pressure"];
  config: FloorEnemyConfig[];
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseResist: number;
  baseSpeed: number;
}

interface BuildPreset {
  id: PresetId;
  label: string;
  archetype: ArchetypeKey;
  skillIds: string[];
  equipmentIds: Partial<Record<EquipmentSlot, string>>;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "helm", "armor", "ring1", "ring2", "core"];
const SLOT_LABEL: Record<EquipmentSlot, string> = {
  weapon: "武器",
  helm: "头盔",
  armor: "护甲",
  ring1: "戒指1",
  ring2: "戒指2",
  core: "核心",
};

const RARITY_LABEL: Record<ItemDef["rarity"], string> = {
  common: "普通",
  magic: "魔法",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

const SCENARIOS: ScenarioDef[] = [
  {
    id: "single",
    label: "单体基准",
    description: "标准单体压力，用于验证单体输出。",
    pressure: "baseline",
    config: [{ template: "balanced", count: 1 }],
    baseHp: 12000,
    baseAtk: 45,
    baseDef: 55,
    baseResist: 0.12,
    baseSpeed: 1,
  },
  {
    id: "swarm",
    label: "快攻群压",
    description: "多快攻单位，测试启动与生存。",
    pressure: "swarm",
    config: [
      { template: "fast", count: 3 },
      { template: "balanced", count: 1 },
    ],
    baseHp: 7600,
    baseAtk: 52,
    baseDef: 42,
    baseResist: 0.1,
    baseSpeed: 1,
  },
  {
    id: "antiDot",
    label: "反DOT压制",
    description: "存在净化压力，测试DOT成型稳定性。",
    pressure: "antiMechanic",
    config: [
      { template: "antiDot", count: 1 },
      { template: "tank", count: 1 },
      { template: "balanced", count: 1 },
    ],
    baseHp: 13200,
    baseAtk: 58,
    baseDef: 78,
    baseResist: 0.18,
    baseSpeed: 0.95,
  },
  {
    id: "boss",
    label: "首领单体",
    description: "纯首领压力，测试打王与收尾。",
    pressure: "single",
    config: [{ template: "boss", count: 1 }],
    baseHp: 32000,
    baseAtk: 82,
    baseDef: 135,
    baseResist: 0.28,
    baseSpeed: 1,
  },
];

const PRESETS: BuildPreset[] = [
  {
    id: "dot",
    label: "DOT Burst 预设",
    archetype: "dot",
    skillIds: ["toxic_lance", "contagion_wave", "rupture_bloom"],
    equipmentIds: {
      weapon: "w_rupture_fang",
      helm: "h_stitched_hood",
      armor: "a_rupture_harness",
      ring1: "r_bloom_reflux",
      ring2: "r_execute_venom",
      core: "core_rupture_heart",
    },
  },
  {
    id: "crit",
    label: "Crit Execute 预设",
    archetype: "crit",
    skillIds: ["precision_shot", "ricochet_blade", "execution_mark"],
    equipmentIds: {
      weapon: "w_execution_scope",
      helm: "h_hawkeye_visor",
      armor: "a_predator_carapace",
      ring1: "r_guillotine_coil",
      ring2: "r_mercy_trigger",
      core: "core_assassin_relay",
    },
  },
  {
    id: "engine",
    label: "Engine Loop 预设",
    archetype: "engine",
    skillIds: ["spark_converter", "overclock_loop", "reactor_surge"],
    equipmentIds: {
      weapon: "w_threshold_accumulator",
      helm: "h_flux_reservoir",
      armor: "a_reactive_shell",
      ring1: "r_engine_loop",
      ring2: "r_overflow_gem",
      core: "core_feedback_prism",
    },
  },
];

export function TestModePage(): JSX.Element {
  const { state } = useGameState();
  const runBattle = useBattleRunner();
  const [scenarioId, setScenarioId] = useState<ScenarioId>("single");
  const [tier, setTier] = useState(3);
  const [progressMode, setProgressMode] = useState<ProgressMode>("none");
  const [presetId, setPresetId] = useState<PresetId>("dot");
  const [archetype, setArchetype] = useState<ArchetypeKey>("dot");
  const [skillIds, setSkillIds] = useState<string[]>(["toxic_lance", "contagion_wave", "rupture_bloom"]);
  const [testLoadout, setTestLoadout] = useState<Loadout>(() => buildLoadoutFromPreset(PRESETS[0]));
  const [screenState, setScreenState] = useState<BattleScreenState>("preparing");
  const [report, setReport] = useState<BattleReport>();
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [showDetailLog, setShowDetailLog] = useState(false);

  const scenario = useMemo(() => SCENARIOS.find((it) => it.id === scenarioId) ?? SCENARIOS[0], [scenarioId]);
  const availableSkills = useMemo(() => SKILLS.filter((skill) => skill.archetype === archetype), [archetype]);
  const floor = useMemo(() => buildScenarioFloor(scenario, tier), [scenario, tier]);
  const progress = useMemo(() => resolveProgress(progressMode, archetype, state.run.progress), [progressMode, archetype, state.run.progress]);
  const selectedSkillIds = useMemo(() => normalizeSkillIds(skillIds, availableSkills), [skillIds, availableSkills]);
  const selectedSkills = useMemo(
    () => selectedSkillIds.map((id) => SKILL_BY_ID[id]).filter((s): s is SkillDef => Boolean(s)),
    [selectedSkillIds],
  );
  const finalStats = useMemo(() => applyRunProgressToStats(aggregateStats(baseStats(), { ...testLoadout, skillIds: selectedSkillIds }), progress), [progress, selectedSkillIds, testLoadout]);
  const playback = useMemo(() => (report ? buildPlaybackView(report, playbackTime) : undefined), [report, playbackTime]);

  useEffect(() => {
    if (screenState !== "battling" || !report || paused) return;
    const tickMs = 120;
    const timer = window.setInterval(() => {
      setPlaybackTime((prev) => Math.min(report.metrics.duration, prev + (tickMs / 1000) * playbackSpeed));
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [screenState, report, paused, playbackSpeed]);

  useEffect(() => {
    if (screenState === "battling" && report && playbackTime >= report.metrics.duration) {
      setScreenState("resolved");
      setPaused(false);
    }
  }, [screenState, report, playbackTime]);

  const startTest = () => {
    const result = runBattle({
      floor,
      finalStats,
      skills: applyRunProgressToSkills(selectedSkills, progress),
      loadout: applyRunProgressToLoadout({ ...testLoadout, skillIds: selectedSkillIds }, progress),
      archetype,
      seedTag: `test:${scenario.id}:t${tier}:${archetype}:${progressMode}`,
    });
    setReport(result);
    setPlaybackTime(0);
    setPlaybackSpeed(1);
    setPaused(false);
    setShowDetailLog(false);
    setScreenState("battling");
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle>测试模式（独立，不影响正式进度）</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <LabeledSelect label="场景" value={scenarioId} onChange={(v) => setScenarioId(v as ScenarioId)} options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))} />
          <LabeledSelect label="强度档" value={String(tier)} onChange={(v) => setTier(Number(v))} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `T${n}` }))} />
          <LabeledSelect label="流派" value={archetype} onChange={(v) => setArchetype(v as ArchetypeKey)} options={[{ value: "dot", label: "DOT" }, { value: "crit", label: "暴击直伤" }, { value: "engine", label: "资源引擎" }]} />
          <LabeledSelect label="BD档位" value={progressMode} onChange={(v) => setProgressMode(v as ProgressMode)} options={[{ value: "none", label: "无BD" }, { value: "current", label: "当前局内BD" }, { value: "boosted", label: "流派强化BD" }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>测试操作</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm">{scenario.label}：{scenario.description}</div>
          <div className="text-xs text-muted-foreground">敌人总数 {floor.enemyCount} · 平均HP {formatNumber(summarizeEnemyUnits(floor.enemyUnits ?? []).averageHp)} · 平均抗性 {formatPercent(summarizeEnemyUnits(floor.enemyUnits ?? []).averageResist)}</div>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(scenario.config.map((it) => it.template))).map((template) => (
              <Badge key={template} variant="secondary">{ENEMY_TEMPLATES[template].name}：{ENEMY_TRAITS[template].gameplay}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LabeledSelect label="预设" value={presetId} onChange={(v) => setPresetId(v as PresetId)} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
            <Button type="button" onClick={() => { const p = PRESETS.find((x) => x.id === presetId); if (!p) return; setArchetype(p.archetype); setSkillIds([...p.skillIds]); setTestLoadout(buildLoadoutFromPreset(p)); }}>应用预设</Button>
            <Button type="button" variant="secondary" onClick={() => { setArchetype(state.archetype); setSkillIds([...state.loadout.skillIds]); setTestLoadout(cloneLoadout(state.loadout)); }}>复制当前穿戴</Button>
            <Button type="button" onClick={startTest}>开始测试</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <LabeledSelect
                key={idx}
                label={`技能槽 ${idx + 1}`}
                value={selectedSkillIds[idx] ?? ""}
                onChange={(value) =>
                  setSkillIds((prev) => {
                    const next = [...normalizeSkillIds(prev, availableSkills)];
                    next[idx] = value;
                    return next;
                  })
                }
                options={availableSkills.map((skill) => ({
                  value: skill.id,
                  label: `${getSkillDisplayName(skill.id)} (${skill.id})`,
                }))}
              />
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {EQUIPMENT_SLOTS.map((slot) => (
              <LabeledSelect
                key={slot}
                label={`装备槽：${SLOT_LABEL[slot]}`}
                value={testLoadout[slot]?.id ?? "none"}
                onChange={(value) =>
                  setTestLoadout((curr) => ({
                    ...curr,
                    [slot]: value === "none" ? undefined : slot === "core" ? RELIC_BY_ID[value] : ITEM_BY_ID[value],
                  }))
                }
                options={buildSlotOptions(slot, archetype)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>技能详情</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {selectedSkills.map((skill) => (
            <div key={skill.id} className="rounded-md border bg-background p-3 text-xs">
              <p className="font-semibold">{getSkillDisplayName(skill.id)}</p>
              <p className="text-muted-foreground">ID: {skill.id}</p>
              <p>CD {skill.cooldown.toFixed(1)}s · 消耗 {skill.cost}</p>
              <p className="text-muted-foreground">标签：{skill.tags.join(" / ")}</p>
              <p className="mt-1">{describeSkill(skill)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>装备详情</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT_SLOTS.map((slot) => {
            const item = testLoadout[slot];
            return (
              <div key={slot} className="rounded-md border bg-background p-3 text-xs">
                <p className="font-semibold">{SLOT_LABEL[slot]}</p>
                {!item ? (
                  <p className="text-muted-foreground">未装备</p>
                ) : (
                  <>
                    <p>{item.id} · {RARITY_LABEL[item.rarity]}</p>
                    <p className="text-muted-foreground">属性：{formatStatRows(item.stats).join("，")}</p>
                    <p className="text-muted-foreground">机制：{describeItemMechanics(item).join("；")}</p>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>测试战斗流程</span>
            {report ? (
              <ExportReportButton
                report={report}
                runId={`test-${scenarioId}-t${tier}-${archetype}`}
                runProgress={progress}
              />
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {screenState === "preparing" ? <p className="text-sm text-muted-foreground">点击“开始测试”后会进入战斗过程回放，再进入结算与详细日志。</p> : null}
          {screenState === "battling" && report && playback ? (
            <InBattleScreen
              report={report}
              playback={playback}
              status={paused ? "暂停" : "进行中"}
              speed={playbackSpeed}
              canPause={!paused}
              onTogglePause={() => setPaused((v) => !v)}
              onSetSpeed={setPlaybackSpeed}
              onSkip={() => {
                if (!report) return;
                setPlaybackTime(report.metrics.duration);
                setScreenState("resolved");
                setPaused(false);
              }}
            />
          ) : null}
          {screenState === "resolved" && report ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={report.win ? "default" : "outline"}>{report.win ? "通过" : "失败"}</Badge>
                <span className="text-sm text-muted-foreground">时长 {formatSeconds(report.metrics.duration)} · 总伤害 {formatNumber(report.metrics.totalDamage)} · 敌方剩余 {formatPercent(report.metrics.enemyRemainingHpRatio)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={startTest}>再测一次</Button>
                <Button variant="secondary" onClick={() => setScreenState("preparing")}>返回准备</Button>
                <Button variant="ghost" onClick={() => setShowDetailLog((v) => !v)}>{showDetailLog ? "收起详细日志" : "展开详细日志"}</Button>
              </div>
              {showDetailLog ? (
                <div className="grid gap-3">
                  <KeyTimelineCard entries={report.timeline ?? []} deathTime={report.combatEvents?.find((e) => e.type === "PLAYER_DEATH")?.time} />
                  <CombatLogPanel report={report} />
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function buildLoadoutFromPreset(preset: BuildPreset): Loadout {
  return {
    weapon: preset.equipmentIds.weapon ? ITEM_BY_ID[preset.equipmentIds.weapon] : undefined,
    helm: preset.equipmentIds.helm ? ITEM_BY_ID[preset.equipmentIds.helm] : undefined,
    armor: preset.equipmentIds.armor ? ITEM_BY_ID[preset.equipmentIds.armor] : undefined,
    ring1: preset.equipmentIds.ring1 ? ITEM_BY_ID[preset.equipmentIds.ring1] : undefined,
    ring2: preset.equipmentIds.ring2 ? ITEM_BY_ID[preset.equipmentIds.ring2] : undefined,
    core: preset.equipmentIds.core ? RELIC_BY_ID[preset.equipmentIds.core] : undefined,
    skillIds: [...preset.skillIds],
  };
}

function cloneLoadout(loadout: Loadout): Loadout {
  return {
    weapon: loadout.weapon,
    helm: loadout.helm,
    armor: loadout.armor,
    ring1: loadout.ring1,
    ring2: loadout.ring2,
    core: loadout.core,
    skillIds: [...loadout.skillIds],
  };
}

function buildScenarioFloor(scenario: ScenarioDef, tier: number): FloorDef {
  const level = Math.max(1, Math.min(5, Math.round(tier)));
  const enemyUnits = resolveFloorEnemyUnits({
    config: scenario.config,
    baseHp: Math.round(scenario.baseHp * (1 + (level - 1) * 0.42)),
    baseAtk: Math.round(scenario.baseAtk * (1 + (level - 1) * 0.24)),
    baseDef: Math.round(scenario.baseDef + (level - 1) * 12),
    baseResist: Math.max(0, Math.min(0.62, scenario.baseResist + (level - 1) * 0.03)),
    baseSpeed: Math.max(0.55, Math.min(2.2, scenario.baseSpeed + (level - 1) * 0.03)),
  });
  const summary = summarizeEnemyUnits(enemyUnits);
  return {
    floor: 880 + level,
    pressure: scenario.pressure,
    enemyHp: summary.averageHp,
    enemyAtk: summary.averageAtk,
    enemyDef: summary.averageDef,
    enemyResist: summary.averageResist,
    enemySpeed: summary.averageSpeed,
    enemyCount: enemyUnits.length,
    boss: scenario.config.some((entry) => entry.template === "boss"),
    notes: `${scenario.label} T${level}`,
    enemyConfig: scenario.config,
    enemyUnits,
  };
}

function resolveProgress(mode: ProgressMode, archetype: ArchetypeKey, current: RunProgress): RunProgress {
  if (mode === "current") return current;
  if (mode === "none") return createInitialRunProgress();
  const progress = createInitialRunProgress();
  if (archetype === "dot") progress.statBonuses = { ...progress.statBonuses, atk: 18, dotPower: 0.24, cdr: 0.08, resourceRegen: 2, resourceMax: 12 };
  if (archetype === "crit") progress.statBonuses = { ...progress.statBonuses, atk: 20, crit: 0.12, critDamage: 0.22, cdr: 0.05 };
  if (archetype === "engine") progress.statBonuses = { ...progress.statBonuses, atk: 16, procPower: 0.22, resourceRegen: 2.5, resourceMax: 16, cdr: 0.05 };
  return progress;
}

function normalizeSkillIds(ids: string[], available: SkillDef[]): string[] {
  const valid = ids.filter((id) => available.some((skill) => skill.id === id));
  const fill = available.map((skill) => skill.id).filter((id) => !valid.includes(id));
  return [...valid, ...fill].slice(0, 3);
}

function buildSlotOptions(slot: EquipmentSlot, archetype: ArchetypeKey): Array<{ value: string; label: string }> {
  if (slot === "core") {
    const options = RELICS.filter((relic) => relic.archetypeBias === archetype || !relic.archetypeBias);
    return [{ value: "none", label: "无" }].concat(
      options.map((relic) => ({ value: relic.id, label: `${relic.id} (${RARITY_LABEL[relic.rarity]})` })),
    );
  }
  const options = ITEMS.filter((item) => isSlotCompatible(item.slot, slot)).filter(
    (item) => item.archetypeBias === archetype || !item.archetypeBias,
  );
  return [{ value: "none", label: "无" }].concat(
    options.map((item) => ({ value: item.id, label: `${item.id} (${RARITY_LABEL[item.rarity]})` })),
  );
}

function isSlotCompatible(itemSlot: EquipmentSlot, targetSlot: EquipmentSlot): boolean {
  if (targetSlot === "ring1" || targetSlot === "ring2") {
    return itemSlot === "ring1" || itemSlot === "ring2";
  }
  return itemSlot === targetSlot;
}

function getSkillDisplayName(skillId: string): string {
  const map: Record<string, string> = {
    toxic_lance: "毒枪穿刺",
    contagion_wave: "传染波",
    rupture_bloom: "裂绽绽放",
    precision_shot: "精准射击",
    ricochet_blade: "弹射刃轮",
    execution_mark: "处决印记",
    spark_converter: "火花转换",
    overclock_loop: "超频回路",
    reactor_surge: "反应堆激涌",
  };
  return map[skillId] ?? skillId;
}

function describeSkill(skill: SkillDef): string {
  const rows: string[] = [];
  if ((skill.directRatio ?? 0) > 0) {
    rows.push(`直伤系数 ${(skill.directRatio ?? 0).toFixed(2)}`);
  }
  if (skill.dot) {
    rows.push(`DOT ${skill.dot.duration}s / 跳 ${(skill.dot.tickRatio ?? 0).toFixed(2)} / 上限 ${skill.dot.maxStacks}`);
  }
  if ((skill.burstDotPercent ?? 0) > 0) {
    rows.push(`引爆剩余DOT ${Math.round((skill.burstDotPercent ?? 0) * 100)}%`);
  }
  if ((skill.procRatio ?? 0) > 0) {
    rows.push(`触发系数 ${(skill.procRatio ?? 0).toFixed(2)}`);
  }
  if ((skill.shieldRatio ?? 0) > 0) {
    rows.push(`护盾系数 ${(skill.shieldRatio ?? 0).toFixed(2)}`);
  }
  if ((skill.healRatio ?? 0) > 0) {
    rows.push(`治疗系数 ${(skill.healRatio ?? 0).toFixed(2)}`);
  }
  return rows.length > 0 ? rows.join("，") : "功能型技能";
}

function formatStatRows(stats: Partial<Stats>): string[] {
  const rows: string[] = [];
  if (stats.hp) rows.push(`生命+${formatNumber(stats.hp)}`);
  if (stats.atk) rows.push(`攻击+${formatNumber(stats.atk)}`);
  if (stats.def) rows.push(`防御+${formatNumber(stats.def)}`);
  if (stats.crit) rows.push(`暴击+${formatPercent(stats.crit)}`);
  if (stats.critDamage) rows.push(`暴伤+${formatPercent(stats.critDamage)}`);
  if (stats.skillPower) rows.push(`技能强度+${formatPercent(stats.skillPower)}`);
  if (stats.dotPower) rows.push(`DOT+${formatPercent(stats.dotPower)}`);
  if (stats.procPower) rows.push(`触发+${formatPercent(stats.procPower)}`);
  if (stats.cdr) rows.push(`冷却缩减+${formatPercent(stats.cdr)}`);
  if (stats.resourceRegen) rows.push(`回能+${formatNumber(stats.resourceRegen)}`);
  if (stats.resourceMax) rows.push(`资源上限+${formatNumber(stats.resourceMax)}`);
  return rows.length > 0 ? rows : ["无"];
}

function describeItemMechanics(item: ItemDef): string[] {
  const rows = (item.mechanicEffects ?? []).map((effect) => `${effect.id}(${effect.event})`);
  if (item.slot === "core") {
    const modifiers = (item as RelicDef).mechanicModifiers;
    if (modifiers?.dotBurstBonus) rows.push(`DOT引爆+${formatPercent(modifiers.dotBurstBonus)}`);
    if (modifiers?.executeBonus) rows.push(`斩杀加成+${formatPercent(modifiers.executeBonus)}`);
    if (modifiers?.procTriggerOnSpend) rows.push("消耗触发额外proc");
    if (modifiers?.extraDotStacks) rows.push(`DOT层数上限+${modifiers.extraDotStacks}`);
  }
  return rows.length > 0 ? rows : ["无"];
}

function baseStats(): Stats {
  return {
    hp: 1200, atk: 120, def: 60, speed: 1, crit: 0.1, critDamage: 0.5,
    skillPower: 0, dotPower: 0, procPower: 0, resist: 0.05, regen: 4,
    shieldPower: 0, cdr: 0, resourceMax: 100, resourceRegen: 6,
  };
}

function LabeledSelect(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; }): JSX.Element {
  const { label, value, onChange, options } = props;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
