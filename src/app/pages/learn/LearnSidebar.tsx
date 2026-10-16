import { Check } from "lucide-react";
import { useMemo } from "react";
import { navigate } from "@/app/lib/router";
import { updateLearnSettings, useLearnSettings, useReps } from "@/app/lib/learnStore";
import { computeRatings } from "@/app/lib/ratings";
import { useSolves } from "@/app/lib/store";
import type { LookaheadRep, Rep } from "@/shared/learn";
import { itemLabel, LEARN_ITEMS, learnItem, type LearnItem } from "./items";
import { currentBpm } from "./lookahead/storage";

function count(id: string, algs: Record<string, string>): string {
  const item = learnItem(id);
  if (item?.kind !== "cases") return "";
  const learned = item.cases.filter((c) => algs[c.id] !== undefined).length;
  return `${learned}/${item.cases.length}`;
}

/** The drills' numbers, as in round-9 08: his cross rating (from solves; drills never move it) and the bpm. */
function drillValues(reps: readonly Rep[], crossRating: number | null): Record<string, string> {
  const rating = crossRating === null ? "" : String(Math.round(crossRating));
  const lookahead = reps.filter((rep): rep is LookaheadRep => rep.kind === "lookahead");
  return { cross: rating, xcross: rating, lookahead: `${currentBpm(lookahead)} bpm` };
}

/** Learning it or not: unchecking only takes it off the list; its algs and reps stay, so checking it brings them back. */
function setLearning(id: string, on: boolean): void {
  updateLearnSettings((s) => ({ ...s, items: on ? [...s.items.filter((item) => item !== id), id] : s.items.filter((item) => item !== id) }));
}

type RowProps = { item: LearnItem; learning: boolean; selected: boolean; value: string };

function Row({ item, learning, selected, value }: RowProps) {
  const label = itemLabel(item.id);
  return (
    <li className={[selected ? "selected" : "", learning ? "" : "off"].filter(Boolean).join(" ")}>
      <button
        role="checkbox"
        aria-checked={learning}
        aria-label={`Learning ${label}`}
        className="learn-check"
        onClick={() => setLearning(item.id, !learning)}
      >
        {learning && <Check strokeWidth={2.5} aria-hidden="true" />}
      </button>
      <button className="learn-open" onClick={() => navigate(`/learn/${encodeURIComponent(item.id)}`)}>
        <span>{label}</span>
        <span className="count">{learning ? value : ""}</span>
      </button>
    </li>
  );
}

/**
 * Everything he could learn, case sets then drills (round-9 08), each with a check for whether he's learning it.
 * Picking a row opens it either way.
 */
export function LearnSidebar({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const reps = useReps();
  const solves = useSolves();
  const crossRating = useMemo(() => computeRatings(solves).cross?.rating ?? null, [solves]);
  // Not memoised: the bpm comes from what he last set on the lookahead page, not only from reps.
  const values = drillValues(reps, crossRating);
  const selected = set ?? settings.items[0];
  const valueOf = (item: LearnItem) => (item.kind === "cases" ? count(item.id, settings.algs) : (values[item.id] ?? ""));
  const groups = [LEARN_ITEMS.filter((item) => item.kind === "cases"), LEARN_ITEMS.filter((item) => item.kind !== "cases")];

  return (
    <div className="learn-sidebar">
      {groups.map((items, i) => (
        <ul key={i} className="learn-items">
          {items.map((item) => (
            <Row key={item.id} item={item} learning={settings.items.includes(item.id)} selected={item.id === selected} value={valueOf(item)} />
          ))}
        </ul>
      ))}
    </div>
  );
}
