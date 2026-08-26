import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { JourneyCaptureService } from './journey-capture.service';
import { JourneyMapComponent } from './journey-map.component';
import { JourneyService } from './journey.service';

/** How small the prototype is allowed to get before it stops being readable. */
const MIN_SCALE = 0.4;

/**
 * The frame around the prototype: a bar, and the app inset inside it.
 *
 * The shell is the page. Everything the prototype used to have to itself now
 * sits in a box with a border around it, which is the point: a reviewer can see
 * where the app ends, and there is somewhere to put the controls that are about
 * the review rather than about the app.
 *
 * The prototype is not iframed. It is the same document, projected into a
 * scaled box, so nothing about how it is built or bootstrapped changes, a
 * step's selector can ring a real element on the real screen, and the capture
 * pass can reach into it and drive it. A transform is what does the scaling,
 * which also makes the box the containing block for the prototype's own fixed
 * overlays: dialogs land inside the frame rather than over the shell.
 *
 * The scale is measured rather than declared. The box the prototype has to fit
 * in is the window minus the bar and the inset, and the prototype inside it is
 * a full viewport wide and tall, so the ratio between the two is the answer and
 * nothing has to be kept in step with a stylesheet.
 */
@Component({
  selector: 'journey-shell',
  standalone: true,
  imports: [JourneyMapComponent],
  templateUrl: './journey-shell.component.html',
  styleUrl: './journey-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyShellComponent {
  protected readonly journeys = inject(JourneyService);
  protected readonly capture = inject(JourneyCaptureService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');

  private readonly scale = signal(1);
  private readonly rendered = signal(false);
  private started = false;

  /**
   * Centred horizontally first, then scaled about the top of that centre line,
   * so the app hangs from the top of the stage the way a window does rather
   * than floating in the middle of it.
   */
  protected readonly frameTransform = computed(
    () => `translateX(-50%) scale(${this.scale().toFixed(4)})`,
  );

  /** Which step the pass is on, for the line under the title while it runs. */
  protected readonly capturingStep = computed(() => this.journeys.steps()[this.capture.progress()]);

  constructor() {
    afterNextRender(() => {
      this.watchStage();
      this.rendered.set(true);
    });

    // The pass needs two things that arrive separately: a journey, which is
    // fetched, and a rendered prototype to walk. Whichever is last starts it.
    effect(() => {
      const journey = this.journeys.journey();
      const root = this.rendered() ? this.prototypeRoot() : undefined;
      if (!journey || !root || this.started) return;

      this.started = true;
      void this.capture.start(journey, root);
    });

    // The ring follows the step, and only while the prototype is the thing
    // being looked at: the map draws its own ring inside its own frame, and two
    // rings for one step in two places is one ring too many.
    effect(() => {
      // Nothing is rung while the pass runs. The ring is a class on a live
      // element, and a live element with a ring on it is what gets
      // photographed: the frames would come out ringed twice, once by the
      // shell and once by the frame's own selector.
      const settled = this.rendered() && this.capture.status() !== 'capturing';
      const showing = this.journeys.view() === 'prototype';
      this.ring(settled && showing ? this.journeys.step()?.target : undefined);
    });
  }

  /**
   * Left and right move through the journey from anywhere in the shell.
   *
   * Not while the prototype has the keystroke, though: the app underneath has
   * text fields, selects and its own arrow-key behaviour, and a reviewer typing
   * a policy number should not find themselves three steps further on.
   */
  @HostListener('window:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    event.preventDefault();
    if (event.key === 'ArrowLeft') this.journeys.previous();
    else this.journeys.next();
  }

  /**
   * The projected app, which is the only part of the page the shell lets the
   * capture pass and the ring touch.
   *
   * Everything is one document here, so a bare document.querySelector would
   * happily match the shell's own bar: the shell and the app share a design
   * system and therefore share class names.
   */
  private prototypeRoot(): HTMLElement | undefined {
    return (this.frame()?.nativeElement.firstElementChild as HTMLElement | null) ?? undefined;
  }

  /**
   * The stage is watched rather than the window, because what matters is the
   * room the prototype has been given and the bar can change height on its own
   * when its contents wrap.
   */
  private watchStage(): void {
    const host = this.stage()?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => this.measure(host));
    observer.observe(host);
    this.measure(host);

    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private measure(host: HTMLElement): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!width || !height) return;

    const fits = Math.min(host.clientWidth / width, host.clientHeight / height);
    this.scale.set(Math.max(MIN_SCALE, Math.min(1, fits)));
  }

  /**
   * Rings whatever the step points at on the live screen.
   *
   * The element is found rather than remembered: the prototype rebuilds its
   * views as a rep moves through it, so the thing a selector matched a moment
   * ago may not be the thing it matches now.
   */
  private ring(target: string | undefined): void {
    const root = this.prototypeRoot();
    if (!root) return;

    for (const rung of Array.from(root.querySelectorAll('.jm-target'))) {
      rung.classList.remove('jm-target');
    }
    if (!target) return;

    try {
      root.querySelector(target)?.classList.add('jm-target');
    } catch {
      console.error(`Journey step: '${target}' is not a selector this browser understands.`);
    }
  }
}
