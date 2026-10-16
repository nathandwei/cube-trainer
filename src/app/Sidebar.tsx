import type { ReactNode } from "react";
import { AccountRow } from "@/app/components/AccountRow";
import { navigate, type Tab } from "@/app/lib/router";

const TABS: readonly { tab: Tab; path: string }[] = [
  { tab: "timer", path: "/" },
  { tab: "learn", path: "/learn" },
  { tab: "stats", path: "/stats" },
];

/** The shell's left column: tabs, then whatever the current tab puts there, then the account. */
export function Sidebar({ active, children }: { active: Tab | null; children: ReactNode }) {
  return (
    <aside className="sidebar">
      <nav className="nav">
        {TABS.map(({ tab, path }) => (
          <a
            key={tab}
            href={path}
            className={tab === active ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigate(path);
            }}
          >
            {tab}
          </a>
        ))}
      </nav>
      <div className="sidebar-body">{children}</div>
      <AccountRow />
    </aside>
  );
}
