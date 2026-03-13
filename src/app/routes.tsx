import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { BuildPage } from "@/pages/BuildPage";
import { ReportPage } from "@/pages/ReportPage";
import { RunSummaryPage } from "@/pages/RunSummaryPage";
import { TowerPage } from "@/pages/TowerPage";

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/build" replace />} />
        <Route path="build" element={<BuildPage />} />
        <Route path="tower" element={<TowerPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="run-summary" element={<RunSummaryPage />} />
      </Route>
    </Routes>
  );
}
