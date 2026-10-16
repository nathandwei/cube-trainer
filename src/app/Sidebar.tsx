import type { ReactNode } from "react";
import { AccountRow } from "@/app/components/AccountRow";
import { navigate, type Tab } from "@/app/lib/router";

const TABS: readonly { tab: Tab; path: string; label: string }[] = [
  { tab: "timer", path: "/", label: "Timer" },
  { tab: "learn", path: "/learn", label: "Learn" },
  { tab: "stats", path: "/stats", label: "Stats" },
];

/** The shell's left column: tabs, then whatever the current tab puts there, then the account. */
export function Sidebar({ active, children }: { active: Tab | null; children: ReactNode }) {
  return (
    <aside className="sidebar">
      <nav className="nav">
        {TABS.map(({ tab, path, label }) => (
          <a
            key={tab}
            href={path}
            className={tab === active ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigate(path);
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-body">{children}</div>
      <AccountRow />
    </aside>
  );
}
