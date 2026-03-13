import type { SkillPracticalExplain } from "@/core/build/skillExplain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatSeconds } from "@/lib/format";

interface SkillDetailCardProps {
  detail: SkillPracticalExplain;
}

const ROLE_LABEL: Record<SkillPracticalExplain["role"], string> = {
  setup: "铺垫",
  burst: "爆发",
  finisher: "收尾",
  cycle: "循环",
  defense: "防御",
};

export function SkillDetailCard({ detail }: SkillDetailCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span>{detail.name}</span>
          <Badge variant="outline">{ROLE_LABEL[detail.role]}</Badge>
          <Badge variant="secondary">CD {formatSeconds(detail.cooldown)}</Badge>
          <Badge variant="secondary">消耗 {formatNumber(detail.cost)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <p className="text-muted-foreground">{detail.effectDescription}</p>
        <p className="text-muted-foreground">{detail.strongWhen}</p>
        {detail.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {detail.tags.map((tag) => (
              <Badge key={`${detail.skillId}-${tag}`} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {detail.estimated.directPerHit !== undefined ? (
            <Metric label="预计单段直伤" value={formatNumber(detail.estimated.directPerHit)} />
          ) : null}
          {detail.estimated.directPerCast !== undefined ? (
            <Metric label="预计单次直伤" value={formatNumber(detail.estimated.directPerCast)} />
          ) : null}
          {detail.estimated.dotTick !== undefined ? (
            <Metric label="预计 DOT 单跳" value={formatNumber(detail.estimated.dotTick)} />
          ) : null}
          {detail.estimated.dotFullMaxStacks !== undefined ? (
            <Metric label="预计 DOT 满层总值" value={formatNumber(detail.estimated.dotFullMaxStacks)} />
          ) : null}
          {detail.estimated.procPerTrigger !== undefined ? (
            <Metric label="预计触发伤害" value={formatNumber(detail.estimated.procPerTrigger)} />
          ) : null}
          {detail.estimated.shieldGain !== undefined ? (
            <Metric label="预计护盾" value={formatNumber(detail.estimated.shieldGain)} />
          ) : null}
          {detail.estimated.healGain !== undefined ? (
            <Metric label="预计治疗" value={formatNumber(detail.estimated.healGain)} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border bg-background p-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
