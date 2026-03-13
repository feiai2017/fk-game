import type { BuildProfileSummary } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BuildProfileCardProps {
  profile: BuildProfileSummary;
}

export function BuildProfileCard({ profile }: BuildProfileCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>构筑画像 ({profile.source === "lastReport" ? "实战" : "预估"})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">构筑倾向</p>
          <p className="text-sm font-semibold">{profile.identity}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Metric label="启动节奏" value={startup(profile.startupProfile)} />
          <Metric label="清场能力" value={strength(profile.clearProfile)} />
          <Metric label="单体收尾" value={strength(profile.singleTargetProfile)} />
          <Metric label="生存能力" value={strength(profile.survivalProfile)} />
          <Metric label="资源利用" value={resource(profile.resourceUtilization)} />
          <Metric label="机制贡献" value={strength(profile.mechanismContribution)} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {profile.notes.map((note) => (
            <p key={note}>- {note}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function startup(value: "slow" | "medium" | "fast"): string {
  if (value === "slow") {
    return "偏慢";
  }
  if (value === "medium") {
    return "中等";
  }
  return "偏快";
}

function strength(value: "weak" | "medium" | "strong"): string {
  if (value === "weak") {
    return "偏弱";
  }
  if (value === "medium") {
    return "中等";
  }
  return "较强";
}

function resource(value: "poor" | "fair" | "good"): string {
  if (value === "poor") {
    return "较差";
  }
  if (value === "fair") {
    return "一般";
  }
  return "良好";
}
