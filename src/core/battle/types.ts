export type ArchetypeKey = "dot" | "crit" | "engine";

export type EquipmentSlot =
  | "weapon"
  | "helm"
  | "armor"
  | "ring1"
  | "ring2"
  | "core";

export type TowerPressureTag =
  | "baseline"
  | "swarm"
  | "burst"
  | "single"
  | "sustain"
  | "antiMechanic";

export type EnemyTemplateKey = "fast" | "tank" | "balanced" | "antiDot" | "boss";

export interface EnemyTemplateDef {
  key: EnemyTemplateKey;
  name: string;
  hpMultiplier: number;
  atkMultiplier: number;
  defMultiplier: number;
  speedMultiplier: number;
  resistMultiplier: number;
}

export interface FloorEnemyConfig {
  template: EnemyTemplateKey;
  count: number;
}

export interface FloorEnemyUnit {
  id: number;
  template: EnemyTemplateKey;
  hp: number;
  atk: number;
  def: number;
  resist: number;
  speed: number;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  crit: number;
  critDamage: number;
  skillPower: number;
  dotPower: number;
  procPower: number;
  resist: number;
  regen: number;
  shieldPower: number;
  cdr: number;
  resourceMax: number;
  resourceRegen: number;
}

export interface SkillDef {
  id: string;
  name: string;
  archetype: ArchetypeKey;
  cooldown: number;
  cost: number;
  directRatio?: number;
  hits?: number;
  dot?: {
    name: string;
    duration: number;
    tickRatio: number;
    maxStacks: number;
  };
  critBonus?: number;
  burstDotPercent?: number;
  procRatio?: number;
  shieldRatio?: number;
  healRatio?: number;
  tags: string[];
}

export type PassiveEventType =
  | "onSkillCast"
  | "onSkillHit"
  | "onKill"
  | "onResourceOverflowTick";

export type PassiveEffectId =
  | "DOT_BURST_REFUND"
  | "DOT_COVERAGE_CDR"
  | "DOT_FULLSTACK_ECHO"
  | "DOT_LANCE_SPLASH"
  | "CONTAGION_OPENING"
  | "RUPTURE_STACK_SURGE"
  | "CRIT_FINISHER_CDR"
  | "CRIT_FINISHER_VALUE"
  | "CRIT_FINISHER_REFUND"
  | "ENGINE_OVERFLOW_GUARD"
  | "SPEND_EMPOWER_NEXT_PROC"
  | "ENGINE_HIGH_RESOURCE_CHAIN"
  | "LOW_RESOURCE_CYCLE_SURGE";

export interface PassiveEffectDef {
  id: PassiveEffectId;
  event: PassiveEventType;
  value?: number;
  value2?: number;
  chance?: number;
  cooldown?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: "common" | "rare" | "legendary";
  archetypeBias?: ArchetypeKey;
  stats: Partial<Stats>;
  affixes?: string[];
  mechanicEffects?: PassiveEffectDef[];
  desc: string;
  instanceId?: string;
}

export interface RelicDef extends ItemDef {
  slot: "core";
  mechanicModifiers?: {
    dotBurstBonus?: number;
    executeBonus?: number;
    procTriggerOnSpend?: boolean;
    extraDotStacks?: number;
    resourceRefundBonus?: number;
  };
}

export interface Loadout {
  weapon?: ItemDef;
  helm?: ItemDef;
  armor?: ItemDef;
  ring1?: ItemDef;
  ring2?: ItemDef;
  core?: RelicDef;
  skillIds: string[];
}

export interface FloorDef {
  floor: number;
  pressure: TowerPressureTag;
  enemyHp: number;
  enemyAtk: number;
  enemyDef: number;
  enemyResist: number;
  enemySpeed: number;
  enemyCount: number;
  boss: boolean;
  enemyConfig?: FloorEnemyConfig[];
  enemyUnits?: FloorEnemyUnit[];
  notes?: string;
}

export interface FloorEnemyPresentation {
  template: EnemyTemplateKey;
  name: string;
  tags: string[];
  description: string;
  count: number;
}

export interface FloorWavePresentation {
  index: number;
  title: string;
  enemies: FloorEnemyPresentation[];
  note?: string;
}

export interface BossPresentation {
  name: string;
  passive: string;
  skills: string[];
  phaseTrigger: string;
  dangerTip: string;
}

export interface FloorPreview {
  floor: number;
  title: string;
  subtitle: string;
  dangerHint: string;
  waveSummary: string;
  waves: FloorWavePresentation[];
  boss?: BossPresentation;
}

export interface BattleInput {
  floor: FloorDef;
  finalStats: Stats;
  skills: SkillDef[];
  loadout: Loadout;
  archetype: ArchetypeKey;
  seedTag?: string;
}

export interface DamageEntry {
  sourceId: string;
  sourceName: string;
  category: "direct" | "dot" | "proc";
  total: number;
}

export interface BattleMetrics {
  duration: number;
  totalDamage: number;
  damageTaken: number;
  remainingHp: number;
  burstDps: number;
  sustainDps: number;
  startupTime: number;
  resourceStarvedRate: number;
  resourceOverflowRate: number;
  dotDamage: number;
  procDamage: number;
  basicAttackDamage: number;
  skillDamage: number;
  coreTriggerDamage: number;
  directDamageRatio: number;
  dotDamageRatio: number;
  procDamageRatio: number;
  basicAttackRatio: number;
  skillRatio: number;
  coreTriggerRatio: number;
  basicAttackDamageRatio: number;
  skillDamageRatio: number;
  coreTriggerDamageRatio: number;
  firstKillTime: number | null;
  enemyRemainingHpRatio: number;
  damageBySource: DamageEntry[];
}

export interface DiagnosisEntry {
  code:
    | "LOW_RAW_DAMAGE"
    | "LOW_DAMAGE"
    | "SLOW_STARTUP"
    | "LOW_CLEAR_EFFICIENCY"
    | "LOW_SINGLE_TARGET_FINISH"
    | "RESOURCE_WASTE"
    | "LOW_MECHANIC_CONTRIBUTION"
    | "RESOURCE_STARVED"
    | "RESOURCE_OVERFLOW"
    | "LOW_SURVIVAL"
    | "LOW_DOT_RATIO"
    | "LOW_PROC_RATIO";
  message: string;
}

export interface BatchDiagnosisTrend {
  code: DiagnosisEntry["code"];
  count: number;
  rate: number;
}

export interface BatchValidationSummary {
  runCount: number;
  winRate: number;
  avgTotalDamage: number;
  avgStartupTime: number;
  avgFirstKillTime: number | null;
  avgEnemyRemainingHpRatio: number;
  avgDamageTaken: number;
  avgResourceStarvedRate: number;
  avgResourceOverflowRate: number;
  topDiagnosis: BatchDiagnosisTrend[];
}

export type TuningBottleneckTag =
  | "startup"
  | "clear"
  | "single"
  | "survival"
  | "resource"
  | "mechanic"
  | "throughput";

export interface FloorGuidance {
  primaryObjective: string;
  secondaryObjective: string;
  failurePatternSummary: string;
  recommendedMetricFocus: string[];
  dangerWindowSummary: string;
  likelyCauseLine: string;
  bottleneckTags: TuningBottleneckTag[];
}

export interface FloorBuildGoal {
  floorBuildGoal: string;
  focusMetrics: string[];
  deprioritizedDirections: string[];
}

export interface PriorityAdjustment {
  topPriorityAdjustment: string;
  secondaryAdjustment?: string;
  topPriorityTarget: string;
  topPriorityCandidateItemId?: string;
  reasoning: string;
}

export interface ReportGuidance {
  primaryIssue: DiagnosisEntry["code"] | "NONE";
  secondaryIssue?: DiagnosisEntry["code"];
  actionSuggestions: string[];
  recommendedTargets: string[];
  candidateItemIds?: string[];
  floorObjective: FloorGuidance;
  floorBuildGoal: FloorBuildGoal;
  priorityAdjustment: PriorityAdjustment;
}

export type CombatEventCategory = "offense" | "defense" | "resource" | "danger" | "system";

export type CombatEventType =
  | "SKILL_CAST"
  | "BASIC_ATTACK"
  | "DOT_APPLY"
  | "DOT_TICK"
  | "DOT_BURST"
  | "DOT_CLEANSE"
  | "BOSS_MECHANIC"
  | "PROC_TRIGGER"
  | "SHIELD_GAIN"
  | "SHIELD_LOSS"
  | "HEAL_GAIN"
  | "RESOURCE_GAIN"
  | "RESOURCE_SPEND"
  | "RESOURCE_OVERFLOW"
  | "ENEMY_SUMMON"
  | "BUFF_GAIN"
  | "DEBUFF_APPLY"
  | "ENEMY_HIT"
  | "ENEMY_HEAVY_HIT"
  | "ENEMY_KILL"
  | "PLAYER_DEATH"
  | "BATTLE_END"
  | "SKILL_DECISION";

export interface CombatEvent {
  time: number;
  type: CombatEventType;
  category: CombatEventCategory;
  summary: string;
  value?: number;
  amount?: number;
  sourceId?: string;
  sourceName?: string;
  targetId?: number | string;
  targetName?: string;
  tags?: string[];
  meta?: Record<string, number | string | boolean | null | undefined>;
  metadata?: Record<string, number | string | boolean | null | undefined>;
}

export interface BattleTimelineEntry {
  time: number;
  timeLabel: string;
  category: CombatEventCategory;
  severity: "normal" | "warning" | "critical";
  typeLabel: string;
  text: string;
}

export interface CombatSnapshot {
  time: number;
  playerHp: number;
  playerShield: number;
  playerEnergy: number;
  aliveEnemies: number;
  enemyRemainingHpRatio: number;
  dotCoveredEnemies: number;
  recentIncomingDamageWindow: number;
  recentOutgoingDamageWindow: number;
}

export interface BattleReportContext {
  seed: string | null;
  floor: FloorDef;
  archetype: ArchetypeKey;
  finalStats: Stats;
  selectedSkills: SkillDef[];
  loadout: Loadout;
}

export interface DamageFormulaBreakdown {
  sourceId: string;
  sourceName: string;
  category: "direct" | "dot" | "proc";
  totalDamage: number;
  ratioToTotal: number;
  baseTerm: string;
  sourceRatioTerm: string;
  majorModifiers: string[];
  defenseMultiplier: number;
  resistMultiplier: number;
  finalApproxPerHit: number;
  reductionSummary: string;
}

export interface ArchetypeFloorDiagnosis {
  archetype: ArchetypeKey;
  runCount: number;
  winRate: number;
  avgStartupTime: number;
  avgFirstKillTime: number | null;
  avgEnemyRemainingHpRatio: number;
  avgDamageTaken: number;
  avgResourceStarvedRate: number;
  avgResourceOverflowRate: number;
  topDiagnosis: BatchDiagnosisTrend[];
  primaryBottleneck: TuningBottleneckTag;
  finding: string;
}

export interface FocusedFloorDiagnosis {
  floor: number;
  mainTest: string;
  archetypeFindings: ArchetypeFloorDiagnosis[];
  overallConclusion: string;
  recommendedFirstAction:
    | "build adjustment"
    | "skill adjustment"
    | "slot/item adjustment"
    | "light floor retuning";
  evidenceNote: string;
}

export type RunRewardCategory =
  | "stat_bonus"
  | "skill_upgrade"
  | "passive_modifier"
  | "relic_pick";

export interface RunSkillUpgrade {
  cooldownReduction?: number;
  costReduction?: number;
  directRatioBonus?: number;
  dotTickBonus?: number;
  procRatioBonus?: number;
  hitsBonus?: number;
}

export type RunRewardTheme = "numeric" | "mechanic" | "route";

export interface RunRewardEffect {
  stats?: Partial<Stats>;
  skillUpgrade?: {
    skillId: string;
    upgrade: RunSkillUpgrade;
  };
  passiveEffect?: PassiveEffectDef;
  relicId?: string;
}

export interface RunRewardOption {
  id: string;
  category: RunRewardCategory;
  theme?: RunRewardTheme;
  routeTag?: string;
  routeHint?: string;
  debugTags?: string[];
  title: string;
  description: string;
  effect: RunRewardEffect;
}

export interface RunRewardRecord {
  floor: number;
  optionId: string;
  category: RunRewardCategory;
  title: string;
}

export interface RunProgress {
  statBonuses: Partial<Stats>;
  skillUpgrades: Record<string, RunSkillUpgrade>;
  passiveEffects: PassiveEffectDef[];
  relicIds: string[];
  selectedRewards: RunRewardRecord[];
  wins: number;
  totalDamage: number;
  totalDamageTaken: number;
  highestClearedFloor: number;
  mostDangerousFloor?: number;
  mostDangerousDamageTaken?: number;
  damageByStyle: {
    direct: number;
    dot: number;
    proc: number;
  };
}

export interface RunResult {
  floor: number;
  win: boolean;
  duration: number;
  enemyRemainingHpRatio: number;
  timestamp: number;
}

export interface RunEndSummary {
  runId: string;
  outcome: "victory" | "defeat";
  reachedFloor: number;
  highestClearedFloor: number;
  totalDamage: number;
  totalDamageTaken: number;
  selectedRewards: RunRewardRecord[];
  dominantDamageStyle: "direct" | "dot" | "proc";
  mostDangerousFloor?: number;
  shortBuildSummary: string;
}

export interface RunState {
  id: string;
  status: "in_progress" | "reward_pending" | "over";
  currentFloor: number;
  canContinue: boolean;
  isOver: boolean;
  pendingRewards?: RunRewardOption[];
  latestResult?: RunResult;
  progress: RunProgress;
  endSummary?: RunEndSummary;
}

export type StartupProfile = "slow" | "medium" | "fast";
export type StrengthProfile = "weak" | "medium" | "strong";
export type ResourceProfile = "poor" | "fair" | "good";

export interface BuildProfileSummary {
  identity: string;
  startupProfile: StartupProfile;
  clearProfile: StrengthProfile;
  singleTargetProfile: StrengthProfile;
  survivalProfile: StrengthProfile;
  resourceUtilization: ResourceProfile;
  mechanismContribution: StrengthProfile;
  source: "estimated" | "lastReport";
  notes: string[];
}

export interface BuildComparisonHint {
  aspect: "startup" | "clear" | "single" | "survival" | "resource" | "mechanism";
  from: string;
  to: string;
  direction: "better" | "worse" | "flat";
  message: string;
}

export interface BattleRecap {
  outcomeText: string;
  reasonSummary: string;
  keyWinOrFailPoint: string;
  suggestion: string;
  outputSummary: {
    totalDamage: number;
    directRatio: number;
    dotRatio: number;
    procRatio: number;
  };
  intakeSummary: {
    topSourceName: string;
    topSourceDamage: number;
    mostDangerousSource: string;
    maxSingleHit: number;
    maxSingleHitTime: number | null;
  };
  dangerWindowSummary: string;
}

export interface BattleReport {
  win: boolean;
  floor: number;
  pressure: TowerPressureTag;
  metrics: BattleMetrics;
  diagnosis: DiagnosisEntry[];
  guidance?: ReportGuidance;
  combatLog: string[];
  combatEvents?: CombatEvent[];
  timeline?: BattleTimelineEntry[];
  combatSnapshots?: CombatSnapshot[];
  recap?: BattleRecap;
  context?: BattleReportContext;
  formulaBreakdowns?: DamageFormulaBreakdown[];
  focusedFloorDiagnosis?: FocusedFloorDiagnosis;
  loot: ItemDef[];
}

export interface BattleSnapshot {
  floor: number;
  archetype: ArchetypeKey;
  loadout: Loadout;
}

export interface GameState {
  currentFloor: number;
  inventory: ItemDef[];
  loadout: Loadout;
  archetype: ArchetypeKey;
  run: RunState;
  lastReport?: BattleReport;
  lastBattleSnapshot?: BattleSnapshot;
}

export interface DotInstance {
  id: string;
  name: string;
  sourceId: string;
  sourceName: string;
  remaining: number;
  nextTickAt: number;
  tickInterval: number;
  damagePerTick: number;
  stacks: number;
}

export interface EnemyState {
  id: number;
  template: EnemyTemplateKey;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  resist: number;
  speed: number;
  nextAttackAt: number;
  dots: DotInstance[];
  traitCooldownAt?: number;
  bossMechanicTriggered?: boolean;
}
