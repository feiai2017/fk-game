import type { BuildComparisonHint } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BuildComparisonCardProps {
  hints: BuildComparisonHint[];
}

export function BuildComparisonCard({ hints }: BuildComparisonCardProps): JSX.Element {
  if (hints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>预计变化</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">当前构筑与上次实战构筑差异较小。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>预计变化（相对上次实战）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hints.map((hint) => (
          <div key={`${hint.aspect}-${hint.message}`} className="rounded-md border bg-background p-2">
            <p className="text-sm">{hint.message}</p>
            <p
              className={`text-xs ${
                hint.direction === "better"
                  ? "text-emerald-600"
                  : hint.direction === "worse"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {hint.direction === "better"
                ? "预计改进"
                : hint.direction === "worse"
                  ? "可能变差"
                  : "变化不明显"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
