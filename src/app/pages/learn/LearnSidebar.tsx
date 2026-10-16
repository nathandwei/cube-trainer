import { navigate } from "@/app/lib/router";
import { updateLearnSettings, useLearnSettings, useReps } from "@/app/lib/learnStore";
import type { CrossRep, LookaheadRep, Rep } from "@/shared/learn";
import { crossRating } from "./cross/rating";
import { itemLabel, LEARN_ITEMS, learnItem } from "./items";
import { currentBpm } from "./lookahead/storage";

function count(id: string, algs: Record<string, string>): string {
  const item = learnItem(id);
  if (item?.kind !== "cases") return "";
  const learned = item.cases.filter((c) => algs[c.id] !== undefined).length;
  return `${learned}/${item.cases.length}`;
}

/** The drills' own numbers, as in round-9 08: the cross ratings and the lookahead bpm. */
function drillValues(reps: readonly Rep[]): Record<string, string> {
  const crossReps = reps.filter((rep): rep is CrossRep => rep.kind === "cross");
  const rating = (variant: string) => {
    const found = crossRating(crossReps.filter((rep) => rep.item === variant));
    return found ? String(Math.round(found.rating)) : "";
  };
  const lookahead = reps.filter((rep): rep is LookaheadRep => rep.kind === "lookahead");
  return { cross: rating("cross"), xcross: rating("xcross"), lookahead: `${currentBpm(lookahead)} bpm` };
}

function ItemList({ ids, selected, value }: { ids: readonly string[]; selected?: string; value: (id: string) => string }) {
  return (
    <ul className="learn-items">
      {ids.map((id) => (
        <li key={id} className={id === selected ? "selected" : ""}>
          <button onClick={() => navigate(`/learn/${encodeURIComponent(id)}`)}>
            <span>{itemLabel(id)}</span>
            <span className="count">{value(id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What he's learning: case sets, then the skill drills, then everything else he could add (round-9 08). */
export function LearnSidebar({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const reps = useReps();
  // Not memoised: the bpm comes from what he last set on the lookahead page, not only from reps.
  const values = drillValues(reps);
  const added = settings.items;
  const selected = set ?? added[0];
  const sets = added.filter((id) => learnItem(id)?.kind === "cases");
  const drills = added.filter((id) => learnItem(id) !== undefined && learnItem(id)?.kind !== "cases");
  const available = LEARN_ITEMS.filter((item) => !added.includes(item.id));

  return (
    <div className="learn-sidebar">
      {sets.length > 0 && <ItemList ids={sets} selected={selected} value={(id) => count(id, settings.algs)} />}
      {drills.length > 0 && <ItemList ids={drills} selected={selected} value={(id) => values[id] ?? ""} />}
      {available.length > 0 && (
        <div className="add-more">
          <span className="label">Add</span>
          <ul>
            {available.map((item) => (
              <li key={item.id}>
                <button onClick={() => updateLearnSettings((s) => ({ ...s, items: [...s.items, item.id] }))}>+ {itemLabel(item.id)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
