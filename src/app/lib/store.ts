import { useSyncExternalStore } from "react";
import { beforeSignOut, currentAccount } from "@/app/lib/account";
import { idOf, isRefusal, readList, request, responseJson, SaveFailure, updateList } from "@/app/lib/sync";
import type { SolveRecord } from "@/cube/types";
import { MAX_PAGE_SIZE, solvePageSchema, solveRecordSchema } from "@/shared/schema";

// The server holds each account's solves. Every change first lands in that account's outbox in localStorage
// (cube.pending.<account id>) and leaves it only once the server has that exact version, so a reload, a dropped
// connection or a sign-out never loses it, and it is only ever sent with that account's id attached.
const OUTBOX_PREFIX = "cube.pending.";
/** Entries the server refused outright (invalid or too large): kept, never retried. */
const REJECTED_PREFIX = "cube.rejected.";
/** Solves saved before accounts existed. They go to the first account that signs in on this browser, once. */
const LEGACY_KEY = "cube.solves.v1";
const LEGACY_ADOPTED_KEY = "cube.solves.v1.adopted-by";
const UPLOAD_CONCURRENCY = 4;

type Penalty = SolveRecord["penalty"];
type State = { solves: SolveRecord[]; saveError: string | null; hasMore: boolean };

const listeners = new Set<() => void>();
let state: State = { solves: [], saveError: null, hasMore: false };
/** The account this page's solves belong to, fixed when they are first loaded. */
let accountId: string | null = null;
/** Per-solve request chains, so the server sees one solve's changes in the order they were made. */
const chains = new Map<string, Promise<void>>();
/** Ids deleted here whose DELETE has not finished, so a list fetched meanwhile cannot bring them back. */
const deleting = new Set<string>();
let loadState: "idle" | "loading" | "loaded" | "failed" = "idle";
/** Where the next older page starts, or null when everything is loaded. */
let nextCursor: string | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function publish(next: Partial<State>): void {
  state = { ...state, ...next };
  notify();
}

// An error stays until something newer replaces it: a success clears only an error older than its own request.
let errorSeq = 0;

function reportError(message: string): void {
  errorSeq += 1;
  publish({ saveError: message });
}

function clearErrorsBefore(seq: number): void {
  if (errorSeq === seq && state.saveError !== null) publish({ saveError: null });
}

/** Later lists win for the same id. Newest first. */
function merge(...lists: SolveRecord[][]): SolveRecord[] {
  const byId = new Map<string, SolveRecord>();
  for (const list of lists) for (const solve of list) byId.set(solve.id, solve);
  return [...byId.values()].filter((s) => !deleting.has(s.id)).sort((a, b) => b.createdAt - a.createdAt);
}

function parseSolve(entry: unknown, where: string): SolveRecord | null {
  const result = solveRecordSchema.safeParse(entry);
  if (result.success) return result.data as SolveRecord;
  console.warn(`A ${where} solve does not match the schema`, result.error.issues);
  return null;
}

// ---------- server ----------

function api(method: string, path: string, body?: string): Promise<Response> {
  return request(method, path, accountId, body);
}

type Page = { solves: SolveRecord[]; next: string | null };

async function fetchPage(cursor: string | null): Promise<Page> {
  const query = new URLSearchParams({ limit: String(MAX_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const response = await api("GET", `/api/solves?${query}`);
  const page = solvePageSchema.safeParse(await responseJson(response, "The solve list"));
  if (!page.success) {
    console.error("The solve list has an unexpected shape", page.error.issues);
    throw new SaveFailure("bad response", response.status);
  }
  return { solves: page.data.solves.flatMap((entry) => parseSolve(entry, "stored") ?? []), next: page.data.next };
}

// ---------- local lists (outbox, rejected, legacy) ----------

function outboxKey(): string | null {
  return accountId ? OUTBOX_PREFIX + accountId : null;
}

type Pending = { solve: SolveRecord; raw: string };

function readOutbox(): Pending[] {
  const key = outboxKey();
  if (!key) return [];
  return (readList(key) ?? []).flatMap((entry) => {
    const solve = parseSolve(entry, "unsaved");
    return solve ? [{ solve, raw: JSON.stringify(entry) }] : [];
  });
}

/** The outbox's current version of one solve. */
function outboxEntry(id: string): Pending | null {
  return readOutbox().find((p) => p.solve.id === id) ?? null;
}

function keepPending(solve: SolveRecord): string | null {
  const key = outboxKey();
  if (!key) return "no account";
  return updateList(key, (entries) => [...entries.filter((e) => idOf(e) !== solve.id), solve]);
}

/** Drops the entry only if it is still the version that was sent, so a newer change made meanwhile stays. */
function dropPending(id: string, sentRaw: string): void {
  const key = outboxKey();
  if (key) updateList(key, (entries) => entries.filter((e) => idOf(e) !== id || JSON.stringify(e) !== sentRaw));
}

function takePending(id: string): unknown {
  const key = outboxKey();
  if (!key) return undefined;
  const entry = (readList(key) ?? []).find((e) => idOf(e) === id);
  if (entry !== undefined) updateList(key, (entries) => entries.filter((e) => idOf(e) !== id));
  return entry;
}

/** Moves outbox entries the server will never accept into the account's rejected list. */
function setAside(entries: unknown[]): void {
  const key = outboxKey();
  if (!key || !accountId || entries.length === 0) return;
  const raws = new Set(entries.map((e) => JSON.stringify(e)));
  const failure = updateList(REJECTED_PREFIX + accountId, (kept) => [...kept, ...entries]);
  // Only once they are safely in the rejected list may they leave the outbox.
  if (failure) return;
  updateList(key, (outbox) => outbox.filter((e) => !raws.has(JSON.stringify(e))));
}

/** Copies the pre-accounts solves into this account's outbox, the first time any account loads on this browser. */
function adoptLegacySolves(account: string): void {
  let legacyRaw: string | null;
  let adoptedBy: string | null;
  try {
    legacyRaw = localStorage.getItem(LEGACY_KEY);
    adoptedBy = localStorage.getItem(LEGACY_ADOPTED_KEY);
  } catch (error) {
    console.error("Could not check for solves saved before accounts", error);
    return;
  }
  if (legacyRaw === null) return;
  if (adoptedBy !== null) {
    console.warn(`${LEGACY_KEY} reappeared after its solves went to one account; leaving it alone`);
    return;
  }
  const legacy = readList(LEGACY_KEY);
  if (!legacy) return;
  const failure = updateList(OUTBOX_PREFIX + account, (outbox) => {
    const ids = new Set(outbox.map(idOf));
    return [...outbox, ...legacy.filter((e) => !ids.has(idOf(e)))];
  });
  if (failure) {
    console.error(`Could not move the solves saved before accounts (${failure}); will try again next time`);
    return;
  }
  try {
    localStorage.setItem(LEGACY_ADOPTED_KEY, account);
    localStorage.removeItem(LEGACY_KEY);
  } catch (error) {
    console.error("Could not mark the solves saved before accounts as moved", error);
  }
}

// ---------- sync ----------

function inOrder(id: string, task: () => Promise<void>): Promise<void> {
  const run = (chains.get(id) ?? Promise.resolve()).then(task);
  // The chain only orders requests; `run` still rejects to the caller, which reports the failure.
  const settled = run.catch(() => undefined);
  chains.set(id, settled);
  void settled.then(() => {
    if (chains.get(id) === settled) chains.delete(id);
  });
  return run;
}

let uploading: Promise<void> | null = null;

/** Sends every outbox entry that is not already on its way. */
function uploadPending(): Promise<void> {
  uploading ??= runUpload().finally(() => {
    uploading = null;
  });
  return uploading;
}

async function runUpload(): Promise<void> {
  const key = outboxKey();
  if (!key) return;
  const since = errorSeq;
  const unreadable: unknown[] = [];
  const ids: string[] = [];
  for (const entry of readList(key) ?? []) {
    const id = idOf(entry);
    if (id === undefined || !parseSolve(entry, "unsaved")) unreadable.push(entry);
    else if (!chains.has(id) && !deleting.has(id)) ids.push(id);
  }
  setAside(unreadable);
  let refused = unreadable.length;
  const failures: SaveFailure[] = [];
  const work = async () => {
    for (let id = ids.shift(); id !== undefined; id = ids.shift()) {
      const solveId = id;
      try {
        await inOrder(solveId, async () => {
          // Read now, not from the list above: the solve may have been edited or deleted while it waited.
          const current = outboxEntry(solveId);
          if (!current || deleting.has(solveId)) return;
          try {
            await api("POST", "/api/solves", JSON.stringify(current.solve));
          } catch (error) {
            if (!(error instanceof SaveFailure) || !isRefusal(error)) throw error;
            setAside([JSON.parse(current.raw)]);
            refused += 1;
            return;
          }
          dropPending(solveId, current.raw);
        });
      } catch (error) {
        if (!(error instanceof SaveFailure)) throw error;
        failures.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, work));
  const [failure] = failures;
  if (refused > 0) reportError(`not saved: ${refused} refused by the server (set aside on this device)`);
  else if (failure) reportError(`not saved: ${failure.reason} (kept on this device)`);
  else clearErrorsBefore(since);
}

async function load(): Promise<void> {
  loadState = "loading";
  accountId ??= currentAccount()?.id ?? null;
  if (!accountId) {
    loadState = "failed";
    console.error("No signed-in account to load solves for");
    return;
  }
  adoptLegacySolves(accountId);
  let page: Page;
  try {
    page = await fetchPage(null);
  } catch (error) {
    loadState = "failed";
    if (!(error instanceof SaveFailure)) throw error;
    // A 401 has already switched the app to the sign-in page (api() reported it).
    if (error.status === 401) return;
    publish({ solves: merge(state.solves, readOutbox().map((p) => p.solve)) });
    reportError(`not loaded: ${error.reason}`);
    return;
  }
  loadState = "loaded";
  nextCursor = page.next;
  publish({ solves: merge(page.solves, state.solves, readOutbox().map((p) => p.solve)), hasMore: page.next !== null });
  await uploadPending();
}

/** Keeps the solve in the outbox until `send` succeeds, then retries anything older still there. */
function confirm(solve: SolveRecord, send: () => Promise<unknown>): Promise<void> {
  const raw = JSON.stringify(solve);
  const keepError = keepPending(solve);
  return inOrder(solve.id, async () => {
    const since = errorSeq;
    try {
      await send();
    } catch (error) {
      if (!(error instanceof SaveFailure)) throw error;
      if (isRefusal(error)) {
        setAside([JSON.parse(raw)]);
        reportError(`not saved: ${error.reason} (set aside on this device)`);
        return;
      }
      reportError(`not saved: ${error.reason}${keepError ? "" : " (kept on this device)"}`);
      return;
    }
    dropPending(solve.id, raw);
    clearErrorsBefore(since);
    // The server is reachable again: fetch the list if the first try failed, and send whatever is still waiting.
    void (loadState === "failed" ? load() : uploadPending());
  });
}

/** Waits for requests in flight, then sends the outbox once more. Sign-out runs this first. */
async function flushPending(): Promise<void> {
  await Promise.all(chains.values());
  await uploadPending();
}

beforeSignOut(flushPending);

// ---------- public API ----------

export function addSolve(solve: SolveRecord): void {
  publish({ solves: merge(state.solves, [solve]) });
  void confirm(solve, () => api("POST", "/api/solves", JSON.stringify(solve)));
}

export function setPenalty(id: string, penalty: Penalty): void {
  if (id === TEST_SOLVE_ID) {
    if (testSolve) testSolve = { ...testSolve, penalty };
    notify();
    return;
  }
  const solve = state.solves.find((s) => s.id === id);
  if (!solve || solve.penalty === penalty) return;
  const updated: SolveRecord = { ...solve, penalty };
  publish({ solves: state.solves.map((s) => (s.id === id ? updated : s)) });
  void confirm(updated, async () => {
    try {
      return await api("PATCH", `/api/solves/${encodeURIComponent(id)}`, JSON.stringify({ penalty }));
    } catch (error) {
      // Not on the server yet (its first upload has not landed): send the whole solve instead.
      if (error instanceof SaveFailure && error.status === 404) return api("POST", "/api/solves", JSON.stringify(updated));
      throw error;
    }
  });
}

export function deleteSolve(id: string): void {
  const solve = state.solves.find((s) => s.id === id);
  deleting.add(id);
  publish({ solves: state.solves.filter((s) => s.id !== id) });
  const pendingEntry = takePending(id);
  void inOrder(id, async () => {
    const since = errorSeq;
    try {
      await api("DELETE", `/api/solves/${encodeURIComponent(id)}`);
    } catch (error) {
      deleting.delete(id);
      if (!(error instanceof SaveFailure)) throw error;
      const key = outboxKey();
      if (pendingEntry !== undefined && key) updateList(key, (entries) => [...entries, pendingEntry]);
      if (solve) publish({ solves: merge(state.solves, [solve]) });
      reportError(`not deleted: ${error.reason}`);
      return;
    }
    deleting.delete(id);
    clearErrorsBefore(since);
  });
}

let loadingMore: Promise<void> | null = null;

/** Fetches the next older page of solves into useSolves(); does nothing when everything is loaded. */
export function loadMoreSolves(): Promise<void> {
  if (loadingMore) return loadingMore;
  const cursor = nextCursor;
  if (loadState !== "loaded" || !cursor) return Promise.resolve();
  loadingMore = (async () => {
    try {
      const page = await fetchPage(cursor);
      nextCursor = page.next;
      publish({ solves: merge(page.solves, state.solves), hasMore: page.next !== null });
    } catch (error) {
      if (!(error instanceof SaveFailure)) throw error;
      if (error.status !== 401) reportError(`not loaded: ${error.reason}`);
    } finally {
      loadingMore = null;
    }
  })();
  return loadingMore;
}

// The first subscriber is the signed-in shell (App renders nothing else that reads solves), so the store never asks
// the server for solves while the sign-in page is showing.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (loadState === "idle") void load();
  return () => listeners.delete(listener);
}

/** Newest first: the most recent page from the server plus anything still waiting to be sent. */
export function useSolves(): SolveRecord[] {
  return useSyncExternalStore(subscribe, () => state.solves);
}

/** Whether older solves exist on the server beyond those in useSolves(); see loadMoreSolves(). */
export function useHasMoreSolves(): boolean {
  return useSyncExternalStore(subscribe, () => state.hasMore);
}

export function useSaveError(): string | null {
  return useSyncExternalStore(subscribe, () => state.saveError);
}

/** The last test solve: reviewable until the page reloads, never saved or counted. */
let testSolve: SolveRecord | null = null;
export const TEST_SOLVE_ID = "test";

export function setTestSolve(solve: SolveRecord): void {
  testSolve = { ...solve, id: TEST_SOLVE_ID };
  notify();
}

export function useTestSolve(): SolveRecord | null {
  return useSyncExternalStore(subscribe, () => testSolve);
}

/** Solves that aren't in the list (a lookahead drill's) but can be opened in the review, with where Back goes. */
const reviewOnly = new Map<string, { solve: SolveRecord; back: string }>();

export function addReviewSolve(solve: SolveRecord, back: string): void {
  reviewOnly.set(solve.id, { solve, back });
}

export function reviewOnlySolve(id: string): { solve: SolveRecord; back: string } | undefined {
  return reviewOnly.get(id);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
