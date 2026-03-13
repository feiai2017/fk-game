import type { BattleReport } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import { tDamageCategory } from "@/lib/i18n";

interface DamageBreakdownProps {
  report: BattleReport;
}

export function DamageBreakdown({ report }: DamageBreakdownProps): JSX.Element {
  const dotRatio = report.metrics.dotDamageRatio;
  const procRatio = report.metrics.procDamageRatio;
  const recomputed = recomputeDamageRatios(report.metrics.damageBySource, report.metrics.totalDamage);
  const tolerance = 0.005;
  const metricMismatch =
    Math.abs(recomputed.basicAttackRatio - report.metrics.basicAttackRatio) > tolerance ||
    Math.abs(recomputed.skillRatio - report.metrics.skillRatio) > tolerance ||
    Math.abs(recomputed.coreTriggerRatio - report.metrics.coreTriggerRatio) > tolerance;

  return (
    <Card>
      <CardHeader>
        <CardTitle>伤害拆解</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metricMismatch ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            调试提示：核心指标与页面复算存在偏差（超过0.5%），请检查统计逻辑。
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="持续伤害占比" value={formatPercent(dotRatio)} />
          <Metric label="触发伤害占比" value={formatPercent(procRatio)} />
          <Metric label="持续伤害总量" value={formatNumber(report.metrics.dotDamage)} />
          <Metric label="触发伤害总量" value={formatNumber(report.metrics.procDamage)} />
          <Metric label="普攻占比(复算)" value={formatPercent(recomputed.basicAttackRatio)} />
          <Metric label="技能占比(复算)" value={formatPercent(recomputed.skillRatio)} />
          <Metric label="触发占比(复算)" value={formatPercent(recomputed.coreTriggerRatio)} />
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1">来源</th>
                <th className="py-1">类型</th>
                <th className="py-1 text-right">伤害</th>
                <th className="py-1 text-right">占比</th>
              </tr>
            </thead>
            <tbody>
              {report.metrics.damageBySource.map((entry) => (
                <tr key={`${entry.sourceId}:${entry.category}`} className="border-t">
                  <td className="py-1">{entry.sourceName}</td>
                  <td className="py-1">{tDamageCategory(entry.category)}</td>
                  <td className="py-1 text-right">{formatNumber(entry.total)}</td>
                  <td className="py-1 text-right">
                    {formatPercent(ratio(entry.total, report.metrics.totalDamage))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.formulaBreakdowns && report.formulaBreakdowns.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Top3 伤害来源公式拆解（近似）</p>
            {report.formulaBreakdowns.map((entry) => (
              <div key={`${entry.sourceId}-${entry.category}`} className="rounded-md border bg-background p-2 text-xs">
                <p className="font-semibold">
                  {entry.sourceName} · {tDamageCategory(entry.category)} · {formatPercent(entry.ratioToTotal)}
                </p>
                <p className="text-muted-foreground">
                  {entry.baseTerm} × {entry.sourceRatioTerm} × {entry.majorModifiers.join(" × ")}
                </p>
                <p className="text-muted-foreground">
                  防御修正 {entry.defenseMultiplier.toFixed(2)}，抗性修正 {entry.resistMultiplier.toFixed(2)}
                </p>
                <p className="text-muted-foreground">
                  估算单段最终值 {formatNumber(entry.finalApproxPerHit)}；{entry.reductionSummary}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function recomputeDamageRatios(
  entries: BattleReport["metrics"]["damageBySource"],
  totalDamage: number,
): {
  basicAttackRatio: number;
  skillRatio: number;
  coreTriggerRatio: number;
} {
  const basic = entries
    .filter((entry) => entry.sourceId === "basic_attack")
    .reduce((sum, entry) => sum + entry.total, 0);
  const core = entries
    .filter((entry) => entry.sourceId.startsWith("trigger:") || entry.sourceId.startsWith("core_"))
    .reduce((sum, entry) => sum + entry.total, 0);
  const skill = Math.max(0, totalDamage - basic - core);
  return {
    basicAttackRatio: ratio(basic, totalDamage),
    skillRatio: ratio(skill, totalDamage),
    coreTriggerRatio: ratio(core, totalDamage),
  };
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ratio(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return part / total;
}
