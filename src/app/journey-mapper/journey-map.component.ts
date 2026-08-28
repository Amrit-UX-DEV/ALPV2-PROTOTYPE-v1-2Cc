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

type JourneyLayout = 'stack' | 'grid';

/**
 * The journey view: a film strip beside the selected full-size frame.
 *
 * A journey is a sequence before it is anything else, and a sequence is read as
 * a strip rather than a page at a time. Every frame is a photograph of the
 * whole app as the rep saw it, dimmed everywhere except the thing that step is
 * about, so the shape of the path -- which screens, how many, where it doubles
 * back -- can be taken in without reading a word.
 *
 * The strip keeps the whole path visible while the selected frame and its
 * description stay readable. That frame can be expanded within the map when it
 * needs the whole screen. Selecting one keeps the strip, shell navigation and
 * arrow keys all saying the same thing about where the reviewer is.
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

  private readonly currentLayout = signal<JourneyLayout>('stack');
  protected readonly layout = this.currentLayout.asReadonly();

  private readonly thumbs = viewChildren<ElementRef<HTMLElement>>('thumb');

  constructor() {
    // The step can change from three places -- the strip, the shell's buttons
    // and the arrow keys -- and only one of them scrolls the strip on its own.
    effect(() => {
      const current = this.thumbs()[this.journeys.stepIndex()]?.nativeElement;
      current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  protected select(index: number): void {
    this.journeys.goTo(index);
  }

  protected enlarge(): void {
    this.open.set(true);
  }

  protected shrink(): void {
    this.open.set(false);
  }

  protected showLayout(layout: JourneyLayout): void {
    this.currentLayout.set(layout);
  }

  /** Escape is what everyone tries first, so it is what closes the frame. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
