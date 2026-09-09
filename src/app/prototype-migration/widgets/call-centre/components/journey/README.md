# Script journey player

The read-only contract is under `src/assets/collab-dev/call-centre-scripts/reference/`.
The local runtime copy is under `src/assets/data/call-rep-scripts/surrender/`:

- `surrender.bundle.json` contains the Surrender steps, routes, and main units.
- `surrender.checks.json` contains local check outcomes for the walkthrough.
- `flows/` contains the copied callable-flow responses.

The player keeps the existing journey UI and follows button routes from the
bundle. It resolves `onEnter` checks from the local checks file, records action
refs locally, and shows a single End call screen when a flow file is missing.
It does not call ORDS.
When a screen is reached through checks or waypoints, it carries those check
results forward: one result is shown directly, while multiple results use an
ALP card and dialog.

Global player options live at
`src/assets/data/call-rep-scripts/player-options.json` and apply to every
script loaded by this player:

- `debugMode`: shows the compact step, unit, button, check, blocked-Next, and
  missing-route diagnostics.
- `showScriptInFirstStep`: mounts the journey in the first call-centre step
  when `true`; set it to `false` to hide it until the Surrender click is wired.

Both flags are currently `true`.
The first-step mount is in
`src/app/prototype-migration/widgets/call-centre/caller-details/caller-details-step.component.html`.
For now, the existing Surrender-tile mount remains in
`call-action-options.component.html` as a duplicate; it still opens from the
Surrender tile.

`STRUCTURE.example.jsonc` is a non-runtime shape guide showing steps,
content/unit refs, routes, `onEnter`, `callFlow`, and
`binding.aggregateFlag`.

To change a local check outcome, edit the matching entry in
`surrender.checks.json`, keep `"status": "ok"`, and change `"outcome"` (or the
`"detail"` fields used by that check). Do not edit the reference JSON.
If an entry is missing or has `"status": "error"`, the local runner uses its
explicit No/false stub and reports that value in debug rather than treating
undefined as a live result.
