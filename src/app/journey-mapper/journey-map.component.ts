import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';

import { JourneyCaptureService } from './journey-capture.service';
import { JourneyCloneComponent } from './journey-clone.component';
import { JourneyService } from './journey.service';

/**
 * The journey view: the whole path laid out left to right, one frame a step.
 *
 * A journey is a sequence before it is anything else, and a sequence is read as
 * a strip rather than a page at a time. Every frame is a photograph of the
 * whole app as the rep saw it, dimmed everywhere except the thing that step is
 * about, so the shape of the path -- which screens, how many, where it doubles
 * back -- can be taken in without reading a word.
 *
 * Small frames are the point of the strip and useless on their own, so any of
 * them can be opened to fill the view, where the words that go with it are
 * readable too. Opening a frame moves the journey to that step, which keeps the
 * strip, the shell's Previous and Next, and the arrow keys all saying the same
 * thing about where the reviewer is.
 *
 * The words come from the journey file and the pictures come from the capture
 * pass, which is why the two cannot drift: the picture is of the app as it is
 * now, and if the app has moved on it is the picture that changes.
 */
@Component({
  selector: 'journey-map',
  standalone: true,
  imports: [JourneyCloneComponent],
  templateUrl: './journey-map.component.html',
  styleUrl: './journey-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyMapComponent {
  protected readonly journeys = inject(JourneyService);
  protected readonly capture = inject(JourneyCaptureService);

  protected readonly name = computed(() => this.journeys.journey()?.name ?? '');
  protected readonly summary = computed(() => this.journeys.journey()?.summary ?? '');

  /** The time of day the frames were taken. The date is today by definition. */
  protected readonly capturedAt = computed(() => {
    const at = this.capture.capturedAt();
    return at ? new Date(at).toLocaleTimeString() : '';
  });

  /** Whether the current step is being read large rather than in the strip. */
  private readonly open = signal(false);
  protected readonly enlarged = this.open.asReadonly();

  private readonly thumbs = viewChildren<ElementRef<HTMLElement>>('thumb');

  constructor() {
    // The step can change from three places -- the strip, the shell's buttons
    // and the arrow keys -- and only one of them scrolls the strip on its own.
    effect(() => {
      const current = this.thumbs()[this.journeys.stepIndex()]?.nativeElement;
      current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  protected enlarge(index: number): void {
    this.journeys.goTo(index);
    this.open.set(true);
  }

  protected shrink(): void {
    this.open.set(false);
  }

  /** Escape is what everyone tries first, so it is what closes the frame. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
