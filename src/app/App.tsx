import { useState } from "react";
import { ReviewPage } from "@/app/ReviewPage";
import { Sidebar } from "@/app/Sidebar";
import { SignInPage } from "@/app/SignInPage";
import { SolvesSidebar } from "@/app/SolvesSidebar";
import { TimerPage } from "@/app/TimerPage";
import { useAccount } from "@/app/lib/account";
import { tabOf, useRoute } from "@/app/lib/router";
import { LearnPage } from "@/app/pages/learn/LearnPage";
import { LearnSidebar } from "@/app/pages/learn/LearnSidebar";
import { SettingsPage } from "@/app/pages/settings/SettingsPage";
import { SettingsHeader, SettingsSidebar } from "@/app/pages/settings/SettingsSidebar";
import { StatsPage } from "@/app/pages/stats/StatsPage";
import { StatsSidebar } from "@/app/pages/stats/StatsSidebar";
import { reviewOnlySolve, TEST_SOLVE_ID, useSaveError, useSolves, useTestSolve } from "@/app/lib/store";

export function App() {
  const account = useAccount();
  if (account.status === "loading") return null;
  if (account.status === "signed-out") return <SignInPage />;
  return <Shell />;
}

function Shell() {
  const route = useRoute();
  const solves = useSolves();
  const saveError = useSaveError();
  const testSolve = useTestSolve();
  const [focused, setFocused] = useState(false);
  const selectedId = route.page === "review" ? route.id : route.page === "timer" ? route.selected : undefined;

  function sidebarContent() {
    switch (route.page) {
      case "learn":
        return <LearnSidebar set={route.set} />;
      case "stats":
        return <StatsSidebar />;
      case "settings":
        return <SettingsSidebar />;
      default:
        return <SolvesSidebar solves={solves} selectedId={selectedId} />;
    }
  }

  function reviewPage(id: string) {
    if (id === TEST_SOLVE_ID) return <ReviewPage solve={testSolve ?? undefined} />;
    const listed = solves.find((s) => s.id === id);
    if (listed) return <ReviewPage solve={listed} />;
    const other = reviewOnlySolve(id);
    return <ReviewPage solve={other?.solve} back={other?.back} />;
  }

  function page() {
    switch (route.page) {
      case "review":
        return reviewPage(route.id);
      case "learn":
        return <LearnPage set={route.set} caseId={route.caseId} />;
      case "stats":
        return <StatsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <TimerPage solves={solves} testSolve={testSolve} selectedId={route.selected} onFocusChange={setFocused} />;
    }
  }

  return (
    <div className={`shell ${focused ? "focus" : ""}`}>
      <Sidebar active={tabOf(route)} header={route.page === "settings" ? <SettingsHeader /> : undefined}>
        {sidebarContent()}
      </Sidebar>
      <main className="main">
        {saveError && (
          <p className="save-error" role="alert">
            {saveError}
          </p>
        )}
        {page()}
      </main>
    </div>
  );
}
