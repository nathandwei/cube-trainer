import { useSyncExternalStore } from "react";

export type Route = { page: "timer" } | { page: "review"; id: string };

function parse(path: string): Route {
  const review = /^\/solve\/([\w-]+)\/?$/.exec(path);
  if (review?.[1]) return { page: "review", id: review[1] };
  return { page: "timer" };
}

function subscribe(notify: () => void): () => void {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parse(path);
}

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
