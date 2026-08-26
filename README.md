# ALPV2-PROTOTYPE-v1-2Cc

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/Amrit-UX-DEV/ALPV2-PROTOTYPE-v1-2Cc)

## Building

```bash
npm ci
npm run build      # production, into dist/demo/browser
npm start          # dev server
```

`npm run build` is the only build command. Every host runs it, so none of them
holds its own idea of how this is built, and what a host produces is what you
get locally.

### Why production disables optimization

`ng build` with optimization on runs Angular's critical-CSS step (beasties),
which parses the whole stylesheet bundle through PostCSS. The bundle carries
around a dozen legacy IE gradient filters written as

```css
filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#80000000', ...);
```

An unquoted colon inside a declaration value is what PostCSS reports as
`Missed semicolon`, and the build dies there. The declarations are dead code:
they target IE 6 to 9. Until they are quoted or removed, the production
configuration keeps `optimization: false`, which is also why the CSS ships
unminified. Re-enabling it is worth doing, and needs a deploy to prove.

## Deploying

The app is a static SPA. A host needs three things:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist/demo/browser` |
| Node version | 22.16.0, pinned in `.node-version` |

Deep links need a rewrite to `index.html`. `src/_redirects` carries it and the
build copies it into the output, which is what Cloudflare Pages reads;
`netlify.toml` says the same thing for Netlify.

## Themes

Every theme ships in every build and costs nothing until it is switched on,
because each one is wrapped in `@scope (.alp-theme-<id>)`. One JSON file
decides which is worn:

```jsonc
// src/assets/data/themes/index.json
{
  "active": "aviva",     // "reassure", "aviva", or "" for none
  "themes": [ /* ... */ ]
}
```

Change `active`, reload. Nothing else moves, and no markup mentions a brand:
`ThemeService` reads the file during bootstrap, before the first paint, and
puts the active theme's class on `<body>`. An `active` of `""` turns theming
off, which leaves the ReAssure brand tokens that `src/index.css` sets at
`:root`. An id nothing matches does the same and says so in the console.

This is how a release cut gets its brand. Set `active` for the audience the
cut is for, commit, then branch.

Adding a theme is three steps:

1. Add `src/assets/styles/.../restructure/00-themes/00-theme-<id>.css`, with
   everything inside `@scope (.alp-theme-<id>) { :scope { /* tokens */ } }`.
2. Import it in `p-drive-collection/_index.css` under `/* Themes */`.
3. Add its entry to `index.json`.

A theme overrides the `--brand-*` and `--alpha-*` tokens that `src/index.css`
defines at `:root`. Anything it leaves out keeps the ReAssure default, so a
theme only has to state its differences.

## What a build shows

Two JSON files decide what a build offers, so cutting a release for a
particular audience is an edit to data rather than to code. `develop` shows
everything; a release branch turns off what its audience has no use for.

`src/assets/data/navigation/rail.json` holds one switch per rail button:

```json
{ "items": { "enquiry": { "show": false } } }
```

`src/assets/data/work-plans/index.json` holds the work plans and the hub:

```json
{
  "hub": { "alwaysShow": true },
  "plans": [{ "id": "dashboard-reference", "show": true, "requiresContext": "possible-match" }]
}
```

- `show: false` drops a button or a plan from the build entirely.
- `requiresContext` is the context a plan needs before it can be run. Leave it
  out for a plan that runs from anywhere, as script management does.
- `hub.alwaysShow: true` shows the hub as a screen and lifts `requiresContext`
  from every plan, so all of them can be opened and reviewed without searching
  for something first. Keep it to `develop`.
- `hub.alwaysShow: false` is what a release branch uses: each plan waits for the
  context it needs, and where only one can be run the hub is skipped and the
  rail's business processes button opens that plan directly.

A button set to `show: true` still only appears when it leads somewhere: the
group summary needs a context that has one, and business processes needs a
plan that can be run. That part is worked out from the current context and is
not configurable, because a button that opens an empty screen teaches a rep to
stop trusting the rail.

### Branches

- `develop` is the working trunk. Everything lands here. Never published.
- `main` takes occasional promotions from `develop`. Never published.
- `release/*` are frozen cuts, and the only branches a host builds.

A release branch is named `release/YYYY-MM-DD-short-label-audience`, dated for
the freeze in UK time, with a lowercase hyphenated label and the audience it
was cut for last:

```
release/2026-08-18-pension-dashboard-internal-review
```

The audience is one of `internal-review`, `stakeholder-review` or `demo`, so
the branch says who was given it as well as what and when.

Cut one per shareable piece of work and leave it alone afterwards. A later
change, however small, gets its own `release/...` rather than being pushed on
top of a cut somebody has already been given, so a link shared today shows the
same thing next week.
## Journey mapper (experimental)

On the `experimental-journey-mapper` branch only, and not merged into
`develop`. It puts a frame around the prototype so a flow can be reviewed as a
path rather than as a screen at a time.

The shell is the page. The prototype is inset in it at a measured scale, in the
same document rather than in an iframe, so nothing about how it is built or
bootstrapped changes. A bar at the bottom switches between **Prototype** and
**Journey map** and steps through the journey; the left and right arrow keys do
the same, except while the keystroke belongs to a field in the app.

### Frames are captured, not written

No markup is kept in this repo. When the shell starts it runs a capture pass:
for each step it photographs the part of the screen the step is about, then does
what the step says to do and waits for the app to answer, and photographs the
next one. A frame is therefore what the prototype draws today. Change a
template and the next capture shows the change; there is nothing to keep in
step by hand.

A loading state covers the shell while the pass runs, because the app is being
pressed and typed into by something other than the person watching. The pass
leaves the prototype at the end of the journey, so a finished run is written to
session storage and the page reloads: the app comes back at its beginning and
the frames are read from storage. **Capture again**, in the map, throws the run
away and takes it from a fresh start.

Frames are photographed before the step's action, not after: a frame is what
the rep was looking at when they decided to do the thing the step describes.
What they got for doing it is the next frame.

The pass also says when a step changed nothing on screen. That is a dead
control, and it is the difference between a journey that is out of date and a
prototype that is broken.

### Writing a journey

`src/assets/data/journeys/index.json` names the journeys a build holds and
which one opens:

```json
{ "default": "dashboard-reference",
  "journeys": [{ "id": "dashboard-reference", "name": "...", "file": "dashboard-reference.journey.json" }] }
```

Each journey file is a name, a summary and a list of steps:

| Field | What it is |
| --- | --- |
| `id` | Stable. Frames are held against it. |
| `title` | What the step is, in a few words. |
| `action` | What the rep does, in the imperative. |
| `result` | What the prototype does back. |
| `target` | CSS selector for the thing acted on. Rung in both views. |
| `do` | What moves the prototype on. Absent means a click on `target`; `[]` means the step is only read. |
| `capture` | Selector for the part of the screen to photograph. The whole app where it is left out. |
| `settleMs` | How long to let the app answer each action. 300 unless it is slower than that. |
| `notes` | Anything that is neither the action nor the result. |

An entry in `do` is `{ "type": "click" | "type" | "select" | "none", "target": "...", "value": "..." }`.
Both `type` and `target` have defaults: a click, on the step's own target.

Point a step at what it means rather than at where it sits. The work plan hub
lists whatever the index holds in the order it holds it, so
`.alp-launch-tile[data-plan='dashboard-reference']` is a plan and
`.alp-work-plans__item:first-child` is a position that will one day belong to
something else.

`target` is used twice from the one place. In the prototype view it rings the
element on the live screen; in a frame it rings the same selector inside the
photograph. A step cannot point at one thing in the map and another in the app.

### Why a frame looks like the app

A frame is markup the app produced, mounted in the same document, so the
stylesheets already on the page draw it. Three things make that work rather
than nearly work.

The chain comes with it. Nearly every rule in the legacy stack is a descendant
selector, so a subtree lifted out of its place is drawn by almost none of them:
the rail is dark because it sits inside `.alpha-explorer-toolbar`. Each ancestor
from the capture root down to the subject is cloned empty, classes and
attributes kept, and rebuilt around it. Those shells are flattened by
`journey-mapper.css` so they are matched by selectors and never seen.

Angular's scoping attributes are kept, so component stylesheets draw the frame
the same way they drew the screen.

The box comes with it. The subject is written out at the width and height it
had on screen and the frame is laid out at that size, then scaled down to fit.
A screen re-measured against the width of a panel is a picture of something
nobody saw.

Frames are `inert`, which takes them out of pointer events, out of the tab
order and out of the accessibility tree. Nothing runs behind them, and their
scripts are stripped on the way out.

Pick a `capture` root that is a whole layout unit rather than a fragment of
one: `.alpha-explorer-toolbar` rather than the search panel positioned against
it, `.alpha-wizard` rather than the step inside its card.

Adding a journey is a file and an index entry. Nothing in `src/app` changes.
