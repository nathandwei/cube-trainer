export type Params = Record<string, string>;

export type Route<H> = { method: string; pattern: string; handler: H };

export type Match<H> =
  | { kind: "found"; handler: H; params: Params }
  | { kind: "method-not-allowed"; allow: string[] }
  | { kind: "not-found" };

type Compiled<H> = Route<H> & { regex: RegExp; names: string[] };

/** "/api/solves/:id" matches "/api/solves/abc" with { id: "abc" }; a parameter never spans a "/". */
export function compilePattern(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  const source = pattern
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(segment.slice(1));
      return "([^/]+)";
    })
    .join("/");
  return { regex: new RegExp(`^${source}$`), names };
}

export function createRouter<H>(routes: Route<H>[]): (method: string, pathname: string) => Match<H> {
  const compiled: Compiled<H>[] = routes.map((route) => ({ ...route, ...compilePattern(route.pattern) }));
  return (method, pathname) => {
    const allow: string[] = [];
    for (const route of compiled) {
      const found = route.regex.exec(pathname);
      if (!found) continue;
      if (route.method !== method) {
        allow.push(route.method);
        continue;
      }
      const params = decodeParams(route.names, found.slice(1));
      if (!params) return { kind: "not-found" };
      return { kind: "found", handler: route.handler, params };
    }
    return allow.length > 0 ? { kind: "method-not-allowed", allow } : { kind: "not-found" };
  };
}

function decodeParams(names: string[], values: (string | undefined)[]): Params | null {
  const params: Params = {};
  for (const [index, name] of names.entries()) {
    const value = values[index];
    if (value === undefined) return null;
    try {
      params[name] = decodeURIComponent(value);
    } catch {
      // A malformed escape cannot name any stored record.
      return null;
    }
  }
  return params;
}
