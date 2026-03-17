import type { DemoBuildSummary } from "@/core/build/demoBuildSummary";
import type { FloorPreview } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreBattleScreenProps {
  floorPreview?: FloorPreview;
  buildSummary: DemoBuildSummary;
  canStart: boolean;
  strengths: string[];
  weaknesses: string[];
  onStartBattle: () => void;
  onOpenBuild: () => void;
  onOpenReport: () => void;
}

export function PreBattleScreen(props: PreBattleScreenProps): JSX.Element {
  const {
    floorPreview,
    buildSummary,
    canStart,
    strengths,
    weaknesses,
    onStartBattle,
    onOpenBuild,
    onOpenReport,
  } = props;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            第 {floorPreview?.floor ?? "-"} 层 · {floorPreview?.title ?? "未知楼层"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{floorPreview?.subtitle ?? "本层信息尚未就绪。"}</p>
          <p className="text-xs text-amber-700">危险提示：{floorPreview?.dangerHint ?? "优先观察首杀与承伤。"}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>敌人情报</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              本层类型：
              <span className="font-semibold">
                {floorPreview?.boss ? "首领战" : "普通战"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">波次数：{floorPreview?.waves.length ?? 1}</p>
            {floorPreview?.waves.map((wave) => (
              <div key={wave.index} className="rounded-md border bg-background p-2">
                <p className="text-xs font-semibold">第 {wave.index} 波 · {wave.title}</p>
                <div className="mt-1 space-y-1">
                  {wave.enemies.map((enemy) => (
                    <p key={`${wave.index}-${enemy.template}`} className="text-xs">
                      - {enemy.name} x{enemy.count}（{enemy.tags.join(" / ")}）
                      <br />
                      <span className="text-muted-foreground">危险点：{enemy.description}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {floorPreview?.boss ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs">
                <p className="font-semibold">Boss：{floorPreview.boss.name}</p>
                <p className="mt-1">被动：{floorPreview.boss.passive}</p>
                <p className="mt-1">技能：{floorPreview.boss.skills.join("；")}</p>
                <p className="mt-1">阶段：{floorPreview.boss.phaseTrigger}</p>
                <p className="mt-1 text-amber-700">危险提示：{floorPreview.boss.dangerTip}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前构筑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              流派：<span className="font-semibold">{buildSummary.archetypeLabel}</span>
            </p>
            <p>
              路线：<span className="font-semibold">{buildSummary.routeLabel}</span>
            </p>
            <p>核心技能：{buildSummary.coreSkills.join(" / ")}</p>
            <p>关键加成：{buildSummary.keyBonuses.join("，")}</p>
            <p className="text-muted-foreground">{buildSummary.summaryText}</p>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md border bg-background p-2">
                <p className="text-xs text-muted-foreground">当前优势</p>
                {strengths.length > 0 ? (
                  strengths.map((entry) => (
                    <p key={entry} className="text-xs">- {entry}</p>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">- 暂无稳定优势结论</p>
                )}
              </div>
              <div className="rounded-md border bg-background p-2">
                <p className="text-xs text-muted-foreground">当前短板</p>
                {weaknesses.length > 0 ? (
                  weaknesses.map((entry) => (
                    <p key={entry} className="text-xs">- {entry}</p>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">- 暂无明显短板</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Button size="lg" disabled={!canStart} onClick={onStartBattle}>
            开始挑战
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenBuild}>
            打开构筑页
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenReport}>
            查看详细战报
          </Button>
          {!canStart ? <Badge variant="outline">当前不可开始（请先完成奖励选择或重开）</Badge> : null}
        </CardContent>
      </Card>
    </div>
  );
}
