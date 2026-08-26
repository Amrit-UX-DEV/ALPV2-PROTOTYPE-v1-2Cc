import { Injectable, computed, signal } from '@angular/core';

import { Journey, JourneyAction, JourneyFrame, JourneyLook, JourneyStep } from './journey.model';

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

/** Marks the element the collected stylesheets are put back in. */
const STYLE_MARK = 'data-jm-frame-styles';

/** How far a frame may stand from the screen it came from before it is wrong. */
const HEIGHT_SLACK = 0.15;
const HEIGHT_SLACK_PX = 48;

/** How far the picture may climb out of wrappers that hold nothing else. */
const WIDEN_LIMIT = 4;

export type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'failed';

interface StoredRun {
  journeyId: string;
  /** The steps the run was taken from, so a rewritten journey is not reused. */
  fingerprint: string;
  capturedAt: number;
  frames: Record<string, JourneyFrame>;
  /** The component stylesheets the frames need. See collectStyles. */
  styles: string[];
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

  /**
   * Every component stylesheet seen while the pass ran.
   *
   * This is the difference between a frame and a wall of unstyled markup.
   * Angular takes a component's styles out of the document when its last
   * instance is destroyed, and the whole point of a journey is that the app
   * moves on: by the time the frames are read, the screen half of them came
   * from is long gone and so are its rules. Worse, the run ends in a reload,
   * and a freshly booted app has never rendered most of what was photographed.
   *
   * So the stylesheets are collected while they are on the page, kept with the
   * run, and put back before a frame is drawn. They are the app's own rules,
   * scoped by the same attributes the frames carry, so putting them back
   * changes nothing for the app itself.
   */
  private readonly styleSheets = new Set<string>();

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
      this.applyStyles(stored.styles);
      this.captured.set(stored.frames);
      this.at.set(stored.capturedAt);
      this.total.set(journey.steps.length);
      this.done.set(journey.steps.length);
      this.state.set('ready');
      void this.verify(stored.frames);
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

        const found = (await this.find(root, step.capture)) ?? root;
        frames[step.id] = this.snapshot(this.widen(found, root), root);
        this.collectStyles();

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
    this.collectStyles();

    const styles = [...this.styleSheets];
    this.applyStyles(styles);
    this.captured.set(frames);
    this.at.set(Date.now());
    this.running = false;

    // Checked against how the screens actually looked before the run is kept.
    // A frame that is not drawn is worth knowing about at the moment it is
    // taken, not the next time somebody opens the map and wonders.
    await this.verify(frames);

    // Only reload where the frames are safely written down. Reloading without
    // them would run the pass again on the next boot, and again after that.
    if (this.write(journey.id, fingerprint, frames, styles)) {
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
   * Climbs out of any wrapper that holds nothing but the subject.
   *
   * A selector usually names the div inside a component rather than the
   * component's own element, and the component's element is where its :host
   * rules land -- often the padding, the background and the height of the very
   * thing being photographed. Left above the subject it becomes a shell and is
   * flattened, and the frame loses all of it.
   *
   * An ancestor with one child adds nothing to the picture but itself, so
   * taking it in cannot bring anything unwanted with it. The climb stops at
   * anything with a second child, at the root, and at a few levels up, which is
   * far enough for a host and its wrapper and not far enough to end up
   * photographing the whole app by accident.
   */
  private widen(scope: Element, root: HTMLElement): Element {
    let subject = scope;

    for (let step = 0; step < WIDEN_LIMIT; step++) {
      const parent = subject.parentElement;
      if (!parent || parent === root || parent.childElementCount !== 1) break;
      subject = parent;
    }

    return subject;
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
    return {
      html: outermost.outerHTML,
      width,
      height,
      look: this.look(scope, host.offsetHeight),
    };
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
   * Every stylesheet on the page right now, added to the run's collection.
   *
   * Called after each frame is taken, which is the only moment the rules for
   * that screen are certain to be there. A set, because the same stylesheet is
   * on the page for most of the run and only needs keeping once.
   *
   * The global stylesheets are gathered along with the component ones. They are
   * link elements in a built app and are not picked up here, but a dev server
   * inlines them, and a stylesheet already on the page costs nothing to have
   * twice.
   */
  private collectStyles(): void {
    for (const sheet of Array.from(document.querySelectorAll('style'))) {
      if (sheet.hasAttribute(STYLE_MARK)) continue;

      const text = sheet.textContent ?? '';
      if (text.trim()) this.styleSheets.add(text);
    }
  }

  /**
   * Puts the collected stylesheets back on the page, in one element.
   *
   * Nothing changes for the app. These are its own rules, scoped by the same
   * attributes they always were, so the only elements they can reach that are
   * not already drawn by them are the frames.
   */
  private applyStyles(styles: string[]): void {
    if (!styles.length) return;

    let tag = document.head.querySelector(`style[${STYLE_MARK}]`);
    if (!tag) {
      tag = document.createElement('style');
      tag.setAttribute(STYLE_MARK, '');
      document.head.appendChild(tag);
    }

    tag.textContent = styles.join('\n');
  }

  /**
   * Draws every frame off-screen and compares it with the screen it came from.
   *
   * The check that matters is height. A frame missing its rules is not subtly
   * wrong; it is unstyled markup at an entirely different height, and no
   * threshold is needed to tell the two apart. The text properties are cheap
   * and catch the narrower case of one stylesheet missing out of several.
   *
   * It is done in the page rather than in the abstract because that is the only
   * place the answer means anything: the same document, the same stylesheets,
   * the same width the frame will be laid out at.
   */
  private async verify(frames: Record<string, JourneyFrame>): Promise<void> {
    await this.settle(0);

    const probe = document.createElement('div');
    probe.setAttribute('inert', '');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:-20000px;visibility:hidden;';

    // Inside the app's own root, since a frame is drawn inside it too and the
    // stack has rules that reach down from there.
    (document.querySelector('app-root') ?? document.body).appendChild(probe);

    try {
      for (const [id, frame] of Object.entries(frames)) {
        probe.style.width = `${frame.width}px`;
        probe.innerHTML = frame.html;

        const subject = probe.querySelector('[data-jm-subject]');
        if (!(subject instanceof HTMLElement)) {
          this.note(`Step '${id}': the frame has nothing in it.`);
          continue;
        }

        const differences = this.compare(frame.look, this.look(subject, subject.offsetHeight));
        if (differences.length) {
          this.note(
            `Step '${id}': the frame is not drawn like the screen it came from ` +
              `(${differences.join('; ')}).`,
          );
        }
      }
    } finally {
      probe.remove();
    }
  }

  private look(element: Element, height: number): JourneyLook {
    const drawn = getComputedStyle(element);
    return {
      color: drawn.color,
      background: drawn.backgroundColor,
      fontFamily: drawn.fontFamily,
      fontSize: drawn.fontSize,
      height,
    };
  }

  private compare(screen: JourneyLook, frame: JourneyLook): string[] {
    const differences: string[] = [];

    if (frame.color !== screen.color) {
      differences.push(`text ${frame.color} against ${screen.color}`);
    }
    if (frame.background !== screen.background) {
      differences.push(`background ${frame.background} against ${screen.background}`);
    }
    if (frame.fontFamily !== screen.fontFamily) differences.push('a different typeface');
    if (frame.fontSize !== screen.fontSize) {
      differences.push(`text at ${frame.fontSize} against ${screen.fontSize}`);
    }

    // A frame reflows a little against a screen it was cut out of, so the
    // tolerance is generous. What it is looking for is the frame that came out
    // a fifth of the height, which is what no stylesheet looks like.
    const slack = Math.max(HEIGHT_SLACK_PX, screen.height * HEIGHT_SLACK);
    if (Math.abs(frame.height - screen.height) > slack) {
      differences.push(`${frame.height}px tall against ${screen.height}px`);
    }

    return differences;
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
  private write(
    journeyId: string,
    fingerprint: string,
    frames: Record<string, JourneyFrame>,
    styles: string[],
  ): boolean {
    const run: StoredRun = { journeyId, fingerprint, capturedAt: Date.now(), frames, styles };
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
