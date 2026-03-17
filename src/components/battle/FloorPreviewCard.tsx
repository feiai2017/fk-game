import type { FloorPreview } from "@/core/battle/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FloorPreviewCardProps {
  preview: FloorPreview;
  compact?: boolean;
}

export function FloorPreviewCard({ preview, compact = false }: FloorPreviewCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>第 {preview.floor} 层：{preview.title}</span>
          <Badge variant="outline">楼层预览</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border bg-background p-2">
          <p className="text-muted-foreground">{preview.subtitle}</p>
          <p className="mt-1 text-xs text-amber-700">危险提示：{preview.dangerHint}</p>
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">敌人预览</p>
          <p className="text-xs text-muted-foreground">波次数：{preview.waves.length}</p>
          <p className="text-xs text-muted-foreground">{preview.waveSummary}</p>
          <div className="mt-2 space-y-2">
            {preview.waves.map((wave) => (
              <div key={wave.index} className="rounded border border-border p-2">
                <p className="text-xs font-semibold">第 {wave.index} 波 · {wave.title}</p>
                <div className="mt-1 space-y-1">
                  {wave.enemies.map((enemy) => (
                    <p key={`${wave.index}-${enemy.template}`} className="text-xs">
                      - {enemy.name} x{enemy.count}（{enemy.tags.join(" / ")}）：{enemy.description}
                    </p>
                  ))}
                </div>
                {wave.note ? <p className="mt-1 text-[11px] text-muted-foreground">{wave.note}</p> : null}
              </div>
            ))}
          </div>
        </div>

        {preview.boss ? (
          <div className="rounded-md border bg-background p-2">
            <p className="text-xs font-semibold">首领信息：{preview.boss.name}</p>
            <p className="mt-1 text-xs">被动：{preview.boss.passive}</p>
            <p className="mt-1 text-xs">技能：{preview.boss.skills.join("；")}</p>
            <p className="mt-1 text-xs">阶段：{preview.boss.phaseTrigger}</p>
            <p className="mt-1 text-xs text-amber-700">危险提示：{preview.boss.dangerTip}</p>
          </div>
        ) : null}

        {compact ? null : (
          <p className="text-xs text-muted-foreground">
            建议先根据敌人特性调整构筑，再开始本层挑战。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
