import { useMemo, useState } from "react";
import type { BattleReport, RunState } from "@/core/battle/types";
import { buildBattleAnalysisExport } from "@/core/report/exportBattleReport";
import { buildBattleAnalysisMarkdown } from "@/core/report/exportBattleSummary";
import { Button } from "@/components/ui/button";

interface ExportReportButtonProps {
  report: BattleReport;
  run: RunState;
}

export function ExportReportButton({ report, run }: ExportReportButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const bundle = useMemo(
    () =>
      buildBattleAnalysisExport({
        report,
        runId: run.id,
        runProgress: run.progress,
      }),
    [report, run.id, run.progress],
  );

  const handleExportJson = () => {
    const filename = `battle-analysis-floor-${report.floor}-${bundle.generatedAt
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "")}.json`;
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    const markdown = buildBattleAnalysisMarkdown(bundle);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={handleExportJson}>
        导出分析包
      </Button>
      <Button size="sm" variant="ghost" onClick={handleCopyMarkdown}>
        {copied ? "已复制摘要" : "复制分析摘要"}
      </Button>
    </div>
  );
}
