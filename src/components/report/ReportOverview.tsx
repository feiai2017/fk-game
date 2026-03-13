import type { BattleReport } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import { tPressure } from "@/lib/i18n";

interface ReportOverviewProps {
  report: BattleReport;
}

export function ReportOverview({ report }: ReportOverviewProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>战斗总览</span>
          <Badge>{report.win ? "胜利" : "失败"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <Stat label="楼层" value={`${report.floor} (${tPressure(report.pressure)})`} />
        <Stat label="时长" value={formatSeconds(report.metrics.duration)} />
        <Stat label="总伤害" value={formatNumber(report.metrics.totalDamage)} />
        <Stat label="承受伤害" value={formatNumber(report.metrics.damageTaken)} />
        <Stat label="剩余生命" value={formatNumber(report.metrics.remainingHp)} />
        <Stat label="爆发DPS" value={formatNumber(report.metrics.burstDps)} />
        <Stat label="持续DPS" value={formatNumber(report.metrics.sustainDps)} />
        <Stat label="启动时间" value={formatSeconds(report.metrics.startupTime)} />
        <Stat
          label="资源匮乏率"
          value={formatPercent(report.metrics.resourceStarvedRate)}
        />
        <Stat
          label="资源溢出率"
          value={formatPercent(report.metrics.resourceOverflowRate)}
        />
        <Stat label="普攻伤害" value={formatNumber(report.metrics.basicAttackDamage)} />
        <Stat label="技能伤害" value={formatNumber(report.metrics.skillDamage)} />
        <Stat label="触发伤害" value={formatNumber(report.metrics.coreTriggerDamage)} />
        <Stat label="直伤占比" value={formatPercent(report.metrics.directDamageRatio)} />
        <Stat label="DOT占比" value={formatPercent(report.metrics.dotDamageRatio)} />
        <Stat label="触发占比" value={formatPercent(report.metrics.procDamageRatio)} />
        <Stat
          label="普攻占比"
          value={formatPercent(report.metrics.basicAttackRatio)}
        />
        <Stat
          label="技能占比"
          value={formatPercent(report.metrics.skillRatio)}
        />
        <Stat
          label="触发源占比"
          value={formatPercent(report.metrics.coreTriggerRatio)}
        />
        <Stat
          label="首杀时间"
          value={report.metrics.firstKillTime === null ? "无" : formatSeconds(report.metrics.firstKillTime)}
        />
        <Stat
          label="失败剩余血量比"
          value={formatPercent(report.metrics.enemyRemainingHpRatio)}
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
