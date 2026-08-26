import { Injectable, computed, signal } from '@angular/core';

import { Journey, JourneyAction, JourneyFrame, JourneyStep } from './journey.model';

/** Where a completed run is kept so it can survive the reload that follows it. */
const STORAGE_KEY = 'jm.frames';

/** How long to wait for a selector to turn up before giving up on it. */
const WAIT_MS = 3000;
const POLL_MS = 50;

/** How long to let the app answer an action before the next one. */
const SETTLE_MS = 300;

/**
 * Roughly what a session store will take. Over this the run is kept in memory
 * for the session instead, which costs the reload rather than the frames.
 */
const MAX_STORED_CHARS = 3_000_000;

/**
 * A ceiling on a frame's measured size. Something parked off-screen at a large
 * offset, which the legacy stack does in a few places, would otherwise report a
 * frame thousands of pixels wide and shrink the picture to nothing.
 */
const MAX_FRAME_PX = 2400;

export type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'failed';

interface StoredRun {
  journeyId: string;
  /** The steps the run was taken from, so a rewritten journey is not reused. */
  fingerprint: string;
  capturedAt: number;
  frames: Record<string, JourneyFrame>;
}

/**
 * Takes the pictures.
 *
 * The pass drives the running prototype through the journey. For each step it
 * photographs the screen as it stands, then does what the step says to do and
 * waits for the app to answer, and photographs the next one. What comes out is
 * a frame per step: the markup the app itself rendered, held as a string.
 *
 * Photographing before acting is the whole point of the order. A frame is what
 * the rep was looking at when they decided to do the thing the step describes,
 * not what they got for doing it: what they got is the next frame.
 *
 * Nothing here knows anything about the prototype. It is given a root element
 * and a list of selectors, and everything it does is done through them, which
 * is what keeps the shell a frame around the app rather than a part of it.
 *
 * A run leaves the prototype at the end of the journey, which is no place to
 * hand back to a reviewer. So a finished run is written to session storage and
 * the page is reloaded: the app comes back at its beginning, and the frames are
 * read from storage instead of being taken again.
 */
@Injectable({ providedIn: 'root' })
export class JourneyCaptureService {
  private readonly state = signal<CaptureStatus>('idle');
  readonly status = this.state.asReadonly();

  private readonly captured = signal<Record<string, JourneyFrame>>({});
  private readonly at = signal(0);
  /** When the frames on screen were taken, so a stale set can be spotted. */
  readonly capturedAt = this.at.asReadonly();

  private readonly done = signal(0);
  private readonly total = signal(0);
  readonly progress = this.done.asReadonly();
  readonly stepTotal = this.total.asReadonly();

  readonly percent = computed(() => {
    const total = this.total();
    return total ? Math.round((this.done() / total) * 100) : 0;
  });

  /**
   * What went wrong along the way without stopping the run.
   *
   * A selector that matches nothing is a fault in the journey or a change in
   * the app, and either way it is worth reading. It does not end the run,
   * because the steps after it are still worth having and a reviewer can see
   * for themselves where the path went wrong.
   */
  private readonly problems = signal<string[]>([]);
  readonly warnings = this.problems.asReadonly();

  private running = false;

  /** The frame for a step, absent where that step has none. */
  frame(stepId: string): JourneyFrame | undefined {
    return this.captured()[stepId];
  }

  /**
   * Reuses the last run if it was of this journey, and takes a new one if not.
   *
   * Called once the prototype has rendered, since there is nothing to
   * photograph before that.
   */
  async start(journey: Journey, root: HTMLElement): Promise<void> {
    if (this.running) return;

    const fingerprint = journey.steps.map((step) => step.id).join('|');
    const stored = this.read(journey.id, fingerprint);
    if (stored) {
      this.captured.set(stored.frames);
      this.at.set(stored.capturedAt);
      this.total.set(journey.steps.length);
      this.done.set(journey.steps.length);
      this.state.set('ready');
      return;
    }

    await this.run(journey, root, fingerprint);
  }

  /**
   * Throws away what was captured and takes it again from a fresh start.
   *
   * The reload is not incidental: a journey has to be walked from the
   * beginning, and the prototype is wherever the reviewer left it.
   */
  recapture(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* A store that cannot be written to cannot be holding a stale run. */
    }
    location.reload();
  }

  private async run(journey: Journey, root: HTMLElement, fingerprint: string): Promise<void> {
    this.running = true;
    this.state.set('capturing');
    this.total.set(journey.steps.length);
    this.done.set(0);
    this.problems.set([]);

    const frames: Record<string, JourneyFrame> = {};

    try {
      for (const [index, step] of journey.steps.entries()) {
        this.done.set(index);

        const scope = (await this.find(root, step.capture)) ?? root;
        frames[step.id] = this.snapshot(scope, root);

        await this.perform(root, step);
      }
    } catch (err) {
      console.error('The journey capture pass failed:', err);
      this.captured.set(frames);
      this.state.set('failed');
      this.running = false;
      return;
    }

    this.done.set(journey.steps.length);
    this.captured.set(frames);
    this.at.set(Date.now());
    this.running = false;

    // Only reload where the frames are safely written down. Reloading without
    // them would run the pass again on the next boot, and again after that.
    if (this.write(journey.id, fingerprint, frames)) {
      location.reload();
      return;
    }

    this.note(
      'The frames were too large to store, so the prototype has been left at the ' +
        'end of the journey. Reload the page to put it back at the beginning.',
    );
    this.state.set('ready');
  }

  /**
   * Everything a step says to do, in order, letting the app answer each one.
   *
   * The screen is compared with itself afterwards. A step that says to press
   * something and leaves the app exactly as it was has found a dead control,
   * and that is worth saying out loud: it is the difference between a journey
   * that is out of date and a prototype that is broken, and without the check
   * both look the same from the frames.
   */
  private async perform(root: HTMLElement, step: JourneyStep): Promise<void> {
    const actions: JourneyAction[] = step.do ?? (step.target ? [{ type: 'click' }] : []);
    if (!actions.length) return;

    const before = root.innerHTML;

    for (const action of actions) {
      await this.act(root, step, action);
      await this.settle(step.settleMs ?? SETTLE_MS);
    }

    if (root.innerHTML === before) {
      this.note(`Step '${step.id}': the screen did not change. Nothing responded to it.`);
    }
  }

  private async act(root: HTMLElement, step: JourneyStep, action: JourneyAction): Promise<void> {
    const type = action.type ?? 'click';
    if (type === 'none') return;

    const selector = action.target ?? step.target;
    if (!selector) {
      this.note(`Step '${step.id}' has an action with nothing to perform it on.`);
      return;
    }

    const element = await this.find(root, selector);
    if (!element) {
      this.note(`Step '${step.id}': nothing on the screen matched '${selector}'.`);
      return;
    }

    switch (type) {
      case 'click':
        (element as HTMLElement).click();
        break;

      // The value is set and then announced. Setting it alone changes what the
      // field shows and nothing else: the app hears about a field through the
      // event, so without one the screen and the app disagree from here on.
      case 'type': {
        const field = element as HTMLInputElement | HTMLTextAreaElement;
        field.value = action.value ?? '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }

      case 'select': {
        const select = element as HTMLSelectElement;
        select.value = action.value ?? '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }

  /**
   * Waits for a selector, because a screen arrives when it arrives.
   *
   * Polling rather than a mutation observer: what is being waited for is not a
   * mutation but a state, and a state can already be true when the wait starts.
   */
  private async find(root: HTMLElement, selector: string | undefined): Promise<Element | null> {
    if (!selector) return null;

    const deadline = Date.now() + WAIT_MS;
    for (;;) {
      let found: Element | null = null;
      try {
        found = root.querySelector(selector);
      } catch {
        this.note(`'${selector}' is not a selector this browser understands.`);
        return null;
      }

      if (found) return found;
      if (Date.now() > deadline) return null;
      await this.settle(POLL_MS);
    }
  }

  /**
   * The picture: the element as it stands, with everything above it that its
   * stylesheets are looking for.
   *
   * A subtree on its own comes out wrong, and wrong in a way that is hard to
   * see at first. Nearly every rule in the legacy stack is a descendant
   * selector: the rail is dark because it is inside .alpha-explorer-toolbar,
   * and lifted out of it, it is a white box. So the chain from the root down
   * to the subject is rebuilt around it, one empty element per ancestor with
   * its classes and its attributes kept. Nothing of the ancestors is drawn --
   * they are neutralised in the stylesheet -- but every selector that reaches
   * through them still matches.
   *
   * Two more things have to be put right on the way out. What a rep has keyed
   * sits in a property and not in an attribute, so a copy of the markup shows
   * an empty field unless the values are written in. And scripts come along
   * with anything cloned, which is no use in a picture.
   *
   * Angular's own scoping attributes are kept, which is what lets component
   * stylesheets draw the frame the same way they drew the screen.
   */
  private snapshot(scope: Element, root: HTMLElement): JourneyFrame {
    const subject = scope.cloneNode(true) as HTMLElement;

    const live = scope.querySelectorAll('input, textarea, select');
    const drawn = subject.querySelectorAll('input, textarea, select');
    live.forEach((field, index) => this.writeValue(field, drawn[index]));

    for (const script of Array.from(subject.querySelectorAll('script'))) {
      script.remove();
    }

    // A ring the shell left on the live screen is not part of the screen. The
    // frame draws its own from the step's selector.
    for (const rung of Array.from(subject.querySelectorAll('.jm-target'))) {
      rung.classList.remove('jm-target');
    }
    subject.classList.remove('jm-target');

    // An absolutely positioned subject has nothing to be positioned against
    // once it is out of the app: whatever held it is a neutralised shell now,
    // so it would fly off to a corner of the frame. It is laid out in flow
    // instead, which is where a picture of it belongs.
    const position = getComputedStyle(scope).position;
    if (position === 'absolute' || position === 'fixed') {
      subject.style.position = 'static';
    }

    // The box the subject had, written onto it. Without this it is laid out
    // again inside the frame against whatever room the frame has, and a screen
    // measured against a different width is a picture of something nobody saw:
    // a full-height rail becomes a stub, and a panel hung off the bottom of it
    // goes with it.
    const host = scope as HTMLElement;
    if (host.offsetWidth) subject.style.width = `${host.offsetWidth}px`;
    if (host.offsetHeight) subject.style.height = `${host.offsetHeight}px`;
    subject.style.boxSizing = 'border-box';

    subject.setAttribute('data-jm-subject', '');

    let outermost: HTMLElement = subject;
    for (let ancestor = scope.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const shell = ancestor.cloneNode(false) as HTMLElement;
      shell.setAttribute('data-jm-shell', '');
      shell.appendChild(outermost);
      outermost = shell;
      if (ancestor === root) break;
    }

    const { width, height } = this.extent(scope);
    return { html: outermost.outerHTML, width, height };
  }

  /**
   * How much room the subject takes, including anything of it that hangs
   * outside its own box.
   *
   * The box on its own is not the answer. The explorer toolbar is fifty pixels
   * wide and its search panel is positioned out to the right of that, so a
   * frame cut to the box would be a sliver of rail and no panel.
   *
   * Measured in layout pixels rather than screen ones. The prototype is drawn
   * inside a scaled box, so what a rect reports is the app after the shell has
   * shrunk it, and the frame wants the size the app believes it is.
   */
  private extent(scope: Element): { width: number; height: number } {
    const rect = scope.getBoundingClientRect();
    const laid = (scope as HTMLElement).offsetWidth;
    const zoom = laid > 0 ? rect.width / laid : 1;
    const scale = zoom > 0 ? zoom : 1;

    let right = rect.right;
    let bottom = rect.bottom;

    for (const child of Array.from(scope.querySelectorAll('*'))) {
      const box = child.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      if (box.right > right) right = box.right;
      if (box.bottom > bottom) bottom = box.bottom;
    }

    return {
      width: Math.min(MAX_FRAME_PX, Math.ceil((right - rect.left) / scale)),
      height: Math.min(MAX_FRAME_PX, Math.ceil((bottom - rect.top) / scale)),
    };
  }

  /**
   * What a rep keyed, chose or ticked, written into the copy as an attribute.
   *
   * A property is not an attribute. The markup of a filled-in form is the
   * markup of an empty one, and a frame taken without this shows a rep about
   * to press Search on a field with nothing in it.
   */
  private writeValue(live: Element, drawn: Element | undefined): void {
    if (!drawn) return;

    if (live instanceof HTMLInputElement) {
      if (live.type === 'checkbox' || live.type === 'radio') {
        if (live.checked) drawn.setAttribute('checked', '');
        else drawn.removeAttribute('checked');
        return;
      }
      drawn.setAttribute('value', live.value);
      return;
    }

    if (live instanceof HTMLTextAreaElement) {
      drawn.textContent = live.value;
      return;
    }

    if (live instanceof HTMLSelectElement && drawn instanceof HTMLSelectElement) {
      for (const option of Array.from(drawn.options)) {
        if (option.value === live.value) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      }
    }
  }

  private note(problem: string): void {
    console.warn(`Journey capture: ${problem}`);
    this.problems.update((all) => [...all, problem]);
  }

  private settle(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => requestAnimationFrame(() => resolve()), ms);
    });
  }

  private read(journeyId: string, fingerprint: string): StoredRun | undefined {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;

      const stored = JSON.parse(raw) as StoredRun;
      const usable = stored.journeyId === journeyId && stored.fingerprint === fingerprint;
      return usable ? stored : undefined;
    } catch {
      return undefined;
    }
  }

  /** True where the run is safely written down and can be read back. */
  private write(journeyId: string, fingerprint: string, frames: Record<string, JourneyFrame>): boolean {
    const run: StoredRun = { journeyId, fingerprint, capturedAt: Date.now(), frames };
    const raw = JSON.stringify(run);
    if (raw.length > MAX_STORED_CHARS) return false;

    try {
      sessionStorage.setItem(STORAGE_KEY, raw);
      return sessionStorage.getItem(STORAGE_KEY) === raw;
    } catch {
      return false;
    }
  }
}
