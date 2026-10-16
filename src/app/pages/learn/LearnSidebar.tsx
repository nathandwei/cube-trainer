import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "@/app/components/IconButton";
import { navigate } from "@/app/lib/router";
import { updateLearnSettings, useLearnSettings, useReps } from "@/app/lib/learnStore";
import { computeRatings } from "@/app/lib/ratings";
import { useSolves } from "@/app/lib/store";
import type { LookaheadRep, Rep } from "@/shared/learn";
import { itemLabel, LEARN_ITEMS, learnItem, type LearnItem } from "./items";
import { clearCalibration, requestCalibration } from "./calibrateRequest";
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

/** Learning it or not: unticking only takes it off the list; its algs and reps stay, so ticking it brings them back. */
function setLearning(id: string, on: boolean): void {
  updateLearnSettings((s) => ({ ...s, items: on ? [...s.items.filter((item) => item !== id), id] : s.items.filter((item) => item !== id) }));
}

type RowProps = { item: LearnItem; selected: boolean; value: string };

function Row({ item, selected, value }: RowProps) {
  return (
    <li className={selected ? "selected" : ""}>
      <button className="learn-open" onClick={() => navigate(`/learn/${encodeURIComponent(item.id)}`)}>
        <span>{itemLabel(item.id)}</span>
        <span className="count">{value}</span>
      </button>
    </li>
  );
}

/** Everything he could learn, ticked or not; ticking a set he has no algs for starts its calibration. */
function Checklist({ items, algs, onClose }: { items: readonly string[]; algs: Record<string, string>; onClose: () => void }) {
  function toggle(item: LearnItem, on: boolean) {
    setLearning(item.id, on);
    if (!on) {
      clearCalibration();
      return;
    }
    navigate(`/learn/${encodeURIComponent(item.id)}`);
    if (item.kind === "cases" && !item.cases.some((c) => algs[c.id] !== undefined)) requestCalibration(item.id);
  }
  return (
    <div className="learn-checklist">
      <ul>
        {LEARN_ITEMS.map((item) => {
          const on = items.includes(item.id);
          return (
            <li key={item.id}>
              <button role="checkbox" aria-checked={on} className="learn-check-row" onClick={() => toggle(item, !on)}>
                <span className="learn-check" aria-hidden="true">
                  {on && <Check strokeWidth={2.5} />}
                </span>
                {itemLabel(item.id)}
              </button>
            </li>
          );
        })}
      </ul>
      <button className="pill small" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

/**
 * What he's learning: case sets, then drills (round-9 08). The + opens a checklist of everything there is, to tick
 * or untick; unticked items keep their progress.
 */
export function LearnSidebar({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const reps = useReps();
  const solves = useSolves();
  const [editing, setEditing] = useState(false);
  const crossRating = useMemo(() => computeRatings(solves).cross?.rating ?? null, [solves]);
  // Not memoised: the bpm comes from what he last set on the lookahead page, not only from reps.
  const values = drillValues(reps, crossRating);
  const selected = set ?? settings.items[0];
  const learning = LEARN_ITEMS.filter((item) => settings.items.includes(item.id));
  const valueOf = (item: LearnItem) => (item.kind === "cases" ? count(item.id, settings.algs) : (values[item.id] ?? ""));
  const groups = [learning.filter((item) => item.kind === "cases"), learning.filter((item) => item.kind !== "cases")].filter((group) => group.length > 0);

  return (
    <div className="learn-sidebar">
      {groups.map((items, i) => (
        <ul key={i} className="learn-items">
          {items.map((item) => (
            <Row key={item.id} item={item} selected={item.id === selected} value={valueOf(item)} />
          ))}
        </ul>
      ))}
      {editing ? (
        <Checklist items={settings.items} algs={settings.algs} onClose={() => setEditing(false)} />
      ) : (
        <IconButton icon={Plus} label="Add or remove" variant="soft" className="learn-add" onClick={() => setEditing(true)} />
      )}
    </div>
  );
}
