# Journey Mapper

The Journey Mapper is an experimental review shell around a running prototype.
It does not replace or reimplement the prototype. `JourneyShellComponent`
projects the real app into an inset viewport, adds review controls, and can
show its captured journey alongside it.

Open the app with `?view=full` to render the prototype on its own. The shared
`src/app/view-mode.ts` helper keeps this mode independent of the mapper, so
another prototype can use the same query flag.

## Journey data

Journeys are JSON files in `src/assets/data/journeys`:

- `index.json` lists the available journeys and the default one.
- Each `*.journey.json` file defines one named path through the prototype.

A journey has ordered steps. Each step provides a stable `id`, `title`,
`action`, `result`, and optional `notes`. Its `target` is a CSS selector for
the live prototype control or region. `do` describes how capture moves the
prototype onwards:

```json
{
  "id": "enter-reference",
  "title": "Enter the reference",
  "action": "Type PMR12345678910.",
  "result": "Search becomes pressable.",
  "target": "#MenuSearch_ReferenceNumber",
  "do": [{ "type": "type", "value": "PMR12345678910" }]
}
```

An absent `do` clicks `target`; `do: []` is a read-only step. Actions can be
`click`, `type`, `select`, or `none`, and an action can override the step’s
target. Use selectors that describe the control’s purpose, not its incidental
position in a list.

## Capture and frames

`JourneyCaptureService` loads the selected JSON journey and walks the live
prototype in order. For every step it:

1. Captures the full running app **before** performing the step.
2. Copies current field values and scroll positions that DOM markup does not
   retain.
3. Measures the step target to create a focus mask over the full frame.
4. Performs the step actions and waits for the prototype to settle.

Frames are full-app DOM snapshots, stored per browser tab in IndexedDB after a
successful pass. The capture service also retains the component styles present
at capture time, so a later frame is drawn with the styles that made it.
After storage, the page reloads to return the live prototype to its initial
state.

`JourneyCloneComponent` renders a captured frame inertly. It has no live
Angular components or services beneath it, and its focus mask highlights the
step subject without cropping the surrounding app.

Do not add hand-authored frame HTML to this folder or the journey JSON. Frames
must continue to come from the runtime prototype so they cannot silently drift
from the screens being reviewed.

## Presentation

`JourneyMapComponent` renders the captured path. Stack mode is the default:
smaller frames form a vertical film strip at left, while the selected step is
shown large at right with its action and result. The selected frame can expand
within the map and returns to the stack with **Return to stack**. Grid mode is
an alternate overview of the same captured frames; selecting one opens the
same expanded frame view.
