import { useSyncExternalStore } from "react";
import { beforeSignOut, currentAccount } from "@/app/lib/account";
import { idOf, isRefusal, readList, readValue, request, responseJson, SaveFailure, updateList, writeValue } from "@/app/lib/sync";
import {
  DEFAULT_LEARN_SETTINGS,
  type LearnSettings,
  learnSettingsSchema,
  MAX_REP_PAGE_SIZE,
  MAX_REPS_PER_POST,
  type Rep,
  repPageSchema,
  repSchema,
  type SettingsDoc,
  settingsDocSchema,
} from "@/shared/learn";

// Like the solve store: the server holds each account's learn data, and anything it has not confirmed waits in
// localStorage under that account, so a reload, a dropped connection or a sign-out never loses a rep or a settings
// change, and it is only ever sent with that account's id attached.
/** Reps the server has not confirmed. */
const REP_OUTBOX_PREFIX = "cube.learn.pending.";
/** Reps the server refused outright (invalid or too large): kept, never retried. */
const REP_REJECTED_PREFIX = "cube.learn.rejected.";
/** The latest settings change the server has not confirmed, as { settings, updatedAt }. */
const SETTINGS_OUTBOX_PREFIX = "cube.learn.settings.";
const SETTINGS_REJECTED_PREFIX = "cube.learn.settings-rejected.";

export type LearnStatus = {
  /** Settings and the newest page of reps have loaded, or failed to (see saveError) with local data shown. */
  loaded: boolean;
  /** Every rep the server holds is in useReps(); see loadAllReps(). */
  allRepsLoaded: boolean;
  saveError: string | null;
};

type State = { settings: LearnSettings; updatedAt: number; reps: Rep[]; status: LearnStatus };

const listeners = new Set<() => void>();
let state: State = {
  settings: DEFAULT_LEARN_SETTINGS,
  updatedAt: 0,
  reps: [],
  status: { loaded: false, allRepsLoaded: false, saveError: null },
};
/** The account this page's learn data belongs to, fixed when it is first loaded. */
let accountId: string | null = null;
let loadState: "idle" | "loading" | "loaded" | "failed" = "idle";
let loadPromise: Promise<void> = Promise.resolve();
/** Where the next older page of reps starts, or null when everything is loaded. */
let nextCursor: string | null = null;
/** Reps that could not be written to the outbox (storage full): kept here until the server has them. */
const memoryOnly = new Map<string, Rep>();
/** Ids deleted here whose DELETE has not finished, so a page fetched meanwhile cannot bring them back. */
const deleting = new Set<string>();

function publish(next: Partial<State>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function publishStatus(next: Partial<LearnStatus>): void {
  publish({ status: { ...state.status, ...next } });
}

// An error stays until something newer replaces it: a success clears only an error older than its own request.
let errorSeq = 0;

function reportError(message: string): void {
  errorSeq += 1;
  publishStatus({ saveError: message });
}

function clearErrorsBefore(seq: number): void {
  if (errorSeq === seq && state.status.saveError !== null) publishStatus({ saveError: null });
}

/** Oldest first (by createdAt, then id), each id once, none being deleted. */
function mergeReps(...lists: Rep[][]): Rep[] {
  const byId = new Map<string, Rep>();
  for (const list of lists) for (const rep of list) if (!byId.has(rep.id) && !deleting.has(rep.id)) byId.set(rep.id, rep);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function parseRep(entry: unknown, where: string): Rep | null {
  const result = repSchema.safeParse(entry);
  if (result.success) return result.data;
  console.warn(`A ${where} rep does not match the schema`, result.error.issues);
  return null;
}

// ---------- server ----------

function api(method: string, path: string, body?: string): Promise<Response> {
  return request(method, path, accountId, body);
}

async function fetchSettings(): Promise<SettingsDoc> {
  const response = await api("GET", "/api/learn/settings");
  return parseSettingsDoc(await responseJson(response, "The learn settings"), response.status);
}

async function putSettings(doc: SettingsDoc): Promise<SettingsDoc> {
  const response = await api("PUT", "/api/learn/settings", JSON.stringify(doc));
  return parseSettingsDoc(await responseJson(response, "The saved learn settings"), response.status);
}

function parseSettingsDoc(body: unknown, status: number): SettingsDoc {
  const doc = settingsDocSchema.safeParse(body);
  if (doc.success) return doc.data;
  console.error("The learn settings have an unexpected shape", doc.error.issues);
  throw new SaveFailure("bad response", status);
}

type RepPage = { reps: Rep[]; next: string | null };

async function fetchRepPage(cursor: string | null): Promise<RepPage> {
  const query = new URLSearchParams({ limit: String(MAX_REP_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const response = await api("GET", `/api/learn/reps?${query}`);
  const page = repPageSchema.safeParse(await responseJson(response, "The rep list"));
  if (!page.success) {
    console.error("The rep list has an unexpected shape", page.error.issues);
    throw new SaveFailure("bad response", response.status);
  }
  return { reps: page.data.reps.flatMap((entry) => parseRep(entry, "stored") ?? []), next: page.data.next };
}

// ---------- local outboxes ----------

function key(prefix: string): string | null {
  return accountId ? prefix + accountId : null;
}

function readSettingsOutbox(): SettingsDoc | null {
  const slot = key(SETTINGS_OUTBOX_PREFIX);
  if (!slot) return null;
  const value = readValue(slot);
  if (value === undefined || value === null) return null;
  const doc = settingsDocSchema.safeParse(value);
  if (doc.success) return doc.data;
  console.error("Unsaved learn settings do not match the schema; leaving them in place", doc.error.issues);
  return null;
}

/** Clears the slot only if it still holds the version that was sent, so a newer change made meanwhile stays. */
function dropSettingsOutbox(sentUpdatedAt: number): void {
  const slot = key(SETTINGS_OUTBOX_PREFIX);
  if (slot && readSettingsOutbox()?.updatedAt === sentUpdatedAt) writeValue(slot, undefined);
}

function readRepOutbox(): { reps: Rep[]; unreadable: unknown[] } {
  const outbox = key(REP_OUTBOX_PREFIX);
  const reps: Rep[] = [];
  const unreadable: unknown[] = [];
  for (const entry of outbox ? (readList(outbox) ?? []) : []) {
    const rep = parseRep(entry, "unsaved");
    if (rep) reps.push(rep);
    else unreadable.push(entry);
  }
  return { reps, unreadable };
}

/** Takes these entries out of the outbox (and memory), once the server has them or they are set aside. */
function removeFromOutbox(ids: Set<string>): void {
  for (const id of ids) memoryOnly.delete(id);
  const outbox = key(REP_OUTBOX_PREFIX);
  if (outbox) updateList(outbox, (entries) => entries.filter((e) => !ids.has(idOf(e) ?? "")));
}

/** Moves entries the server will never accept into the account's rejected list. */
function setAsideReps(entries: unknown[]): void {
  const rejected = key(REP_REJECTED_PREFIX);
  if (!rejected || entries.length === 0) return;
  // Only once they are safely in the rejected list may they leave the outbox.
  if (updateList(rejected, (kept) => [...kept, ...entries])) return;
  const raws = new Set(entries.map((e) => JSON.stringify(e)));
  for (const entry of entries) {
    const id = idOf(entry);
    if (id !== undefined) memoryOnly.delete(id);
  }
  const outbox = key(REP_OUTBOX_PREFIX);
  if (outbox) updateList(outbox, (kept) => kept.filter((e) => !raws.has(JSON.stringify(e))));
}

// ---------- settings sync ----------

let settingsChain: Promise<void> = Promise.resolve();

/** Pushes run one at a time and each sends whatever the outbox holds then, so quick changes coalesce. */
function queueSettingsPush(): Promise<void> {
  const run = settingsChain.then(pushSettings);
  // The chain only orders pushes; `run` still rejects to the caller.
  settingsChain = run.catch(() => undefined);
  return run;
}

async function pushSettings(): Promise<void> {
  const pending = readSettingsOutbox();
  if (!pending) return;
  const since = errorSeq;
  let stored: SettingsDoc;
  try {
    stored = await putSettings(pending);
  } catch (error) {
    if (!(error instanceof SaveFailure)) throw error;
    if (isRefusal(error)) {
      const slot = key(SETTINGS_OUTBOX_PREFIX);
      const rejected = key(SETTINGS_REJECTED_PREFIX);
      if (slot && rejected && !writeValue(rejected, pending)) dropSettingsOutbox(pending.updatedAt);
      reportError(`not saved: learn settings ${error.reason} (set aside on this device)`);
      return;
    }
    reportError(`not saved: ${error.reason} (kept on this device)`);
    return;
  }
  dropSettingsOutbox(pending.updatedAt);
  // The server answers with what it holds: ours, or a newer change from another device, which wins.
  if (stored.updatedAt >= state.updatedAt) publish({ settings: stored.settings, updatedAt: stored.updatedAt });
  clearErrorsBefore(since);
  if (loadState === "failed") void ensureLoad(true);
}

// ---------- rep sync ----------

let flushing: Promise<void> | null = null;
let flushAgain = false;

/** One flush at a time; a request for another while one runs makes it go round again. */
function flushReps(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  const run = async () => {
    try {
      do {
        flushAgain = false;
        await runFlush();
      } while (flushAgain);
    } finally {
      flushing = null;
    }
  };
  flushing = run();
  return flushing;
}

type SendResult = { failure: SaveFailure | null; refused: number };

async function sendBatch(batch: Rep[], done: Set<string>): Promise<SendResult> {
  try {
    await api("POST", "/api/learn/reps", JSON.stringify({ reps: batch }));
  } catch (error) {
    if (!(error instanceof SaveFailure)) throw error;
    if (!isRefusal(error)) return { failure: error, refused: 0 };
    if (batch.length === 1) {
      batch.forEach((rep) => done.add(rep.id));
      setAsideReps(batch);
      return { failure: null, refused: 1 };
    }
    // One bad rep spoils the whole batch: send them one at a time to find it.
    let refused = 0;
    for (const rep of batch) {
      const single = await sendBatch([rep], done);
      refused += single.refused;
      if (single.failure) return { failure: single.failure, refused };
    }
    return { failure: null, refused };
  }
  const ids = new Set(batch.map((rep) => rep.id));
  ids.forEach((id) => done.add(id));
  removeFromOutbox(ids);
  return { failure: null, refused: 0 };
}

async function runFlush(): Promise<void> {
  if (!key(REP_OUTBOX_PREFIX)) return;
  const since = errorSeq;
  // Ids handled in this run, so a rep the outbox failed to forget is not sent again and again.
  const done = new Set<string>();
  let refused = 0;
  for (;;) {
    const outbox = readRepOutbox();
    if (outbox.unreadable.length > 0) {
      setAsideReps(outbox.unreadable);
      refused += outbox.unreadable.length;
    }
    const queue = mergeReps(outbox.reps, [...memoryOnly.values()]).filter((rep) => !done.has(rep.id));
    if (queue.length === 0) break;
    const result = await sendBatch(queue.slice(0, MAX_REPS_PER_POST), done);
    refused += result.refused;
    if (result.failure) {
      reportError(`not saved: ${result.failure.reason} (kept on this device)`);
      return;
    }
  }
  if (refused > 0) reportError(`not saved: ${refused} reps refused by the server (set aside on this device)`);
  else clearErrorsBefore(since);
  if (loadState === "failed" && done.size > 0) void ensureLoad(true);
}

// ---------- loading ----------

function adoptRemoteSettings(remote: SettingsDoc): void {
  const pending = readSettingsOutbox();
  if (pending && pending.updatedAt > remote.updatedAt) {
    // A change made here is newer than the server's copy and has not reached it: keep it and send it.
    void queueSettingsPush();
    return;
  }
  // The server already has this change, or a newer one from another device.
  if (pending) dropSettingsOutbox(pending.updatedAt);
  if (remote.updatedAt >= state.updatedAt) publish({ settings: remote.settings, updatedAt: remote.updatedAt });
}

async function load(): Promise<void> {
  loadState = "loading";
  accountId ??= currentAccount()?.id ?? null;
  if (!accountId) {
    loadState = "failed";
    console.error("No signed-in account to load learn data for");
    return;
  }
  const pending = readSettingsOutbox();
  if (pending && pending.updatedAt > state.updatedAt) publish({ settings: pending.settings, updatedAt: pending.updatedAt });
  publish({ reps: mergeReps(state.reps, readRepOutbox().reps, [...memoryOnly.values()]) });
  let remote: SettingsDoc;
  let page: RepPage;
  try {
    [remote, page] = await Promise.all([fetchSettings(), fetchRepPage(null)]);
  } catch (error) {
    loadState = "failed";
    if (!(error instanceof SaveFailure)) throw error;
    publishStatus({ loaded: true });
    // A 401 has already switched the app to the sign-in page (request() reported it).
    if (error.status !== 401) reportError(`not loaded: ${error.reason}`);
    return;
  }
  loadState = "loaded";
  nextCursor = page.next;
  adoptRemoteSettings(remote);
  publish({ reps: mergeReps(state.reps, page.reps), status: { ...state.status, loaded: true, allRepsLoaded: page.next === null } });
  void flushReps();
}

/** Starts the first load; `retry` loads again after a failed one. */
function ensureLoad(retry = false): Promise<void> {
  if (loadState === "idle" || (retry && loadState === "failed")) loadPromise = load();
  return loadPromise;
}

/** Waits for requests in flight, then sends both outboxes once more. Sign-out runs this first. */
async function flushAll(): Promise<void> {
  await queueSettingsPush();
  await flushReps();
}

beforeSignOut(flushAll);

// ---------- public API ----------

/**
 * Changes the learn settings: a partial object is merged over the current settings (top level only), or a function
 * returns the whole new settings. Throws if the result does not match the schema. Saved last-writer-wins by time.
 */
export function updateLearnSettings(change: Partial<LearnSettings> | ((current: LearnSettings) => LearnSettings)): void {
  void ensureLoad();
  const next = typeof change === "function" ? change(state.settings) : { ...state.settings, ...change };
  const parsed = learnSettingsSchema.safeParse(next);
  if (!parsed.success) throw new Error(`Invalid learn settings: ${parsed.error.message}`);
  // Never older than the last version seen, so a device whose clock runs behind still wins with a new change.
  const doc: SettingsDoc = { settings: parsed.data, updatedAt: Math.max(Date.now(), state.updatedAt + 1) };
  const slot = key(SETTINGS_OUTBOX_PREFIX);
  const keepError = slot ? writeValue(slot, doc) : "no account";
  publish({ settings: doc.settings, updatedAt: doc.updatedAt });
  if (keepError) reportError(`not kept on this device: ${keepError}`);
  void queueSettingsPush();
}

/** Logs drill reps (ids from newRepId()). Throws if any does not match the schema. Never loses one: see the outbox. */
export function addReps(reps: readonly Rep[]): void {
  if (reps.length === 0) return;
  const parsed = reps.map((rep) => {
    const result = repSchema.safeParse(rep);
    if (!result.success) throw new Error(`Invalid rep ${String(rep.id)}: ${result.error.message}`);
    return result.data;
  });
  void ensureLoad();
  const outbox = key(REP_OUTBOX_PREFIX);
  const keepError = outbox ? updateList(outbox, (entries) => [...entries, ...parsed]) : "no account";
  if (keepError) for (const rep of parsed) memoryOnly.set(rep.id, rep);
  publish({ reps: mergeReps(state.reps, parsed) });
  void flushReps();
}

/** Deletes a rep: gone here at once, then from the server; back, with an error, if the server can't be told. */
export function deleteRep(id: string): void {
  const rep = state.reps.find((r) => r.id === id);
  if (!rep) return;
  const pending = memoryOnly.has(id) || readRepOutbox().reps.some((r) => r.id === id);
  deleting.add(id);
  removeFromOutbox(new Set([id]));
  publish({ reps: state.reps.filter((r) => r.id !== id) });
  void (async () => {
    const since = errorSeq;
    // A send under way may still store it, so the DELETE goes after; that send reports its own failures.
    await flushing?.catch(() => undefined);
    try {
      await api("DELETE", `/api/learn/reps/${encodeURIComponent(id)}`);
    } catch (error) {
      deleting.delete(id);
      if (!(error instanceof SaveFailure)) throw error;
      const outbox = key(REP_OUTBOX_PREFIX);
      if (pending && (!outbox || updateList(outbox, (entries) => [...entries, rep]))) memoryOnly.set(id, rep);
      publish({ reps: mergeReps(state.reps, [rep]) });
      reportError(`not deleted: ${error.reason}`);
      return;
    }
    deleting.delete(id);
    clearErrorsBefore(since);
  })();
}

let allLoading: Promise<void> | null = null;

/** Pages through every rep on the server into useReps(). Resolves when done or on failure (see useLearnStatus). */
export function loadAllReps(): Promise<void> {
  allLoading ??= (async () => {
    try {
      await ensureLoad();
      while (loadState === "loaded" && nextCursor) {
        const page = await fetchRepPage(nextCursor);
        nextCursor = page.next;
        publish({ reps: mergeReps(state.reps, page.reps), status: { ...state.status, allRepsLoaded: page.next === null } });
      }
    } catch (error) {
      if (!(error instanceof SaveFailure)) throw error;
      if (error.status !== 401) reportError(`not loaded: ${error.reason}`);
    } finally {
      allLoading = null;
    }
  })();
  return allLoading;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A ULID: 10 characters of millisecond time then 16 random ones, so ids sort by creation time. */
export function newRepId(): string {
  let time = "";
  let ms = Date.now();
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD.charAt(ms % 32) + time;
    ms = Math.floor(ms / 32);
  }
  let random = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(16))) random += CROCKFORD.charAt(byte % 32);
  return time + random;
}

// Nothing is fetched until something needs it: the learn tab, a review or the method setting (both name the last
// layer his way), or the end of a smart-cube solve.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void ensureLoad();
  return () => listeners.delete(listener);
}

/** The learn settings as they are now, for code outside React; the defaults until they load. */
export function currentLearnSettings(): LearnSettings {
  void ensureLoad();
  return state.settings;
}

/** The learn settings; the defaults until they load. */
export function useLearnSettings(): LearnSettings {
  return useSyncExternalStore(subscribe, () => state.settings);
}

/** Every loaded rep, oldest first (by createdAt, then id): the newest page plus unsent ones, all after loadAllReps(). */
export function useReps(): Rep[] {
  return useSyncExternalStore(subscribe, () => state.reps);
}

export function useLearnStatus(): LearnStatus {
  return useSyncExternalStore(subscribe, () => state.status);
}
