# UI language

Rules every screen follows. Nathan judges the site on looks; inconsistency reads as broken.

## Words

- **Sentence case everywhere** a word is shown: tabs (`Timer`, `Learn`, `Stats`), buttons (`Start`), labels
  (`Accuracy`), headings, verdicts (`Best`, `Inaccuracy`), switch options (`Off`, `On`), settings
  (`Hide time while solving`), tags (`New`, `Fewest`).
- **Smart cube only.** There is no keyboard or virtual mode; the cube status pill shows the connected cube (or
  "No cube"), and Test buttons (test solve, test rep) stand in for the cube when trying a screen without one.
- Kept as written, because that's the notation: moves (`R U R'`), case names (`Ua`, `T3`, `OLL 27`), set and
  stage acronyms (`PLL`, `COLL`, `EPLL`, `OLL`, `F2L`, `EO`, `LL`), averages (`ao5`, `ao12`, `ao100`), units
  (`s`, `bpm`, `tps`). Stage labels are `Cross`, `P1`–`P4`, `EO`, `COLL`, `EPLL` (or `OLL`/`PLL`).
- No sentences on screen. No explanatory copy, no AI copy. Labels and numbers only; the few hints that need a key
  use the `Key` chip (`<Key>Space</Key>`).

## Buttons

- **A text button has one word.** Anything that needs two or more words becomes an icon button (`IconButton` in
  `src/app/components/IconButton.tsx`, lucide-react icons) whose label is the tooltip and aria-label, e.g.
  `<IconButton icon={Lightbulb} label="Show best" />`.
- **One primary per screen** (`pill primary`, terracotta). Everything else is `pill` (oat fill) or an icon button
  (`ghost` by default, `soft` for a filled oat circle, `primary` for the main action when it's an icon).
- **Sizes come from the mockups** (in `--u`, see Scale): `pill` 52u tall (the input switch and the "Start" pill
  in round-8 02 / round-9 08), `pill small` 40u for inline row actions (round-9 02's "show best"), `pill large`
  64u for a full-page screen's single big action; `IconButton` sizes `sm` 36u, `md` 48u, `lg` 64u, `xl` 96u (the
  timer's round play / review buttons in round-7 03).
- **Spacing**: 12u between buttons in a group, 32u between groups; a group sits on the same baseline as the text
  beside it. No ad-hoc margins on individual buttons.
- Icons: lucide-react, `strokeWidth` 1.75, `currentColor`; their size follows the button (set in CSS).

## Common actions

| Action | Control |
| --- | --- |
| Start a session / drill | `pill primary` "Start" (or `IconButton icon={Play}` "Start") |
| Play an alg / line on the cube | `IconButton icon={Play}` "Play" |
| Replay | `IconButton icon={RotateCcw}` "Replay" |
| Show the best line | `IconButton icon={Lightbulb}` "Show best" |
| Step back / forward | `IconButton icon={ChevronLeft / ChevronRight}` "Previous move" / "Next move" |
| Previous / next stage | `IconButton icon={ChevronsLeft / ChevronsRight}` "Previous stage" / "Next stage" |
| Back / close | `IconButton icon={ArrowLeft}` "Back" / `icon={X}` "Close" |
| Review a solve | `IconButton icon={Search}` "Review" (timer: `size="xl"`, as in round-8 02) |
| Test solve | `IconButton icon={Play}` "Test solve" (timer: `size="xl"`) |
| Delete | `IconButton icon={Trash2}` "Delete" |
| Custom session | `IconButton icon={SlidersHorizontal}` "Custom session" |
| Add an item | `+` row in the sidebar ("Add" section label) |
| Choose (alg) | `pill` "Choose" |
| Again / slowest / done (summary) | `pill primary` "Again", `pill` "Slowest", `IconButton icon={X}` "Close" |
| Drill this (from review) | `IconButton icon={Dumbbell}` "Drill" |
| Settings | `IconButton icon={Settings}` "Settings" |

## Scale: match the mockups

The approved mockups are the target. They are drawn at 1536×864 for the whole window; `--u` (in `styles.css`
`:root`) is one mockup pixel scaled to the actual window. Measure a size on the mockup and write it as
`calc(N * var(--u))`: type sizes, control heights, paddings, gaps, sidebar width, cube size. Don't eyeball smaller
"web-ish" sizes; the mockups are big, bold and generous, and that's what was approved.

Approved references per screen (concepts/):

| Screen | Mockup |
| --- | --- |
| Sidebar + timer | round-8 02 (tabs Timer / Learn / Stats; the input switch is now the cube status pill), round-7 03 for the button row (Connect · Test solve · Review) |
| Solving | round-8 03 |
| Review | round-9 02 |
| Stats | round-8 07, 08 |
| Learn (a set) | round-9 08 (+ "Add" items in the sidebar) |
| Drill running | round-9 09 |
| Pick alg | round-8 13 |
| Drill done | round-8 12 |
| Cross trainer | round-9 10, round-8 14, 15 |
| Sign in | round-8 01 |
| Connect | round-8 16, 17 |
| Settings | round-8 18 |
