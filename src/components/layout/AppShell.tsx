import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";

export function AppShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-5 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}

