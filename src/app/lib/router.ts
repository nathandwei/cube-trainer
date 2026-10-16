import { useSyncExternalStore } from "react";

/**
 * `selected` is a solve picked from the sidebar, shown on the timer page in place of the latest one.
 * `set` is the learn item open in the main area (e.g. "COLL", "cross"); `caseId` a case page open in it (?case=).
 * `section` is the settings section on show (/settings/timer); the first one when absent.
 */
export type Route =
  | { page: "timer"; selected?: string }
  | { page: "review"; id: string }
  | { page: "learn"; set?: string; caseId?: string }
  | { page: "stats" }
  | { page: "settings"; section?: string };

export type Tab = "timer" | "learn" | "stats";

function parse(location: string): Route {
  const url = new URL(location, "http://local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const review = /^\/solve\/([\w-]+)$/.exec(path);
  if (review?.[1]) return { page: "review", id: review[1] };
  const learn = /^\/learn(?:\/([\w-]+))?$/.exec(path);
  if (learn) return { page: "learn", set: learn[1] ? decodeURIComponent(learn[1]) : undefined, caseId: url.searchParams.get("case") ?? undefined };
  if (path === "/stats") return { page: "stats" };
  const settings = /^\/settings(?:\/([\w-]+))?$/.exec(path);
  if (settings) return { page: "settings", section: settings[1] };
  return { page: "timer", selected: url.searchParams.get("s") ?? undefined };
}

/** The sidebar tab a route belongs to (review lives under the timer, settings under none). */
export function tabOf(route: Route): Tab | null {
  if (route.page === "timer" || route.page === "review") return "timer";
  if (route.page === "settings") return null;
  return route.page;
}

function subscribe(notify: () => void): () => void {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

export function useRoute(): Route {
  const location = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search);
  return parse(location);
}

/** `replace`: swap the current history entry (an in-app Back), so the browser's Back doesn't reopen what was closed. */
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (window.location.pathname + window.location.search === path) return;
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
