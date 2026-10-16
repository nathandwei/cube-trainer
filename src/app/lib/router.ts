import { useSyncExternalStore } from "react";

/** `selected` is a solve picked from the sidebar, shown on the timer page in place of the latest one. */
export type Route = { page: "timer"; selected?: string } | { page: "review"; id: string };

function parse(location: string): Route {
  const url = new URL(location, "http://local");
  const review = /^\/solve\/([\w-]+)\/?$/.exec(url.pathname);
  if (review?.[1]) return { page: "review", id: review[1] };
  return { page: "timer", selected: url.searchParams.get("s") ?? undefined };
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
