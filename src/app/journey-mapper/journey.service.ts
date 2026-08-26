import { Injectable, computed, signal } from '@angular/core';

import { Journey, JourneyIndex, JourneyStep, JourneyView } from './journey.model';

/** Where journeys live. Adding one means adding a file here and an index entry. */
export const JOURNEY_DATA_PATH = 'assets/data/journeys';

/**
 * Which journey is loaded, which step of it is current, and which of the two
 * views the shell is showing.
 *
 * Held in one root service because three things have to agree: the bar draws
 * the step counter and the view switch, the map draws the step and its clone,
 * and the prototype view rings whatever the step points at. A step is a place
 * in a journey rather than a piece of either view's state.
 *
 * The step survives switching views. Reading step seven on the map and
 * switching to the prototype should land on step seven of the prototype, not
 * at the beginning: the two views are two ways of looking at the same place.
 */
@Injectable({ providedIn: 'root' })
export class JourneyService {
  private readonly loaded = signal<Journey | undefined>(undefined);

  /** The journey being walked, absent until its file has been read. */
  readonly journey = this.loaded.asReadonly();

  readonly steps = computed<JourneyStep[]>(() => this.loaded()?.steps ?? []);

  readonly stepCount = computed(() => this.steps().length);

  private readonly cursor = signal(0);

  /**
   * Which step is current, clamped to what the journey actually holds.
   *
   * Clamped rather than guarded at every caller: the cursor is moved by a bar,
   * a list and two arrow keys, and the journey under all of them can be
   * replaced by loading another one.
   */
  readonly stepIndex = computed(() => {
    const count = this.stepCount();
    if (count === 0) return 0;
    return Math.min(Math.max(this.cursor(), 0), count - 1);
  });

  readonly step = computed<JourneyStep | undefined>(() => this.steps()[this.stepIndex()]);

  /** Where the step sits, for a bar that says 'Step 3 of 14'. */
  readonly stepNumber = computed(() => (this.stepCount() ? this.stepIndex() + 1 : 0));

  readonly hasPrevious = computed(() => this.stepIndex() > 0);
  readonly hasNext = computed(() => this.stepIndex() < this.stepCount() - 1);

  private readonly currentView = signal<JourneyView>('prototype');

  /**
   * The shell opens on the prototype. The map is the thing being reviewed
   * alongside it, and opening on it would put a description of the app in
   * front of the app.
   */
  readonly view = this.currentView.asReadonly();

  constructor() {
    void this.load();
  }

  showView(view: JourneyView): void {
    this.currentView.set(view);
  }

  goTo(index: number): void {
    this.cursor.set(index);
  }

  next(): void {
    if (this.hasNext()) this.cursor.set(this.stepIndex() + 1);
  }

  previous(): void {
    if (this.hasPrevious()) this.cursor.set(this.stepIndex() - 1);
  }

  /**
   * Reads the index and the journey it points at.
   *
   * A failure leaves the shell with no journey rather than half of one, which
   * the bar and the map both read as nothing to walk. The prototype is
   * unaffected either way: the shell is a frame around it, and a frame that
   * cannot read its own data has no business taking the app down with it.
   */
  private async load(): Promise<void> {
    try {
      const index = await this.read<JourneyIndex>('index.json');
      const wanted = index.default
        ? index.journeys.find((entry) => entry.id === index.default)
        : index.journeys[0];
      if (!wanted) throw new Error('the journey index lists no journeys');

      const journey = await this.read<Journey>(wanted.file);
      this.loaded.set(journey);
      this.cursor.set(0);
    } catch (err) {
      console.error('Failed to load the journey:', err);
      this.loaded.set(undefined);
    }
  }

  private async read<T>(file: string): Promise<T> {
    return JSON.parse(await this.readText(file)) as T;
  }

  private async readText(file: string): Promise<string> {
    const response = await fetch(`${JOURNEY_DATA_PATH}/${file}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} reading ${file}`);
    return await response.text();
  }
}
