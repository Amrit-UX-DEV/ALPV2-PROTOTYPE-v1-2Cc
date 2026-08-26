/**
 * A journey: one path through the prototype, written down as instructions.
 *
 * The prototype shows what a screen looks like. A journey says what a rep did
 * to get there and what happened when they did, which is the part a screenshot
 * cannot carry and the part a reviewer asks about first.
 *
 * What a journey does not hold is markup. A step says what to press and what
 * to press it with; the pictures beside those words are taken from the running
 * app when the shell starts, so a frame is whatever the prototype actually
 * draws today rather than a copy of what it drew when somebody wrote the
 * journey. Markup copied into this repo would be wrong the first time a
 * template changed, and wrong silently.
 */

/**
 * One frame: a photograph of part of the running app.
 *
 * The markup is the subject with the chain of ancestors above it rebuilt as
 * empty shells, because the app's stylesheets are nearly all descendant
 * selectors and a subtree lifted out of its place is drawn by almost none of
 * them.
 *
 * The size is the room the subject took on screen, in the app's own layout
 * pixels. A frame is laid out at that width and then scaled to fit, so it
 * reflows exactly as far as the real thing did and no further.
 */
export interface JourneyFrame {
  html: string;
  width: number;
  height: number;
  /** How the subject was drawn, so a frame can be checked against it later. */
  look: JourneyLook;
}

/**
 * A few of the things a screen looked like at the moment it was photographed.
 *
 * Enough to tell a frame that is drawn from one that is not. A frame missing
 * its stylesheets is not subtly wrong, it is a wall of unstyled markup at
 * entirely the wrong height, and that is exactly what these catch.
 */
export interface JourneyLook {
  color: string;
  background: string;
  fontFamily: string;
  fontSize: string;
  height: number;
}

/** How a step is carried out on the running prototype. */
export type JourneyActionType =
  /** Press it. The default where a step names a target and nothing else. */
  | 'click'
  /** Key `value` into a field and let the app hear it. */
  | 'type'
  /** Choose `value` in a select and let the app hear it. */
  | 'select'
  /** Nothing. A step that is only read: a screen to look at, not a control. */
  | 'none';

/**
 * One thing the capture pass does to the prototype to move it on.
 *
 * A list of these rather than one, because a step as a reviewer describes it
 * is not always one press: ticking two boxes and writing a note is a single
 * thing that happened, and splitting it into three steps would describe the
 * form rather than the work.
 */
export interface JourneyAction {
  /** Defaults to a click. */
  type?: JourneyActionType;
  /** Defaults to the step's own target. */
  target?: string;
  /** What to key or choose. Ignored by a click. */
  value?: string;
}

/** One thing a rep does, and what the prototype does back. */
export interface JourneyStep {
  /** Stable id. Frames are held against it. */
  id: string;
  /** What this step is, in a few words: 'Search for the reference'. */
  title: string;
  /** What the rep does, in the imperative: 'Choose Dashboard Reference'. */
  action: string;
  /** What the prototype does in response, in the present tense. */
  result: string;
  /**
   * A CSS selector for the thing the action is performed on.
   *
   * Used twice from the one place: the prototype view rings whatever it
   * matches on the live screen, and a frame rings whatever it matches inside
   * that step's picture. A step therefore cannot point at one thing in the map
   * and another in the app.
   *
   * Optional, because a step can be about a screen rather than a control.
   */
  target?: string;
  /**
   * What moves the prototype on from this step.
   *
   * Absent means a click on the target, which is what most steps are. An empty
   * list means the step changes nothing, which is how a step that is only read
   * is written.
   */
  do?: JourneyAction[];
  /**
   * What to photograph: a selector for the part of the screen the step is
   * about. The whole prototype where it is left out.
   *
   * Worth setting on most steps. A frame of one panel is read at a glance and
   * costs a few kilobytes; a frame of the entire app is neither.
   */
  capture?: string;
  /**
   * How long to let the app settle after each of this step's actions, in
   * milliseconds. Only worth setting where something takes its time.
   */
  settleMs?: number;
  /** Anything worth saying that is neither the action nor the result. */
  notes?: string;
}

/** A named path through the prototype. */
export interface Journey {
  id: string;
  /** What the journey is called, shown in the bar and at the top of the map. */
  name: string;
  /** One sentence on what the path is for and who walks it. */
  summary?: string;
  steps: JourneyStep[];
}

/** One journey as the index lists it, before its own file has been read. */
export interface JourneyIndexEntry {
  id: string;
  name: string;
  /** File under assets/data/journeys, e.g. 'dashboard-reference.journey.json'. */
  file: string;
}

/** The list of journeys a build holds, and which one opens. */
export interface JourneyIndex {
  /** The id to load on start. The first entry where this is absent. */
  default?: string;
  journeys: JourneyIndexEntry[];
}

/** Which of the two things the shell is showing. */
export type JourneyView = 'prototype' | 'journey';
