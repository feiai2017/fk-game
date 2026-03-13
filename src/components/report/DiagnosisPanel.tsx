import type { BattleReport } from "@/core/battle/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tDiagnosisCode } from "@/lib/i18n";

interface DiagnosisPanelProps {
  report: BattleReport;
}

export function DiagnosisPanel({ report }: DiagnosisPanelProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>自动诊断</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {report.diagnosis.length > 0 ? (
          report.diagnosis.map((entry) => (
            <div key={entry.code} className="rounded-md border bg-background p-2">
              <p className="text-xs font-semibold">{tDiagnosisCode(entry.code)}</p>
              <p className="text-sm text-muted-foreground">{entry.message}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">未检测到明显问题。</p>
        )}
      </CardContent>
    </Card>
  );
}
