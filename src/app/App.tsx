import { useState } from "react";
import { ReviewPage } from "@/app/ReviewPage";
import { Sidebar } from "@/app/Sidebar";
import { TimerPage } from "@/app/TimerPage";
import { useRoute } from "@/app/lib/router";
import { useSolves } from "@/app/lib/store";

export function App() {
  const route = useRoute();
  const solves = useSolves();
  const [focused, setFocused] = useState(false);
  const selectedId = route.page === "review" ? route.id : undefined;

  return (
    <div className={`shell ${focused ? "focus" : ""}`}>
      <Sidebar solves={solves} selectedId={selectedId} />
      <main className="main">
        {route.page === "review" ? (
          <ReviewPage solve={solves.find((s) => s.id === route.id)} />
        ) : (
          <TimerPage solves={solves} onFocusChange={setFocused} />
        )}
      </main>
    </div>
  );
}
