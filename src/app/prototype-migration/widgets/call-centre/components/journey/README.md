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

To change a local check outcome, edit the matching entry in
`surrender.checks.json`, keep `"status": "ok"`, and change `"outcome"` (or the
`"detail"` fields used by that check). Do not edit the reference JSON.
