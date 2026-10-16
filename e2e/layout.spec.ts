// Layout rules every screen keeps, checked on the built app at several window sizes:
// 1. The 3D cube, as drawn (the outline of its corners, not its canvas's empty margin), touches no text, button or
//    input outside the cube's own box.
// 2. No two separate pieces of text overlap.
// Each state below is a page as he'd reach it; the API is mocked with a few demo solves and learn settings.

import { expect, test, type Page } from "@playwright/test";
import { analyzeSolve, createRng, generateDemoSolve, randomScramble } from "../src/cube";
import type { SolveRecord } from "../src/cube/types";

const VIEWPORTS = [
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1180, height: 760 },
] as const;

const T_PERM = "(R U R' U') R' F R2 U' R' U' (R U R' F')";

function demoSolves(): SolveRecord[] {
  return [0, 1, 2].map((i) => {
    const scramble = randomScramble(createRng(70 + i));
    const { moves, rotations } = generateDemoSolve(scramble, i, "oll-pll");
    return {
      id: `layout-${i}`,
      scramble,
      moves,
      rotations,
      totalMs: moves.at(-1)!.t,
      penalty: "none",
      createdAt: Date.UTC(2026, 9, 10 + i),
      source: "smartcube",
      analysis: analyzeSolve(scramble, moves, { method: "oll-pll" }),
    };
  });
}

const SOLVES = demoSolves();
const SETTINGS = {
  version: 1,
  items: ["PLL", "COLL", "F2L", "cross", "lookahead"],
  algs: { "PLL-T": T_PERM, "F2L-1": "U R U' R'" },
  algChosenAt: {},
  lastLayer: "oll-pll",
};

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/me", (r) => r.fulfill({ json: { id: "u1", email: "nathan@example.com", name: "Nathan", picture: null } }));
  await page.route("**/api/solves**", (r) =>
    r.request().method() === "GET" ? r.fulfill({ json: { solves: SOLVES, next: null } }) : r.fulfill({ json: JSON.parse(r.request().postData() ?? "{}") }),
  );
  await page.route("**/api/learn/settings", (r) => r.fulfill({ json: { settings: SETTINGS, updatedAt: 1 } }));
  await page.route("**/api/learn/reps**", (r) => r.fulfill({ json: r.request().method() === "GET" ? { reps: [], next: null } : { ok: true } }));
}

/** Waits for every cube on show to have drawn (its canvas says where the cube is); a hidden one never draws. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => [...document.querySelectorAll<HTMLElement>(".cube")].every((cube) => cube.offsetWidth === 0 || cube.querySelector("canvas[data-cube-box]")),
    null,
    { timeout: 15_000 },
  );
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
}

type Violation = string;

/** Runs in the page: every broken rule, described. */
function findOverlaps(): Violation[] {
  type Rect = { left: number; top: number; right: number; bottom: number };
  type Ink = { rect: Rect; owner: Element; label: string; text: boolean };

  const visible = (el: Element | null): boolean => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const area = (a: Rect, b: Rect): number =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const name = (el: Element): string => {
    const label = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? "";
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""} "${label}"`;
  };

  const inks: Ink[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const owner = node.parentElement;
    if (!owner || !node.textContent?.trim() || !visible(owner)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    // A text run's box is its line's ascent and descent; the glyphs sit inside it (digits never reach the descent),
    // so it is trimmed to the band they can fill before comparing.
    const em = parseFloat(getComputedStyle(owner).fontSize) || 16;
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const glyphs = { left: r.left, right: r.right, top: r.top + 0.12 * em, bottom: Math.max(r.top + 0.12 * em, r.bottom - 0.22 * em) };
      inks.push({ rect: glyphs, owner, label: `"${node.textContent.trim().slice(0, 24)}"`, text: true });
    }
  }
  for (const el of document.querySelectorAll("button, input, select, a, [role=radio]")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) inks.push({ rect: r, owner: el, label: name(el), text: false });
  }

  const problems: Violation[] = [];

  // 1. The drawn cube: its corners' outline, tested against each box by separating axes.
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>("canvas[data-cube-points]")) {
    const host = canvas.closest(".cube") ?? canvas;
    const box = canvas.getBoundingClientRect();
    const points = (canvas.dataset.cubePoints ?? "").split(" ").map((p) => {
      const [x = 0, y = 0] = p.split(",").map(Number);
      return { x: box.left + x, y: box.top + y };
    });
    const hull = convexHull(points);
    for (const ink of inks) {
      if (host.contains(ink.owner) || ink.owner.contains(host)) continue;
      if (polygonHitsRect(hull, ink.rect, 2)) problems.push(`cube in ${name(host)} covers ${ink.label}`);
    }
  }

  // 2. Text on text, from elements that aren't one inside the other.
  const texts = inks.filter((ink) => ink.text);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      if (a.owner === b.owner || a.owner.contains(b.owner) || b.owner.contains(a.owner)) continue;
      if (area(a.rect, b.rect) > 4) problems.push(`${a.label} overlaps ${b.label}`);
    }
  }
  return [...new Set(problems)];

  function convexHull(ps: { x: number; y: number }[]): { x: number; y: number }[] {
    const sorted = [...ps].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list: { x: number; y: number }[]) => {
      const out: { x: number; y: number }[] = [];
      for (const p of list) {
        while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
        out.push(p);
      }
      out.pop();
      return out;
    };
    return [...half(sorted), ...half([...sorted].reverse())];
  }

  // Separating axis test between a convex polygon and a rectangle shrunk by `slack` px on every side.
  function polygonHitsRect(poly: { x: number; y: number }[], r: Rect, slack: number): boolean {
    const rect = [
      { x: r.left + slack, y: r.top + slack },
      { x: r.right - slack, y: r.top + slack },
      { x: r.right - slack, y: r.bottom - slack },
      { x: r.left + slack, y: r.bottom - slack },
    ];
    if (rect[1]!.x <= rect[0]!.x || rect[2]!.y <= rect[1]!.y) return false;
    const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, ...poly.map((p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      return { x: -(q.y - p.y), y: q.x - p.x };
    })];
    return axes.every((axis) => {
      const project = (ps: { x: number; y: number }[]) => ps.map((p) => p.x * axis.x + p.y * axis.y);
      const a = project(poly);
      const b = project(rect);
      return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
    });
  }
}

async function expectClean(page: Page, where: string): Promise<void> {
  await settle(page);
  const problems = await page.evaluate(findOverlaps);
  expect(problems, `${where}:\n${problems.join("\n")}`).toEqual([]);
}

type State = { name: string; open: (page: Page) => Promise<void> };

const STATES: State[] = [
  { name: "timer", open: (page) => page.goto("/").then(() => undefined) },
  { name: "review report", open: (page) => page.goto(`/solve/${SOLVES[0]!.id}`).then(() => undefined) },
  {
    name: "learn set",
    open: (page) => page.goto("/learn/PLL").then(() => undefined),
  },
  { name: "case picker", open: (page) => page.goto("/learn/PLL?case=PLL-Aa").then(() => undefined) },
  {
    name: "case picker, typing an alg",
    open: async (page) => {
      await page.goto("/learn/PLL?case=PLL-Aa");
      await page.getByRole("button", { name: "Type mine" }).click();
      await page.keyboard.type("R U R' F' r U R' U' r' F R2 U' R'");
    },
  },
  { name: "case detail", open: (page) => page.goto("/learn/PLL?case=PLL-T").then(() => undefined) },
  {
    name: "learning an alg",
    open: async (page) => {
      await page.goto("/learn/PLL?case=PLL-T");
      await page.getByRole("button", { name: "Learn" }).click();
    },
  },
  {
    name: "drill",
    open: async (page) => {
      await page.goto("/learn/PLL?case=PLL-T");
      await page.getByRole("button", { name: "Drill" }).click();
    },
  },
  {
    name: "recording an alg",
    open: async (page) => {
      await page.goto("/learn/F2L?case=F2L-2");
      await page.getByRole("button", { name: "Record mine" }).click();
    },
  },
  { name: "cross trainer", open: (page) => page.goto("/learn/cross").then(() => undefined) },
  { name: "lookahead", open: (page) => page.goto("/learn/lookahead").then(() => undefined) },
  { name: "stats", open: (page) => page.goto("/stats").then(() => undefined) },
  ...["cube", "timer", "method", "learn", "appearance", "account"].map((section) => ({
    name: `settings ${section}`,
    open: (page: Page) => page.goto(`/settings/${section}`).then(() => undefined),
  })),
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    for (const state of STATES) {
      test(state.name, async ({ page }) => {
        await mockApi(page);
        await state.open(page);
        await expectClean(page, state.name);
      });
    }

    test("review stepper, every stage", async ({ page }) => {
      await mockApi(page);
      await page.goto(`/solve/${SOLVES[0]!.id}`);
      await page.getByRole("button", { name: "Steps" }).click();
      const stages = await page.locator(".rv-tabs button").count();
      for (let i = 0; i < stages; i++) {
        await page.locator(".rv-tabs button").nth(i).click();
        await expectClean(page, `review stage ${i + 1}`);
      }
    });
  });
}
