import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/run", label: "运行演示" },
  { to: "/build", label: "构筑" },
  { to: "/tower", label: "爬塔" },
  { to: "/report", label: "战报" },
];

export function Header(): JSX.Element {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">构筑验证自走战斗原型</h1>
          <p className="text-xs text-muted-foreground">阶段一演示版</p>
        </div>
        <nav className="flex items-center gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-secondary text-secondary-foreground",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
