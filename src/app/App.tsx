import { useState } from "react";
import { ReviewPage } from "@/app/ReviewPage";
import { Sidebar } from "@/app/Sidebar";
import { SignInPage } from "@/app/SignInPage";
import { TimerPage } from "@/app/TimerPage";
import { useAccount } from "@/app/lib/account";
import { useRoute } from "@/app/lib/router";
import { TEST_SOLVE_ID, useSaveError, useSolves, useTestSolve } from "@/app/lib/store";

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
  const selectedId = route.page === "review" ? route.id : route.selected;

  return (
    <div className={`shell ${focused ? "focus" : ""}`}>
      <Sidebar solves={solves} selectedId={selectedId} />
      <main className="main">
        {saveError && (
          <p className="save-error" role="alert">
            {saveError}
          </p>
        )}
        {route.page === "review" ? (
          <ReviewPage solve={route.id === TEST_SOLVE_ID ? (testSolve ?? undefined) : solves.find((s) => s.id === route.id)} />
        ) : (
          <TimerPage solves={solves} testSolve={testSolve} selectedId={route.selected} onFocusChange={setFocused} />
        )}
      </main>
    </div>
  );
}
