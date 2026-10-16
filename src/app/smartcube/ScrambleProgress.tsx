import type { PlanView } from "./session";

/** The scramble band, following the physical cube: done moves filled, the next one outlined, a half-done half turn half filled. */
export function ScrambleProgress({ plan }: { plan: PlanView }) {
  return (
    <div className="cube-scramble">
      <div className={`scramble ${plan.fix ? "fix" : ""}`} aria-label={plan.fix ? "moves back to the scramble" : "scramble"}>
        {plan.moves.length === 0 ? (
          <span className="mv">&nbsp;</span>
        ) : (
          plan.moves.map((move, i) => {
            const state = i < plan.done ? "done" : i === plan.done ? (plan.half ? "next half" : "next") : "";
            return (
              <span key={i} className={`mv ${state}`}>
                {move}
              </span>
            );
          })
        )}
      </div>
      {(plan.fix || plan.thinking) && (
        <p className="cube-scramble-note">{plan.thinking ? "working out the moves to the scramble…" : "off the scramble: these moves get you back"}</p>
      )}
    </div>
  );
}
