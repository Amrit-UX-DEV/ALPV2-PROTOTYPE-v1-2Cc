import { Injectable, computed, signal } from '@angular/core';

import { Journey, JourneyAction, JourneyFocus, JourneyFrame, JourneyLook, JourneyStep } from './journey.model';

/** Names the run this tab is holding. The run itself is far too big for here. */
const TOKEN_KEY = 'jm.run';

const DB_NAME = 'journey-mapper';
const DB_STORE = 'runs';

/** How long to wait for a selector to turn up before giving up on it. */
const WAIT_MS = 3000;
const POLL_MS = 50;

/** How long to let the app answer an action before the next one. */
const SETTLE_MS = 300;

/** Marks the element the collected stylesheets are put back in. */
const STYLE_MARK = 'data-jm-frame-styles';

/** Carries a scroll position across, since markup cannot. */
const SCROLL_MARK = 'data-jm-scroll';

/** How far a frame may stand from the screen it came from before it is wrong. */
const HEIGHT_SLACK = 0.15;
const HEIGHT_SLACK_PX = 48;

export type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'failed';

interface StoredRun {
  capturedAt: number;
  frames: Record<string, JourneyFrame>;
  /** The component stylesheets the frames need. See collectStyles. */
  styles: string[];
}

/**
 * Takes the pictures.
 *
 * The pass drives the running prototype through the journey. For each step it
 * photographs the whole app as it stands, then does what the step says to do
 * and waits for the app to answer, and photographs the next one.
 *
 * Every frame is of the whole app, and the same root every time. A frame cut
 * down to the panel a step is about looks tidier and is a lie: half the app is
 * positioned against something outside any one panel -- the dock is fixed, the
 * search panel hangs off the toolbar, dialogs cover the lot -- and a cropped
 * clone loses whatever it was positioned against. What the step is about is
 * said with a mask instead, drawn over the frame rather than cut out of it, so
 * the rest of the screen stays where it was and stays legible.
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
 * hand back to a reviewer. So a finished run is kept and the page is reloaded:
 * the app comes back at its beginning, and the frames are read back rather than
 * taken again.
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
   * Reuses this tab's run if it is of this journey, and takes a new one if not.
   *
   * Called once the prototype has rendered, since there is nothing to
   * photograph before that.
   */
  async start(journey: Journey, root: HTMLElement): Promise<void> {
    if (this.running) return;

    const token = `${journey.id}|${journey.steps.map((step) => step.id).join('|')}`;

    // The token is what makes a run belong to this tab and this journey. The
    // run outlives the tab in the browser's own store, and reading somebody
    // else's, or one taken of a journey since rewritten, would be worse than
    // taking it again.
    if (this.claimed(token)) {
      const stored = await this.readRun(token);
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
    }

    await this.run(journey, root, token);
  }

  /**
   * Throws away what was captured and takes it again from a fresh start.
   *
   * The reload is not incidental: a journey has to be walked from the
   * beginning, and the prototype is wherever the reviewer left it.
   */
  recapture(): void {
    this.claim('');
    location.reload();
  }

  private async run(journey: Journey, root: HTMLElement, token: string): Promise<void> {
    this.running = true;
    this.state.set('capturing');
    this.total.set(journey.steps.length);
    this.done.set(0);
    this.problems.set([]);

    const frames: Record<string, JourneyFrame> = {};

    try {
      for (const [index, step] of journey.steps.entries()) {
        this.done.set(index);

        frames[step.id] = this.snapshot(root, step);
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

    // Only reload where the run is safely written down. Reloading without it
    // would take the whole pass again on the next boot, and again after that.
    const kept = await this.writeRun(token, { capturedAt: Date.now(), frames, styles });
    if (kept) {
      this.claim(token);
      location.reload();
      return;
    }

    this.note(
      'The frames could not be stored, so the prototype has been left at the end ' +
        'of the journey. Reload the page to put it back at the beginning.',
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
   * The picture: the whole app as it stands, deep cloned and written out.
   *
   * Three things have to be carried across by hand, because none of them live
   * in markup. What a rep has keyed sits in a property. Where a panel has been
   * scrolled to sits in a property too. And where the step's subject is on the
   * screen has to be worked out here, while there is a screen to measure: a
   * frame is a string by the time anybody looks at it.
   *
   * Angular's own scoping attributes are kept, which is what lets component
   * stylesheets draw the frame the same way they drew the screen.
   */
  private snapshot(root: HTMLElement, step: JourneyStep): JourneyFrame {
    const copy = root.cloneNode(true) as HTMLElement;

    const live = root.querySelectorAll('*');
    const drawn = copy.querySelectorAll('*');
    live.forEach((element, index) => this.carryOver(element, drawn[index]));
    this.carryScroll(root, copy);

    for (const script of Array.from(copy.querySelectorAll('script'))) {
      script.remove();
    }

    // A ring the shell left on the live screen is not part of the screen. The
    // frame says what it is about with its mask instead.
    for (const rung of Array.from(copy.querySelectorAll('.jm-target'))) {
      rung.classList.remove('jm-target');
    }

    copy.setAttribute('data-jm-subject', '');

    const width = root.offsetWidth;
    const height = root.offsetHeight;

    return {
      html: copy.outerHTML,
      width,
      height,
      focus: this.focus(root, step.target, width, height),
      // The look is measured off the content rather than off the box the
      // shell put it in, since the box is the same size whether the app's
      // stylesheets are on the page or not.
      look: this.look(root, root.scrollHeight),
    };
  }

  /**
   * Where on the frame the step's subject was, in the app's own pixels.
   *
   * The prototype is drawn inside a scaled box, so what a rect reports is the
   * app after the shell has shrunk it. The frame is laid out at the app's own
   * size, so the mask has to be measured at the app's own size too.
   */
  private focus(
    root: HTMLElement,
    target: string | undefined,
    width: number,
    height: number,
  ): JourneyFocus | undefined {
    if (!target) return undefined;

    let element: Element | null = null;
    try {
      element = root.querySelector(target);
    } catch {
      this.note(`'${target}' is not a selector this browser understands.`);
      return undefined;
    }
    if (!element) return undefined;

    const box = element.getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    const scale = root.offsetWidth > 0 ? frame.width / root.offsetWidth : 1;
    const zoom = scale > 0 ? scale : 1;

    const x = Math.round((box.left - frame.left) / zoom);
    const y = Math.round((box.top - frame.top) / zoom);
    const w = Math.round(box.width / zoom);
    const h = Math.round(box.height / zoom);

    // Clamped, because something half off the screen is still worth pointing
    // at and a mask hanging over the edge of the frame is not.
    const left = Math.max(0, Math.min(x, width));
    const top = Math.max(0, Math.min(y, height));

    return {
      x: left,
      y: top,
      width: Math.max(0, Math.min(w, width - left)),
      height: Math.max(0, Math.min(h, height - top)),
    };
  }

  /**
   * Every stylesheet on the page right now, added to the run's collection.
   *
   * Called after each frame is taken, which is the only moment the rules for
   * that screen are certain to be there. A set, because the same stylesheet is
   * on the page for most of the run and only needs keeping once.
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

        // Laid out at the width it was photographed at and left to find its own
        // height, which is the measurement being checked. A component host is
        // an inline element until something says otherwise, and in the app the
        // shell says so.
        subject.style.display = 'block';
        subject.style.width = '100%';

        const differences = this.compare(frame.look, this.look(subject, subject.scrollHeight));
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

    // A frame reflows a little against the screen it was taken of, so the
    // tolerance is generous. What it is looking for is the frame that came out
    // at three times the height of the app, which is what a screen with none of
    // its stylesheets looks like: nothing hidden, nothing laid out, everything
    // stacked one under the next.
    const slack = Math.max(HEIGHT_SLACK_PX, screen.height * HEIGHT_SLACK);
    if (Math.abs(frame.height - screen.height) > slack) {
      differences.push(`${frame.height}px tall against ${screen.height}px`);
    }

    return differences;
  }

  /**
   * What a rep keyed, chose or ticked, and how far a panel is scrolled.
   *
   * A property is not an attribute. The markup of a filled-in form is the
   * markup of an empty one, and a frame taken without this shows a rep about
   * to press Search on a field with nothing in it.
   */
  private carryOver(live: Element, drawn: Element | undefined): void {
    if (!drawn) return;

    this.carryScroll(live, drawn);

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

  /** Left as an attribute for the frame to apply once it is in the page. */
  private carryScroll(live: Element, drawn: Element): void {
    if (!live.scrollTop && !live.scrollLeft) return;
    drawn.setAttribute(SCROLL_MARK, `${Math.round(live.scrollTop)},${Math.round(live.scrollLeft)}`);
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

  /* ── Where a run is kept ──────────────────────────────────────────
     Full-app frames run to megabytes, which is more than a session store
     will hold, so the run goes in the browser's database and the session
     holds only the name of it. That keeps a run tied to the tab that took
     it, which is what stops one build's frames turning up in another's. */

  private claimed(token: string): boolean {
    try {
      return sessionStorage.getItem(TOKEN_KEY) === token;
    } catch {
      return false;
    }
  }

  private claim(token: string): void {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* A store that cannot be written to cannot be holding a stale run. */
    }
  }

  private openDatabase(): Promise<IDBDatabase | undefined> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
        request.onblocked = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  private async readRun(token: string): Promise<StoredRun | undefined> {
    const database = await this.openDatabase();
    if (!database) return undefined;

    try {
      return await new Promise<StoredRun | undefined>((resolve) => {
        const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(token);
        request.onsuccess = () => resolve(request.result as StoredRun | undefined);
        request.onerror = () => resolve(undefined);
      });
    } finally {
      database.close();
    }
  }

  /** True where the run is written down and can be read back. */
  private async writeRun(token: string, run: StoredRun): Promise<boolean> {
    const database = await this.openDatabase();
    if (!database) return false;

    try {
      return await new Promise<boolean>((resolve) => {
        const transaction = database.transaction(DB_STORE, 'readwrite');
        const store = transaction.objectStore(DB_STORE);

        // One run at a time. Nothing here is worth keeping once it has been
        // replaced, and a database quietly filling with old journeys is a bill
        // somebody pays later.
        store.clear();
        store.put(run, token);

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      });
    } catch {
      return false;
    } finally {
      database.close();
    }
  }
}
