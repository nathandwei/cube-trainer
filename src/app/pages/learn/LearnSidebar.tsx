import { navigate } from "@/app/lib/router";
import { updateLearnSettings, useLearnSettings } from "@/app/lib/learnStore";
import { LEARN_ITEMS, learnItem } from "./items";

function count(id: string, algs: Record<string, string>): string {
  const item = learnItem(id);
  if (item?.kind !== "cases") return "";
  const learned = item.cases.filter((c) => algs[c.id] !== undefined).length;
  return `${learned}/${item.cases.length}`;
}

/** What he's learning (pick one to open it), and everything else he could add. */
export function LearnSidebar({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const added = settings.items;
  const available = LEARN_ITEMS.filter((item) => !added.includes(item.id));

  return (
    <div className="learn-sidebar">
      <ul className="learn-items">
        {added.map((id) => (
          <li key={id} className={id === set ? "selected" : ""}>
            <button onClick={() => navigate(`/learn/${encodeURIComponent(id)}`)}>
              <span>{id}</span>
              <span className="count">{count(id, settings.algs)}</span>
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <div className="add-more">
          <span className="label">add more</span>
          <ul>
            {available.map((item) => (
              <li key={item.id}>
                <button onClick={() => updateLearnSettings((s) => ({ ...s, items: [...s.items, item.id] }))}>
                  + {item.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
