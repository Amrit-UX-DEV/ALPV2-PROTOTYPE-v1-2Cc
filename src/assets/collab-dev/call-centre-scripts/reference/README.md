# Call Centre Scripting Architecture & Engine Build Spec

Scalable model for storing and running call-centre scripts. A script is a **single unit of work** made of prompts, questions, automated/manual checks and actions, presented as a sequence of **steps (screens)** where **buttons** at the end of each step route the agent down different flows.

This document is written so the **Angular runtime engine can be built directly from it**: it defines the bundle the engine consumes, every step/content/button shape, the exact resolution rules, the prefetch mechanism, and the service structure. Sections 1–4 are orientation; **sections 5–15 are the buildable spec**; 16–19 are background & mapping.

> **Architecture note (step model).** Scripts are authored and run as **steps**, not a node/edge graph. A step renders ordered **content units**, may run **`onEnter`** logic (checks/waypoints) before it shows, and ends with **`buttons`** that own all navigation via **`routes`**. The retired node/edge concepts map cleanly onto this (see §6.1). The complete worked bundle is `call-centre-surrender-response/surrender-001.steps.bundle.example.json`.

---

## 1. Files

| File                                                                     | Purpose                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Library/library.json`                                                   | Reusable content units (prompts, questions, checks, actions, end-calls). Authored once, referenced by many scripts.                                                                                                                                                                                 |
| `Library/surrender-001.json`                                             | The Surrender script authored in the **step model** (all steps of the main script).                                                                                                                                                                                                                 |
| `call-centre-surrender-response/surrender-001.steps.bundle.example.json` | The **frozen step-model bundle** the engine loads — main `steps` + `{ ref, version }` links to callable flows + only the main steps' units inlined, one document per top-level `(classifier_1, classifier_2)`.                                                                                      |
| `call-centre-surrender-response/Flows/<flowId>.v<version>.json`          | **One file per callable script** — each is the exact response ORDS returns for `GET /scripts/flow/{id}?version=N`: a self-contained `CallableFlow` (its own `units`). One file per REST call demonstrates that each flow is fetched by its own path/version, in the session-start parallel fan-out. |
| `call-centre-surrender-response/surrender-001.checks.example.json`       | Example **prefetch results map** returned per session (NOT part of the bundle).                                                                                                                                                                                                                     |
| `ords-schema.sql`                                                        | Normalised ORDS storage (STEP tables), publish/assembly packages, prefetch package, and the ORDS endpoints. Targets Oracle 19c.                                                                                                                                                                     |
| `seed-data.sql`                                                          | Comprehensive example rows for **every** table, generated from the authoring + served JSON so it tallies exactly with the Surrender script and its 7 flows (lookup rows, scripts, steps, content, buttons, one session + prefetched checks). Load after `ords-schema.sql`.                          |
| `scripting-seed-data.xlsx`                                               | The same seed data as a workbook (one sheet per table + an Overview), generated from `seed-data.sql` — a readable view of the model for review.                                                                                                                                                     |

## 2. Three-layer design

1. **Library (content):** each prompt/question/check/action is a versioned, immutable unit with a stable id (`prm.*`, `qst.*`, `chk.*`, `act.*`, `end.*`). Content carries no routing. Callable flows are plain script slugs (no role prefix), marked by `is_callable='Y'` and grouped via `category`.
2. **Composition (flow):** a script is an ordered set of **steps**; a step references units by id in its `content` and owns all routing on its **`buttons`** (`routes`). The same unit can be reused in any step of any script with different routing — this is what makes reuse real.
3. **Runtime (session):** as the engine walks the steps it records answers, check results (pass/amber/fail) and actions fired, for audit.

The single most important rule: **routing lives on the step's `buttons`, never inside a unit.**

## 3. Identity & versioning (how ids work)

- Every unit/callable script/script has a human-authored **slug** id (`chk.suspended-fund`). Slugs are the reference/lookup key everywhere; there are no GUIDs (except opaque `session_id`). Slug uniqueness is enforced at creation (`next_slug` in the schema).
- Content is **versioned and immutable**. At **authoring** time a step content item references a library unit by slug and may **pin** a version via `refVersion` (omitted = latest published). That pin is resolved at **publish**: the chosen unit is inlined into the frozen bundle/flow under its plain slug, so the **served** JSON carries only `ref` and resolves it within the same document — `refVersion` is not emitted. (`refVersion` lives in the authoring source, e.g. `Library/surrender-001.json`, where many library versions exist.)
- One **primary** script version is served per `(classifier_1, classifier_2)` among **top-level** scripts (see `is_primary` / `is_top_level`).

## 4. Storage → serving (normalise on write, denormalise on read)

Authoring/storage is normalised (see `ords-schema.sql`). On publish, one **bundle** per top-level `(classifier_1, classifier_2)` is assembled and frozen (`published_json`). The engine fetches that bundle as-is; it never stitches data client-side.

---

# ENGINE BUILD SPEC

## 5. The bundle (what the engine loads)

`GET /scripts/lookup?classifier_1=…&classifier_2=…` returns one document. The two
classifier keys are domain-neutral; the management UI labels them per
`script_key_dimension` (e.g. `classifier_1` → "Product", `classifier_2` → "Request Type"):

```ts
interface ScriptBundle {
  classifier1?: string; // absent when the script carries no classifiers
  classifier2?: string;
  scriptId: string;
  version: number;
  isPrimary: boolean;
  title: string;
  libraryVersion: string;
  startStepId: string; // where traversal begins
  steps: Step[]; // the main script, as an ordered set of steps
  flows: Record<string, FlowLink>; // LINKS to every callable flow this script can reach, keyed by script id (§11)
  units: Record<string, Unit>; // keyed by ref (see 5.1) — ONLY the units the MAIN steps use (flows carry their own)
}

// The bundle does NOT inline callable flows — it links them, to stay small.
// At session start the engine fetches every linked flow via GET /scripts/flow/
// {ref}?version=N — all in parallel with the bundle and the checks prefetch —
// and caches them for the session (§11 / §13).
interface FlowLink {
  ref: string; // script id of the callable flow
  version: number; // frozen flow version, pinned at publish
}

// A callable flow is a self-contained step sequence invoked by a callFlow step.
// It is just a script: a call-only flow (is_callable='Y', not served top-level) or another top-level
// script called as a flow. This is the shape returned by GET /scripts/flow/{id}.
// Each flow is fetched by its own REST call (all flows in parallel at session
// start), so it carries its OWN `units` — everything its steps render — and
// resolves them without the main bundle. A unit used by several scopes is
// duplicated into each.
interface CallableFlow {
  startStepId: string;
  terminal: boolean; // true => ends the call itself, exposes no continuation exits
  params: Param[];
  exits: string[]; // named return points (empty when terminal)
  steps: Step[]; // may contain further callFlow steps -> more FlowLinks in bundle.flows
  units: Record<string, Unit>; // the units THIS flow's steps reference (self-contained)
}
```

### 5.1 Unit lookup key (version pinning)

In the **served** bundle/flow, `units` is keyed by the plain unit slug — each ref resolves to the one frozen version baked in at publish (the `refVersion` pin, if any, was resolved then). **Resolution rule** for any content item `c` — resolved against the **current scope's** unit map (`bundle.units` while in the main steps, `flow.units` while inside a loaded flow, since each flow carries its own):

```ts
function unitFor(units, c) {
  // units = the active scope's map
  return units[c.ref]; // plain slug; version is frozen in
}
```

Example: the suspended-funds step content item is served as `ref:"prm.suspended-fund"` and resolves to `units["prm.suspended-fund"]` (which holds the version-1 body frozen at publish; the authoring source pinned it via `refVersion:1`). The other helpers below that read `ctx.bundle.units[...]` likewise use the active scope's units (the loaded `flow.units` when a flow is on the call stack).

**One version per unit per script.** Because the served map is keyed by plain slug, a script (scope) uses exactly **one** version of any given unit. `refVersion` selects _which_ single version to freeze; publish **rejects** a script that pins the same unit to two different versions (unpinned uses then follow that one pin, or the latest published when nothing pins it). You cannot mix `prm.x@1` and `prm.x@2` in the same script.

## 6. Steps (the container)

A step is a screen. It renders ordered **content** units, optionally runs **`onEnter`** logic before showing, and ends with **`buttons`** that own navigation. A step is one of two shapes: a **content step** (`content` + `buttons`) or a **callFlow step** (invokes a callable flow, §11).

```ts
interface Step {
  stepId: string;
  version: number; // the step definition's own version — bumped by authoring when the step changes;
  // recorded per traversal in the session audit (SESSION_STEP.step_version)
  title?: string;
  onEnter?: OnEnter[]; // logic run before the step renders (checks / waypoints)
  content?: ContentItem[]; // ordered units shown on the screen
  buttons?: Button[]; // navigation; owns all routing (§7)
  callFlow?: CallFlow; // callFlow step -> a callable flow, resolved in bundle.flows (§11)
  onExit?: Record<string, string>; // callFlow step: called-flow exit name -> caller stepId (§11)
}

interface CallFlow {
  ref: string; // script id of the callable flow (resolves in bundle.flows)
  version?: number; // optional version pin of the called flow
  args?: Record<string, unknown>; // values bound to the called flow's params
}

interface OnEnter {
  kind: 'check' | 'waypoint';
  ref?: string; // check: unit slug of the automated-check to resolve (§8.1/§13)
  // waypoint only:
  id?: string; // name referenced by routes, e.g. "wp-pre"
  aggregate?: 'all-pass' | 'tri-state' | 'single-joint'; // §9
  source?: string; // the onEnter check ref whose styling is aggregated
}

interface ContentItem {
  id: string; // stable id used by visibleWhen / routes (e.g. "c-alt-q")
  ref?: string; // unit slug (may be "{{param}}" inside a callable flow); resolves in the scope's units (§5.1)
  inline?: InlineUnit; // inline prompt/question instead of a library ref (§10.2)
  visibleWhen?: string; // expression; when false the item is hidden (§12)
}
// NOTE: `refVersion` is an AUTHORING field (the library pin) — it is resolved at
// publish and does NOT appear in the served bundle/flow (§5.1 / §2).
```

### 6.1 How the retired node types map onto steps

The old node/edge graph is gone. Each former node type now lives in a specific place on a step:

| Former node type                                  | New home on a step                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `prompt` / `question` / `manual-check` / `action` | a **content item** in `content[]` (rendered by §7-render / §10)                                                                  |
| `automated-check`                                 | an **`onEnter`** entry `{kind:'check', ref}` (§8.1/§13); its outcome/detail is read by `routes`, `visibleWhen`, and placeholders |
| `waypoint`                                        | an **`onEnter`** entry `{kind:'waypoint', id, aggregate, source}` (§9); its result is read by `routes`                           |
| `end-call`                                        | a **button** `{kind:'end'}` (closing actions via `onClick`)                                                                      |
| `call-script`                                     | a **`callFlow`** step                                                                                                            |
| edges (incl. edge `onEnter` actions)              | **button `routes`** (`when → to`, with optional route `onEnter` actions, §7)                                                     |

A content step with no visible content and a single `{kind:'auto'}` button is a **pure decision step**: its `onEnter` runs, the auto button's routes evaluate immediately, and the engine moves on without rendering (used for check/waypoint branch points).

## 7. Buttons & routing

Buttons sit at the end of a step and own all navigation. Answering a question/manual-check _inside_ a step only captures the answer and reveals dependent content (`visibleWhen`); it does **not** navigate. Navigation happens **only** on a button.

```ts
interface Button {
  key: string;
  kind: 'auto' | 'next' | 'back' | 'custom' | 'end';
  label?: string;
  visibleWhen?: string; // hide the button unless true (§12)
  enabledWhen?: string; // disable (e.g. until required questions answered) (§12)
  onClick?: string[]; // action refs fired when clicked (end-call closing actions)
  routes?: Route[]; // ordered; first matching route wins
}

interface Route {
  when?: string; // expression over answers/checks (§12); ABSENT = catch-all
  to: string; // target stepId, "@exit:<name>" (§11), or "@end" (end the call)
  onEnter?: string[]; // action refs fired when THIS route is taken (mirrors old edge onEnter)
}
```

Button kinds:

- **`auto`** — no user affordance; its routes evaluate as soon as the step's `onEnter` completes (decision steps).
- **`next`** — advance; typically `enabledWhen` gates it until required content is answered.
- **`back`** — return to the previous step (see the back-navigation open item, §21.1/§21.6).
- **`custom`** — an authored action button (e.g. "Send form") with its own routes/`onClick`.
- **`end`** — end the call; fire `onClick` actions, then terminate (or, inside a callable flow, this is the terminal ending).

**Route resolution** when a button is clicked (or an `auto` button fires):

```ts
function resolveRoute(button, ctx): Route | undefined {
  if (!button.routes) return undefined; // e.g. a bare 'end' button
  return (
    button.routes.find(r => r.when == null || evalExpr(r.when, ctx)) ?? // first match; catch-all last
    undefined
  ); // no match -> engine error (validate at publish, §21.2)
}
```

When a route is taken, fire its `onEnter` actions (if any) **before** entering the target step. `to: "@end"` ends the call; `to: "@exit:<name>"` returns from a callable flow (§11); otherwise `to` is a `stepId`.

## 8. The traversal algorithm (top level)

The engine walks **steps**. For each step it runs `onEnter` logic, renders content (unless it is a decision/callFlow step), waits for a button, then follows the button's matching route.

```ts
async function run(bundle, results /* prefetch map, see 13 */) {
  const ctx = { bundle, results, checkData: {}, waypoints: {}, answers: {}, stack: [], session: [] };
  let step = getStep(bundle, bundle.startStepId);

  while (step) {
    // callFlow step: invoke the callable flow, then resume via onExit (or end if terminal)
    if (step.callFlow) {
      step = await runSubFlow(step, ctx);
      continue;
    } // §11

    await runOnEnter(step, ctx); // §8.1 checks + §9 waypoints; fills ctx.checkData / ctx.waypoints
    renderContent(step, ctx); // §7-render / §9-prompt: visibleWhen filters items

    const button = await awaitButton(step, ctx); // 'auto' resolves immediately; else the agent clicks
    record(ctx, step, button); // §14

    const route = resolveRoute(button, ctx); // §7
    await fireActions(button.onClick, ctx); // end/custom closing actions
    if (button.kind === 'end' && !route) return endCall(ctx);
    await fireActions(route?.onEnter, ctx); // route-level actions (old edge onEnter)
    if (route?.to === '@end') return endCall(ctx);
    step = getStep(bundle, route!.to); // '@exit:<name>' only valid inside a callable flow (§11)
  }
}

async function runOnEnter(step, ctx) {
  for (const e of step.onEnter ?? []) {
    if (e.kind === 'check') ctx.checkData[e.ref!] = await resolveCheckData(e.ref!, ctx); // §8.1/§13
    if (e.kind === 'waypoint') ctx.waypoints[e.id!] = deriveWaypointOutcome(e, ctx); // §9
  }
}
```

- **Rendering** a content item = resolve its unit (`unitFor`, §5.1) and render by unit kind: prompt text with placeholders (§9), question options (§10.2), manual-check outcomes (§10.1b), action affordance (§10.3). `visibleWhen` decides whether an item shows (§12).
- **`awaitButton`** returns the `auto` button immediately if present; otherwise it waits for the agent, respecting each button's `visibleWhen`/`enabledWhen`.
- Check **outcomes/detail** are keyed by check ref in `ctx.checkData`; **waypoint** results by `id` in `ctx.waypoints`. Routes and `visibleWhen` read both (§12).

## 9. Prompts & placeholders

A `prompt` unit:

```ts
interface PromptUnit {
  unitId: string;
  version: number;
  kind: 'prompt';
  body: string; // supports {{placeholder}} and conditional segments
  conditionalSegments?: boolean; // true => body uses {{#key}}…{{/key}} sections
  placeholders?: Placeholder[];
}
interface Placeholder {
  key: string; // token in the body
  source: string; // where the value comes from: a check ref
  // (e.g. "chk.policy-value") OR a question/manual
  // content item id on a step already visited (e.g. "c-alt-q")
  path: string; // for a check: JSON path within its raw response.
  // for a content item: "value" (chosen option key)
  // or "text" (chosen option's display label)
  format?: 'currency-gbp' | string; // optional display format
}
```

Rendering rules:

- `{{key}}` → resolve from `placeholders`:
  - if `source` is a **check ref**, read its raw data at `path` (data comes from the prefetch map or a live call, see 8.1/13);
  - if `source` is a **content item id** (a question/manual answer), read the captured answer — `path:"value"` gives the chosen option key, `path:"text"` gives that option's display label;
  - then apply `format` and substitute. A prompt that consumes an answer must sit on the same step (below the question) or a later step, so the answer exists when it renders (§21.2 data-dependency rule).
- When `conditionalSegments` is true, `{{#key}}…{{/key}}` renders the enclosed text only when the boolean placeholder `key` is truthy (Mustache-style). Example: `prm.warnings-conditional` shows benefit/penalty/MVR/bonus segments based on `chk.policy-features` flags.
- A callable script prompt may have `ref:"{{leadPrompt}}"` — resolve the param first (11), then render that unit.

## 8.1 / 10 Checks, questions, actions

### 10.1 Automated checks — the binding

```ts
interface CheckUnit {
  unitId: string;
  version: number;
  kind: 'automated' | 'manual';
  label: string;
  binding?: Binding; // automated only (manual has none)
  outcomes: string[]; // allowed outcome values (may be [])
  styling?: Record<string, 'pass' | 'amber' | 'fail'>; // outcome -> style
  optionLabels?: Record<string, string>; // manual: outcome -> display text
}
interface Binding {
  method: 'GET' | 'POST';
  url: string; // relative; prefixed with env.oracleApiBaseUrl at runtime
  restData: { Key: string; Value: string }[]; // BaseApi ILocator.RestData (policy/client key auto-added)
  resultPath: string; // path into the camelCased {items:[...]} response
  outcomeMap?: Record<string, string>; // raw scalar -> outcome (Pattern A)
  aggregateFlag?: AggregateFlag; // object result -> a named boolean (Pattern C)
  subChecks?: SubCheck[]; // object result -> per-flag checklist (Pattern D)
  subOutcomeMap?: Record<string, string>; // raw -> outcome for each sub-flag
}
interface AggregateFlag {
  outputKey: string;
  trueWhenAny: string[];
}
interface SubCheck {
  key: string;
  label: string;
}
```

The `binding` is exactly what `BaseApi` needs, so one generic service runs any check with no per-check code.

### 8.1 Resolving a check → `deriveOutcome`

`resultPath` decides the shape. Four patterns:

| `resultPath` points at | With                          | Engine produces                                                              |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| a leaf value           | `outcomeMap`                  | `outcomeMap[raw]` (Pattern A)                                                |
| a leaf value           | (none)                        | the raw value itself, for display (Pattern B)                                |
| an object              | `aggregateFlag`               | a named boolean on the check data: `outputKey = OR(trueWhenAny)` (Pattern C) |
| an object              | `subChecks` + `subOutcomeMap` | a per-flag list, each `subOutcomeMap[raw]` (Pattern D)                       |

```ts
function deriveOutcome(unit: CheckUnit, data: any): { outcome?: string; detail?: any } {
  const b = unit.binding!;
  const raw = valueAt(data, b.resultPath); // JSON_VALUE-equivalent (scalar) or object
  if (b.outcomeMap && !isObject(raw)) return { outcome: b.outcomeMap[raw] ?? raw };
  if (b.aggregateFlag) {
    // Pattern C: feeds placeholders / visibleWhen
    const flag = b.aggregateFlag.trueWhenAny.some(k => !!raw[k]);
    return { detail: { ...raw, [b.aggregateFlag.outputKey]: flag } };
  }
  if (b.subChecks) return { detail: raw }; // Pattern D: waypoint maps per-flag (9)
  return { outcome: raw }; // Pattern B: display value
}
```

- **Pattern A** outcome drives the check node's edges directly (e.g. `n-suspended` on `Yes`/`No`).
- **Pattern C** does NOT drive an edge; the `outputKey` boolean (`anyWarning`) is read by `visibleWhen` (see 12) and by prompt placeholders.
- **Pattern D** is consumed by a downstream waypoint (9); the check node's own out-edge is unconditional.

**Styling**: `styling[outcome]` maps an outcome to `pass|amber|fail`. This is where "which value is good" is decided — as **data on the check**, not in engine code. e.g. `chk.suspended-fund` = `{No:pass, Yes:fail}` vs `chk.allow-alternatives` = `{Yes:pass, No:fail}`.

### 10.2 Questions

```ts
interface QuestionUnit {
  unitId: string;
  version: number;
  kind: 'question';
  prompt: string;
  selectionMode: 'single' | 'multi';
  options: { key: string; text: string }[];
  optionLabels?: Record<string, string>;
}
```

Present `options`; the chosen option `key` is the content item's answer, read by button `routes`/`enabledWhen` as `<contentId>.value` and `<contentId>.answered`. A question can be defined **inline** on a content item instead of referencing a library unit:

```jsonc
{
  "id": "c-choice",
  "inline": {
    "kind": "question",
    "prompt": "How would you like us to help you with this?",
    "selectionMode": "single",
    "options": [
      { "key": "online", "text": "Online" },
      { "key": "email", "text": "Email" },
      { "key": "post", "text": "Post" }
    ]
  }
}
```

### 10.1b Manual checks

`kind:"manual"` has no `binding`; the agent picks from `outcomes` (labels via `optionLabels`). Placed in `content[]`, its chosen value is read by button `routes` as `<contentId>.value` (e.g. `chk.eid-warnings` → `no-warnings-or-waivable` / `warning-cannot-be-waived`).

### 10.3 Actions

```ts
interface ActionUnit {
  unitId: string;
  version: number;
  kind: 'action';
  actionType: 'log-task' | 'send-email' | 'send-post' | 'capture' | 'signpost';
  label: string;
  binding?: Binding | null; // POST binding for the side effect; null for signpost/capture-only
  data?: Record<string, unknown>; // payload merged into the POST
  captureFields?: string[]; // fields the agent captures (capture actions)
}
```

Actions run in one of two ways: as a **content item** (`capture`/`signpost` shown on the step), or fired by a **button `onClick`** or a **route `onEnter`** (fire-and-continue side effects). `signpost` actions with `binding:null` just display guidance.

## 9. Waypoints & aggregate modes

A waypoint is an `onEnter` entry (`{kind:'waypoint', id, aggregate, source}`). It takes the styling result(s) of its `source` check (another `onEnter` check on the same step, resolved into `ctx.checkData` first) and rolls them into one `pass|amber|fail` that the step's `routes` branch on via `<waypointId> == '<value>'`.

### 9.1 Building the `children` array

```ts
function childStylings(wp: OnEnter, ctx): ('pass' | 'amber' | 'fail')[] {
  const src = ctx.checkData[wp.source!]; // the source check's resolved data (by ref)
  const unit = ctx.bundle.units[wp.source!]; // the check unit definition
  if (unit.binding?.subChecks) {
    // Pattern D: one entry per sub-flag
    return unit.binding.subChecks.map(sc => {
      const raw = src.detail[sc.key];
      const outcome = unit.binding!.subOutcomeMap![raw];
      return unit.styling![outcome];
    });
  }
  return [unit.styling![src.outcome]]; // single-value check: one styling entry
}
```

### 9.2 The three modes (the ONLY engine-side rule)

```ts
function deriveWaypointOutcome(wp: OnEnter, ctx): 'pass' | 'amber' | 'fail' {
  const c = childStylings(wp, ctx);
  switch (wp.aggregate) {
    case 'all-pass':
      return c.every(x => x === 'pass') ? 'pass' : 'fail';
    case 'tri-state':
      return c.includes('fail') ? 'fail' : c.includes('amber') ? 'amber' : 'pass';
    case 'single-joint':
      return c.includes('amber') ? 'amber' : 'pass';
    default:
      throw new Error(`Unknown aggregate mode: ${wp.aggregate}`);
  }
}
```

These three cases are the complete set. Adding a waypoint of an existing mode needs **zero** code; only a brand-new mode needs a new `case`.

### 9.3 `aggregate` is the only executable field

`aggregate` is executable; the aggregation intent is data, not code. (The old prose `styleRule` node field is dropped in the step model — its meaning is captured by `aggregate` plus the check's `styling`.)

## 10.4 Chosen outcome → route (worked example)

Step `st-pre-decision` has `onEnter: [{kind:'check', ref:'chk.pre-surrender-flags'}, {kind:'waypoint', id:'wp-pre', aggregate:'all-pass', source:'chk.pre-surrender-flags'}]`. All sub-flags `N` → each `No` → `styling` `pass` → `children=["pass",…]` → `all-pass` → `pass`. The `auto` button routes `{ when:"wp-pre == 'fail'", to:"st-fail-form" }, { to:"st-trust-decision" }` → falls through to `st-trust-decision`.

## 11. Callable flows (callFlow step)

A `callFlow` step invokes a **callable flow**: a self-contained step sequence that is _just a script_ with `is_callable='Y'`. It may be a **call-only flow** (never served top-level — `is_top_level='N'`) or **another top-level script that is also callable** (§11.1). There is no distinction at runtime.

**Flows are linked, not inlined — and prefetched in parallel at session start.** To keep the bundle small, `bundle.flows[ref]` holds only a `FlowLink` (`{ ref, version }`), not the flow's steps. The full closure is listed (including flows reached only from inside other flows), so a link always exists. At session start the engine loads everything up front: alongside the bundle (`/lookup`) and the checks (`/prefetch`), it fans out **one `GET /scripts/flow/{ref}?version=N` per link, all in parallel** (a `forkJoin`), and **caches** each in memory for the session. The flow refs come from the bundle's `flows` map, so the flow calls join the startup fan-out as soon as the bundle resolves. Because every flow is cached before traversal begins, entering a `callFlow` step never blocks on a fetch. Each fetched flow is **self-contained**: it carries its own `units` (everything its steps render), so it resolves them against `flow.units` without touching the main bundle. The main bundle's `units` therefore carries only what the **main** steps use. A unit used by more than one scope is duplicated into each — the accepted cost of flows loaded as independent parallel calls.

```ts
interface Param {
  key: string;
  required: boolean;
  type: 'unitRef' | string;
  note?: string;
}
```

Invocation from a caller **callFlow step**:

```jsonc
// call a call-only flow (is_callable='Y')
{ "stepId": "st-scam", "callFlow": { "ref": "scam-and-advice" },
  "onExit": { "proceed": "st-chargeable", "think-stop": "st-signpost-moneyhelper" } }

// call another top-level script — identical shape, ref is just a script id
{ "stepId": "st-handoff", "callFlow": { "ref": "surrender-001" } }
```

Rules:

- Resolve the flow: `flow = cache[ref] ?? await fetchFlow(ref, bundle.flows[ref].version)`, then cache it. `fetchFlow` calls `GET /scripts/flow/{ref}?version=…`.
- Push a frame; bind `callFlow.args` to the flow's `params` (available as `arg.<key>` in `visibleWhen` and as `{{<key>}}` in a content `ref`).
- Traverse the flow from its `startStepId`, using the loaded `flow.steps`.
- A route `"to": "@exit:<name>"` returns control: pop the frame and continue at the caller step's `onExit[<name>]`.
- A route `"to": "@end"` (or an `end` button) inside a **terminal** flow ends the session; the caller needs no `onExit`.
- Callable flows may call other callable flows (e.g. `payment-collection-and-eid` has callFlow steps into `offer-all-channels`). Maintain a call stack — this works for a script calling a callable flow, a callable flow calling a callable flow, and a script calling another script alike.
- A content item may be gated by `visibleWhen:"arg.leadPrompt != null"` and its `ref` may be `"{{leadPrompt}}"` — resolve the param first, then render that unit.

### 11.1 Calling a top-level script

A top-level `(classifier_1, classifier_2)` script can be invoked as a callable flow by another script — e.g. a Transfer script handing off entirely to the Surrender script, or reusing a shared onboarding script. Because a callable flow _is_ a script (`is_callable='Y'`), this needs no special mechanism: the call is the same `callFlow` step, and the called script is linked in the same `bundle.flows` map. `is_top_level` and `is_callable` are orthogonal flags, so a script can be served top-level **and** callable at once.

- The called script is **linked** under `bundle.flows[scriptId]` at publish time (a `FlowLink`), and fetched in the session-start parallel fan-out via `GET /scripts/flow/{scriptId}?version=N` — exactly like a callable flow. The whole closure of flows it in turn reaches is linked too and fetched in the same fan-out. The engine never fetches a second _bundle_ mid-call, only individual flows.
- A script version declares how it behaves **when called**: `terminal` (default `true` — it runs to its own ending and ends the call), plus optional `params`/`exits`. To return to the caller instead of ending, the script declares `exits` and its steps route to `@exit:<name>` (exactly like a callable flow).
- Version pinning: the `FlowLink.version` frozen at publish fixes which version is loaded; `callFlow.version` may pin it explicitly at authoring time (mirrors unit `refVersion`).
- Publish-time validation (§21.2) must reject a `callFlow.ref` that is not a published script, and a call that expects an exit the called flow does not expose.

```ts
async function runSubFlow(callStep, ctx): Promise<Step | null> {
  const cf = callStep.callFlow;
  const link = ctx.bundle.flows[cf.ref]; // { ref, version }
  const flow =
    ctx.flowCache[cf.ref] ?? // pre-fetched at session start (parallel fan-out)
    (ctx.flowCache[cf.ref] = await ctx.fetchFlow(cf.ref, link.version)); // fallback: fetch if somehow absent
  const frame = { args: bindParams(flow.params, cf.args) };
  const exit = await traverseFlow(flow, flow.startStepId, ctx, frame); // exit name, or null if terminal ended the call
  if (flow.terminal || exit == null) return null; // call ended
  return getStep(ctx.bundle, callStep.onExit![exit]); // resume caller
}
```

## 12. Conditional visibility & enablement (`visibleWhen` / `enabledWhen`)

The engine needs one small expression evaluator, used by content `visibleWhen`, button `visibleWhen`/`enabledWhen`, and route `when`.

- **`visibleWhen`** (content) shows/hides a content item. Reads answers and check data: `"<contentId>.answered"`, `"<contentId>.value == '<key>'"`, `"<checkRef>.<field> == <value>"` (a check's `aggregateFlag.outputKey` or a raw key), `"<checkRef> == <value>"` (a Pattern A outcome), `"<waypointId> == <value>"`, and `"arg.<key>"`. Example: the warnings prompt and follow-up question are `visibleWhen:"chk.policy-features.anyWarning == true"`.
- **`enabledWhen`** (button) gates a Next/custom button, typically until required content is answered, e.g. `"c-alt-q.answered"` or `"chk.allow-alternatives == 'No' || c-alt-q.answered"`.
- **`when`** (route) selects which route a button follows; first match wins, an absent `when` is the catch-all (must be last).

Legacy note: the old node/edge model expressed the same gating with `skipEdge`/`skipWhen`/a `condition` node — none of these exist in the step model. A former "skip to next" edge is just an item that is `visibleWhen`-hidden while the step's Next button still routes on. Example pair (old → new):

```jsonc
// OLD (node/edge):
{ "nodeId":"n-continue-warn", "type":"question", "ref":"qst.continue-or-think",
  "visibleWhen":"n-features.anyWarning == true", "skipEdge":"__skip__" }
// edges:
{ "from":"n-continue-warn", "on":"__skip__", "to":"n-hold" }

// NEW (step): the question is just a visibleWhen-gated content item; Next routes on.
{ "id":"c-continue", "ref":"qst.continue-or-think", "visibleWhen":"chk.policy-features.anyWarning == true" }
// button:
{ "key":"next", "kind":"next", "enabledWhen":"chk.policy-features.anyWarning == false || c-continue.answered",
  "routes":[ { "when":"c-continue.value == 'think'", "to":"st-signpost-moneyhelper" }, { "to":"st-hold" } ] }
```

Provide a tiny, safe expression evaluator (support `==`, `!=`, `&&`, `||`, boolean/`null`/string/number literals, and `contentId.value` / `contentId.answered` / `checkRef.field` / `waypointId` / `arg.key` lookups). Do **not** use `eval`.

## 13. Check prefetch (results map — beside the bundle, never inside it)

Automated checks can be run **up front** and their answers delivered as a per-session **results map**, keyed by check ref. It is separate from the bundle (the bundle is shared/cached; answers are per-policy).

```ts
interface CheckResult {
  raw?: string; // scalar value at resultPath
  outcome?: string; // mapped outcome (Pattern A)
  detail?: any; // object result (Patterns C/D)
  version?: number;
  source: 'prefetch' | 'live';
  status: 'ok' | 'error';
  error?: string;
  fetchedAt?: string;
}
type ResultsMap = Record<string, CheckResult>; // keyed by check ref
```

Endpoints (see 15):

- `POST /scripts/session/{id}/prefetch` → runs the script's automated checks server-side, persists to `SESSION_CHECK_RESULT`, returns the map.
- `GET  /scripts/session/{id}/checks` → the current map (resume/inspect).

**Resolution rule** (this is the whole point) — called from a step's `onEnter` check (§8):

```ts
async function resolveCheckData(ref, ctx): Promise<{ outcome?: string; detail?: any }> {
  const unit = ctx.bundle.units[ref];
  const hit = ctx.results[ref];
  let data;
  if (hit && hit.status === 'ok') {
    data = hit.detail != null ? { detail: hit.detail } : { raw: hit.raw, outcome: hit.outcome };
  } else {
    data = await ctx.checkService.run(unit.binding); // miss or error -> LIVE (source:'live')
  }
  const d = deriveOutcome(unit, data.detail ?? data.rawResponse ?? data);
  return { ...data, ...d }; // stored as ctx.checkData[ref]; read by routes/visibleWhen/waypoints/placeholders
}
```

Notes: prefetch does the simple Pattern A mapping server-side; Patterns C/D arrive as `detail` and are mapped engine-side, so the mapping logic lives in **one** place regardless of source. Only **automated** checks are prefetched; manual checks are answered live (as `content` items). A miss or `status:'error'` transparently falls back to a live call. Prefetch must be **side-effect-free GETs** only.

**Startup fan-out.** At session start the engine issues, in parallel (`forkJoin`), the bundle (`/lookup`), the checks prefetch (`/prefetch`), and — from the bundle's `flows` map — one `GET /scripts/flow/{id}` per linked flow (§11). Everything is in memory before traversal begins.

Because flows are no longer inlined in the bundle, prefetch discovers the checks of reachable flows **server-side from the DB** (the main script's checks come from the bundle's `steps`; each linked flow's checks are read from that flow version's step `onEnter`). So a separately-fetched flow's automated checks are still prefetched up front, even though its steps aren't in the bundle.

## 14. Session recording (audit)

As it traverses, the engine records to `SESSION_STEP` (via an endpoint or batched): `seq`, `script_context` (`main` or callable flow id), `step_id`, `step_version` (the `Step.version` actually traversed — so the exact iteration of a step a caller saw is auditable), `content_ref` (the answered content item), `answer` (question/manual choice), `button_key` (the button clicked), `route_to` (resolved route target), `check_result` (raw + mapped, from `onEnter`), `styling`. Resolved check answers also land in `SESSION_CHECK_RESULT` (`source:'live'` when fetched on demand). `script_session` holds `classifier_1/classifier_2/policy_id/agent_id/started_at/ended_at/outcome`.

## 15. ORDS endpoints

| Method / path                                     | Purpose                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /scripts/lookup?classifier_1=&classifier_2=` | The frozen bundle (application/json), consumed as-is. Selects the primary published version of the **top-level** script for that classifier pair. Carries `flows` as `{ ref, version }` links, not inlined flows.                   |
| `GET /scripts/flow/{id}?version=N`                | One callable flow's `CallableFlow` (steps + its own units + nested flow links). Called once per linked flow in the session-start parallel fan-out (§11/§13). `version` optional (defaults to the flow's primary published version). |
| `POST /scripts/session/{id}/prefetch`             | Run automated checks (main + reachable flows), persist, return the results map.                                                                                                                                                     |
| `GET /scripts/session/{id}/checks`                | Current results map for the session.                                                                                                                                                                                                |

All stream the CLOB (avoids the 32k `htp` limit). See `pkg_script_publish` (assembly, `get_bundle`, `get_flow`, `set_primary_version`) and `pkg_script_prefetch` (`prefetch_session`, `results_map`) in `ords-schema.sql`.

## 16. Angular service architecture (per project conventions — NgModules, RxJS, BaseApi)

```
ScriptEngineService              // startup fan-out: bundle + results map + all flows (parallel), holds session state, runs the step loop (8)
  ├─ runOnEnter()                // 8/8.1/9 — resolve onEnter checks + waypoints for a step
  ├─ deriveOutcome()             // 8.1  — outcomeMap / aggregateFlag / subChecks
  ├─ deriveWaypointOutcome()     // 9    — all-pass / tri-state / single-joint
  ├─ renderPrompt()              // 9    — placeholders + conditional segments
  ├─ resolveRoute() / evalExpr() // 7/12 — first-match routing + safe expression evaluator
  └─ ScriptCheckService extends BaseApi
        run(binding) -> get()/post() -> read resultPath   // live check on prefetch miss/error
  ScriptPrefetchService          // POST /prefetch at session start; GET /checks on resume
  ScriptFlowService              // GET /scripts/flow/{id}?version= ; fetches ALL flows in parallel at session start, caches by ref (§11)
  ScriptSessionService           // records SESSION_STEP / session lifecycle
```

A **StepRenderer** component renders the current step: it lays out `content[]` (switching on each unit's `kind`, filtered by `visibleWhen`) and the `buttons[]` (respecting `visibleWhen`/`enabledWhen`), and emits the clicked button to the engine. At session start the engine fires the bundle, the checks prefetch, and one flow call per link all in parallel (§13); it then resolves every `onEnter` check via §13. When a `callFlow` step is entered, `ScriptFlowService` returns the already-cached flow (fetched in that startup fan-out); each flow is self-contained and resolves its content against its own `flow.units`. Keep mapping/aggregation in the services above — never re-implement it per step or push it into the data service (the data service returns raw facts only).

## 16.1 Management UI: creating a script

A script is created via `pkg_script_author.create_script`, which inserts the `script` row and its `v1` draft version. The author sets:

- **`is_callable`** (`CHAR(1)`, **default `'Y'`**) — whether other scripts may invoke it as a flow. A user choice at creation, not derived.
- **`is_top_level`** (`CHAR(1)`, default `'N'`) — whether the GET lookup serves it. A top-level script **must** carry both classifiers (its serving key); enforced by `script_toplevel_ck`.
- **`classifier_1` / `classifier_2`** — two fixed, domain-neutral keys whose values come from lookup tables (`script_key_lookup_1`, `script_key_lookup_2`) and whose **display labels** come from `script_key_dimension` (e.g. `1 → "Product"`, `2 → "Request Type"`). The schema never hard-codes those business labels. For a top-level script the pair is the unique serving key (partial unique index `script_serving_key_uix`, counting only `is_top_level='Y'` rows); **any** script — including a callable-only flow — may also set them as **non-unique classification tags**.
- **`category`** — optional grouping from `script_category` (e.g. `common` for the globally reusable flows).

Every script must be reachable at least one way (`script_reachable_ck`: `is_top_level='Y' OR is_callable='Y'`).

There are **two creation paths**, both hitting `create_script`:

1. **Standalone** — author starts a new script from scratch (the "New script" screen).
2. **From within a script** — while editing script A, the author creates a new callable script B; the UI then drops a `callFlow` step referencing B into A's draft (via `add_step`). `create_script` only makes B; the wiring is a normal step add.

## 16.2 Management UI: step lifecycle & the no-sharing rule

Steps are authored per script and **cannot be shared across scripts** — a step created in one script belongs to that script alone. This is enforced in storage: a step's identity is `(script_id, step_id)`, its definitions are versioned in `script_step_version` (scoped to `script_id`), and a script version's step set (`script_version_manifest`) references step versions through composite FKs that make it structurally impossible to include another script's step (§ schema header). Units remain the shared/library concept; steps do not.

A step carries its own **version** (§6, `Step.version`). Edits always land on an **editable draft** script version: if the live version is published, the first edit clones it into a new draft (published snapshots are never mutated). The four management-UI operations map to `pkg_script_author`:

| UI action                  | Effect                                                                                                      | Package call          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------- |
| **Add a step**             | Create the step identity + first version (`v1`) and include it in the draft's step set                      | `add_step`            |
| **Remove a step**          | Drop it from the draft's step set; the step's version history is kept (soft remove, restorable)             | `remove_step`         |
| **Amend a step**           | Create the next version (starting from a clone of the currently selected version) and point the draft at it | `amend_step`          |
| **Select another version** | Point the draft at any existing version of the step (roll back/forward)                                     | `select_step_version` |

The served JSON is unaffected by all of this: `steps_of_script` walks the manifest to each step's **selected** version and emits the same `stepId + version + content/buttons/...` shape. The version a caller actually traversed is recorded in `SESSION_STEP.step_version` (§14).

---

# BACKGROUND & MAPPING

## 17. Callable flows (the reuse mechanism)

A callable flow is a self-contained step sequence with a `startStepId` and named `exits`, invoked via a `callFlow` step. It is just a script with `is_callable='Y'`: a **call-only flow** (`is_top_level='N'`) or **another top-level script that is also callable** (§11.1) — both resolved in `bundle.flows`. `offer-all-channels` alone replaces 6 copy-pasted endings in the original diagram — a `leadPrompt` arg supplies the only part that varies; a whole script (e.g. Surrender) can likewise be invoked by another script as a single hand-off.

| Mini-script                                      | Reused for                                                      | Terminal? / exits                     |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------- |
| `offer-all-channels` (online/email/post + close) | the repeated "offer online/email/post then close" call endings  | terminal                              |
| `offer-form` (email/post form + close)           | the repeated "offer the form by email/post then close" endings  | terminal                              |
| `partial-surrender-form`                         | the partial-surrender online-form eligibility & delivery branch | terminal                              |
| `pup-ph-info`                                    | the paid-up / premium-holiday information branch                | terminal                              |
| `scam-and-advice`                                | the scam-awareness & financial-advice signposting block         | `proceed`, `think-stop`               |
| `chargeable-event`                               | the chargeable-event / non-qualifying policy warning block      | `proceed`, `think-stop`               |
| `payment-collection-and-eid`                     | the payment-collection, bank-rules, Bond-check & EID block      | `completed`, `id-required` (terminal) |

## 18. Diagram legend ↔ step model

The original Visio legend maps onto the step model per §6.1 (content unit / `onEnter` / button / callFlow):

| Diagram legend                            | Step-model home                       |
| ----------------------------------------- | ------------------------------------- |
| Prompt / Question / Manual check / Action | a **content item**                    |
| Automated check                           | an **`onEnter`** check                |
| Conditional waypoint                      | an **`onEnter`** waypoint             |
| Start / End call                          | an **`end`** button (or `@end` route) |
| (composition)                             | a **callFlow** step                   |

## 19. Full flow coverage

Every actionable step in the `Call Centre - Surrender Process V2.0` diagram is represented in the step model (`Library/surrender-001.json` and the bundle). The table below is the diagram-step → **legacy node id** mapping; each legacy node id now lives on a step per §6.1 (e.g. the suspended-fund check/prompt/end/log-task = steps `st-suspended` / `st-suspended-info`). Non-flow shapes (the legend, the style-rule labels, the "Gap in script?" note, the "Enhancement opportunity" callouts, and the title block) are intentionally not represented.

| Flow step (from the Surrender diagram)                                                                                   | Represented as (legacy node ids; see §6.1 for step homes)              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Call start                                                                                                               | `startStepId` = st-suspended (was n-suspended)                         |
| Suspended-fund check → prompt → end call → log-task action                                                               | n-suspended / n-susp-prompt / n-susp-end / act.log-task-suspended-reqs |
| Alternatives-allowed check → intro prompt → "interested in alternatives?" question                                       | n-allow-alt / n-alt-intro / n-alt-q                                    |
| Partial-surrender form branch                                                                                            | partial-surrender-form                                                 |
| Paid-up / premium-holiday info branch                                                                                    | pup-ph-info                                                            |
| Value-today prompt → policy-features check → conditional warnings prompt → continue-or-think question                    | n-value-today / n-features / n-warnings / n-continue-warn              |
| On-hold prompt → bulk pre-surrender flags check → its pass/fail waypoint                                                 | n-hold / n-pre-checks / n-wp-pre                                       |
| Trust/assignment/bankruptcy check → tri-state waypoint → manual fallback check → confirmation question                   | n-trust-check / n-wp-trust / n-trust-manual / n-trust-confirm          |
| Third-party-claim prompt → fastest-method intro → method-choice question → website-link warning                          | n-third-party / n-method-intro / n-which-method / n-website-warn       |
| Single/joint ownership check → its waypoint → can-complete-by-phone prompt                                               | n-ownership / n-wp-own / n-can-phone                                   |
| Other-policyholder-present question → speak-to-them question → capture-names action → happy-to-continue-jointly question | n-other-ph / n-speak-ph / n-capture-ph / n-happy-joint                 |
| "Both policyholders needed" ending                                                                                       | n-both-needed → offer-all-channels                                     |
| Can-process-request prompt → things-to-know prompt                                                                       | n-can-process / n-things                                               |
| Scam-awareness & advice block                                                                                            | scam-and-advice                                                        |
| Chargeable-event warning block                                                                                           | chargeable-event                                                       |
| Online-or-phone question → direct-to-help-centre action → end call                                                       | n-online-or-phone / n-online-act / n-online-end                        |
| Payment-collection & EID block                                                                                           | payment-collection-and-eid                                             |
| MoneyHelper signpost ending                                                                                              | n-signpost-moneyhelper → offer-all-channels (prm.moneyhelper-signpost) |
| Failed-eligibility / paper-form / cannot-proceed-form endings                                                            | n-fail-form / n-paper-form / (sub payment) n-cannot-form → offer-form  |
| Payment-stop / EID-fail endings                                                                                          | (sub payment) n-stop-1 / n-stop-2 / n-eid-fail → offer-all-channels    |
| Log-payment-out action on completed endings                                                                              | act.log-payment-out (onEnter of completed end-calls)                   |

## 20. Build checklist

1. Model the bundle types (§5–7) and load `GET /scripts/lookup`.
2. Implement the step loop (§8) with a StepRenderer component (content + buttons).
3. Implement `deriveOutcome` (§8.1), `deriveWaypointOutcome` (§9), `renderPrompt` (§9), `resolveRoute`/`evalExpr` (§7/§12).
4. `ScriptCheckService extends BaseApi` for live checks; `ScriptPrefetchService` for the results map (§13).
5. Callable-flow call stack + `@exit`/`@end` handling (§11).
6. Session recording (§14).
7. Validate against `call-centre-surrender-response/surrender-001.steps.bundle.example.json` + `call-centre-surrender-response/surrender-001.checks.example.json` end to end.

## 21. Open considerations (not yet specified)

The sections above cover the happy path. These are known gaps to resolve before/while building — grouped by likelihood of biting.

### 21.1 Engine behaviours still undefined

- **Multi-select questions.** `selectionMode:"multi"` exists in the type, but routes match a single `value`. Define how a multi-answer routes (combined key, priority order, or a follow-up rule). Latent today — all current questions are `single`.
- **Live-check failure.** `resolveCheckData` falls back from prefetch to a live call; if the live call _also_ fails, the outcome is `undefined` and route matching throws. Define the behaviour: agent-visible error, allow manual override, or a designated fallback route.
- **Back navigation / editing a prior answer.** Agents routinely go back and change an answer mid-call. The step loop is currently forward-only with no undo/recompute model. This shapes session-state design (keep an answer/step stack + re-derive downstream, or snapshot per step). See the back-button open item in §21.6.
- **Action re-firing / idempotency.** Button `onClick` and route `onEnter` actions fire on click/traversal (log task, send email, POST). Going back then forward can fire them twice. Define fire-once/dedupe or idempotency semantics, especially for POST actions.
- **Data-dependency rule.** Prompt placeholders (e.g. `chk.policy-value`) and `visibleWhen` (e.g. `chk.policy-features.anyWarning`) assume their source check is already resolved. Make explicit (and validate) that a placeholder/condition's source check must run in an earlier (or the same) step's `onEnter` — or be prefetched — before the content that consumes it.

### 21.2 Publish-time validation (nothing checks this yet)

The schema enforces FKs but not step-graph semantics. A publish-time validator should reject:

- a route `to` pointing at a missing step, an undefined `@exit:<name>`, or `@end` in a non-terminal context;
- a question/manual-check option value with **no** matching route (dead option), or a route `when` value no content item can produce;
- a waypoint `source` that is not an `onEnter` check on the same step;
- a terminal callable flow that cannot reach an `end` button / `@end`, or a non-terminal one with an unbound exit or an unmapped `onExit`;
- a `callFlow` whose `ref` does not resolve in `flows` (i.e. is not a published script), targets a script that is **not callable** (`is_callable<>'Y'` — already rejected in `publish_script`, `ORA-20013`), or expects an `onExit` the called flow does not expose;
- unreachable steps, or cycles that can loop forever;
- an authoring `ref`/`refVersion` that does not resolve to a published library unit at publish (the assembled bundle then carries only the resolved `ref`).
- the **same unit pinned at two different versions** within one script — publish enforces one version per unit per script (§5.1); this is already rejected in `publish_script`.

Without this, a broken script publishes cleanly and fails live on the call.

### 21.3 Operational

- **Prefetch staleness.** Answers carry `fetchedAt`; on long calls, sensitive checks (e.g. recent bank-detail changes) may need a TTL or forced re-fetch. Decide the policy.
- **Server-side HTTP vs client fan-out.** The session-start load (bundle + prefetch + one call per flow) runs as a client-side `forkJoin`. Still open: whether the _checks themselves_ run server-side (`pkg_script_prefetch` via `APEX_WEB_SERVICE`, needing a network ACL + wallet) or client-side (`forkJoin` + persist). The flow fetches are always the client fan-out described here.
- **Auth.** Who may publish scripts; ORDS auth on the three endpoints; capturing agent identity into the session.
- **Shared check ref with differing inputs.** Prefetch keys by check ref and dedupes (usually desirable), but breaks if two uses of the same ref need different params. Note/guard against it.

### 21.4 Schema loose ends

- `build_units` is now scope-referenced (per `script_version`): the main bundle bundles only the main steps' units and each flow bundles its own via the same function, so pinned units resolve per scope with no cross-scope UNION. It applies one placeholder-source pass; the publish-time validator (§21.2) should enforce the full transitive closure.
- Replace the recursive-CTE caveat with a `SCRIPT_CURRENT` helper view for the primary published version (the `flows` closure recurses over `call_flow_json.ref`).
- The terminal `payment-collection-and-eid` now declares `exits:[]` (its former `completed`/`id-required` exits were unreachable — every branch ends via a button); keep it terminal.

### 21.5 Testing

- Unit tests for `deriveOutcome` (all four patterns) and `deriveWaypointOutcome` (all three modes).
- A golden end-to-end walk of `call-centre-surrender-response/surrender-001.steps.bundle.example.json` + the checks map, asserting the route for a couple of policy scenarios.

### 21.6 Step model — IMPLEMENTED

The step model (Option A: **buttons own navigation**) is now the spec: it is defined in §5–§12 above, stored by the STEP tables in `ords-schema.sql`, and realised end-to-end in `Library/surrender-001.json` (full main script), `call-centre-surrender-response/surrender-001.steps.bundle.example.json` (the frozen bundle: main steps + `{ ref, version }` flow links + the main steps' units inlined), and `call-centre-surrender-response/Flows/<flowId>.v<version>.json` (the 7 callable flows in step form, one file per callable script, each the response to its own `GET /scripts/flow/{id}?version=N` call). The node/edge model is retired; §6.1 maps the old node types onto steps.

**Two route conventions that fell out of the callable flow conversion:**

- **`to: "@end"`** — a route (not just a button) can end the call. Used when the _answer_ decides the ending, so an `end` button alone won't do (e.g. `offer-all-channels`: the chosen channel routes to `@end`).
- **Route `onEnter` actions** — a route may fire actions when taken (`{ when, to, onEnter:[...] }`), mirroring the old edge `onEnter`. This is how a single choice fires a different side effect per branch (e.g. `act.email-surrender` vs `act.post-sv100` depending on post/email) before ending.

Route `to` targets are therefore: a `stepId` (same flow), `"@exit:<name>"` (return to a callable flow's caller, mapped by the caller step's `onExit`), or `"@end"` (end the call).

**Still to do (rollout tail):**

- The legacy node/edge authoring sources (`surrender-001.json`, `transfer-001.json`, `sub-scripts.json`) and the old node/edge bundle have been removed; the step model is now the only representation. A Transfer script in the step model still needs authoring (it can reuse the same library + callable flows, and could `callFlow` into Surrender per §11.1).
- The 7 callable flows now live in `call-centre-surrender-response/Flows/`, one file per callable script (`Flows/<flowId>.v<version>.json`), each the response its own `GET /scripts/flow/{id}?version=N` call returns — separate from the frozen bundle, which links to them by `{ ref, version }`.
- The management-UI writes are implemented in `pkg_script_author`: script creation (`create_script`, §16.1) and step edits (add/remove/amend/select-version against an editable draft; §16.2). Wiring the Angular management screens to these procedures, plus content/button editing per step version, is the remaining UI work.

**Deferred:** Back-navigation behaviour when a Step already fired an action/check — restore prior state vs re-run checks vs never re-fire actions — to be decided (relates to the action-idempotency item in §21.1).

**Treat as must-do before build:** §21.2 (publish-time validator) and the back-navigation + action-idempotency items in §21.1 — they change how session state is modelled.
