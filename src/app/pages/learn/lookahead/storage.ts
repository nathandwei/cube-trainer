import { currentAccount } from "@/app/lib/account";
import { clampBpm, startingBpm, type BpmResult } from "./bpm";

const BPM_KEY_PREFIX = "cube.lookahead.bpm.";

function bpmKey(): string | null {
  const account = currentAccount();
  return account ? BPM_KEY_PREFIX + account.id : null;
}

export function readStoredBpm(): number | null {
  const key = bpmKey();
  if (!key) return null;
  try {
    const saved = Number(localStorage.getItem(key));
    return saved > 0 ? clampBpm(saved) : null;
  } catch (error) {
    console.warn("Could not read the lookahead bpm", error);
    return null;
  }
}

export function storeBpm(bpm: number): void {
  const key = bpmKey();
  if (!key) return;
  try {
    localStorage.setItem(key, String(bpm));
  } catch (error) {
    console.warn("Could not save the lookahead bpm", error);
  }
}

/** The bpm he drills at now: the one he last set or was moved to, else what his reps suggest. */
export function currentBpm(history: readonly BpmResult[]): number {
  return readStoredBpm() ?? startingBpm(history);
}
