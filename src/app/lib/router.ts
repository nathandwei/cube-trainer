import { useSyncExternalStore } from "react";

/**
 * `selected` is a solve picked from the sidebar, shown on the timer page in place of the latest one.
 * `set` is the learn item open in the main area (e.g. "COLL", "cross").
 */
export type Route =
  | { page: "timer"; selected?: string }
  | { page: "review"; id: string }
  | { page: "learn"; set?: string }
  | { page: "stats" }
  | { page: "settings" };

export type Tab = "timer" | "learn" | "stats";

function parse(location: string): Route {
  const url = new URL(location, "http://local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const review = /^\/solve\/([\w-]+)$/.exec(path);
  if (review?.[1]) return { page: "review", id: review[1] };
  const learn = /^\/learn(?:\/([\w-]+))?$/.exec(path);
  if (learn) return { page: "learn", set: learn[1] ? decodeURIComponent(learn[1]) : undefined };
  if (path === "/stats") return { page: "stats" };
  if (path === "/settings") return { page: "settings" };
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

export function navigate(path: string): void {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
