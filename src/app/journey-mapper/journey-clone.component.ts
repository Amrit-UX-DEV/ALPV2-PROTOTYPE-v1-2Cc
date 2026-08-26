import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A photograph of part of the prototype, drawn but not working.
 *
 * The markup came off the running app, so it is in the app's own classes, it
 * carries Angular's own scoping attributes, and it brings the chain of
 * ancestors its stylesheets look for. It is put in the same document as the
 * app, which already holds every stylesheet, so the frame is drawn by exactly
 * the rules that drew the thing it is a picture of. Nothing is copied into this
 * component but the markup: no components are created, no services are touched,
 * and no state exists behind it.
 *
 * It is laid out at the width the subject had on screen and then scaled down to
 * fit the frame. Letting it reflow into whatever room the map has would be a
 * picture of a screen nobody was looking at: a three-column comparison folded
 * into one column says the layout is wrong when it is only narrow.
 *
 * It is inert, which takes the whole subtree out of pointer events, out of the
 * tab order and out of the accessibility tree in one attribute. A clone that
 * could be half-clicked would be worse than a picture, because it would look
 * like the prototype and then fail to behave like it.
 *
 * The markup is written straight to the element rather than bound through
 * [innerHTML]. It is this app's own output, taken from this app's own DOM a
 * moment ago and stripped of scripts on the way; it is drawn inside an inert
 * container, and scripts in assigned markup do not run in any case. Going
 * through the sanitizer would strip the very attributes and inline styles that
 * make a clone look like the thing it is a picture of.
 */
@Component({
  selector: 'journey-clone',
  standalone: true,
  template: `
    <div #box class="jm-clone" [style.height.px]="boxHeight() || null">
      <div
        #surface
        class="jm-clone__surface"
        inert
        [style.width.px]="width() || null"
        [style.transform]="transform()"
      ></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyCloneComponent {
  /** The captured markup. Empty draws nothing rather than an empty box. */
  readonly html = input.required<string>();

  /** The width the picture came to on screen. 0 lets the frame decide. */
  readonly width = input(0);

  /**
   * The height it came to, which is not always the subject's own: a panel
   * positioned outside its parent's box is still part of the picture.
   */
  readonly height = input(0);

  /**
   * The selector of the thing the step acts on, rung inside the clone.
   *
   * The same selector the live prototype is rung by, so a step cannot point at
   * one thing in the map and another in the app. Where it matches nothing
   * inside the frame, the frame is left unrung rather than ringing something
   * else.
   */
  readonly target = input<string | undefined>(undefined);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  private readonly destroyRef = inject(DestroyRef);

  private readonly fit = signal(1);
  private readonly drawnHeight = signal(0);

  protected readonly transform = computed(() => {
    const fit = this.fit();
    return fit < 1 ? `scale(${fit.toFixed(4)})` : null;
  });

  /**
   * A scaled element still takes up its full size in the layout around it, so
   * the box it sits in is told what the picture actually comes to.
   */
  protected readonly boxHeight = computed(() =>
    Math.round(Math.max(this.drawnHeight(), this.height()) * this.fit()),
  );

  constructor() {
    effect(() => {
      const host = this.surface()?.nativeElement;
      if (!host) return;

      host.innerHTML = this.html();
      this.ring(host, this.target());
      this.measure();
    });

    afterNextRender(() => this.watch());
  }

  /**
   * Both boxes are watched: the outer one because the room a frame has changes
   * with the window, and the inner one because a picture's own height is not
   * known until it has been drawn.
   */
  private watch(): void {
    const box = this.box()?.nativeElement;
    const surface = this.surface()?.nativeElement;
    if (!box || !surface || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => this.measure());
    observer.observe(box);
    observer.observe(surface);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private measure(): void {
    const box = this.box()?.nativeElement;
    const surface = this.surface()?.nativeElement;
    if (!box || !surface) return;

    const room = box.clientWidth;
    const natural = this.width() || surface.scrollWidth;
    const fit = room > 0 && natural > 0 ? Math.min(1, room / natural) : 1;

    // Ignoring a hair's difference is what keeps this from oscillating. The
    // frame's height follows the scale, a taller frame can bring a scrollbar,
    // and a scrollbar takes width back off the scale it came from.
    if (Math.abs(fit - this.fit()) > 0.005) this.fit.set(fit);
    this.drawnHeight.set(surface.offsetHeight);
  }

  /**
   * An authored selector is data, and data can be wrong: a selector that does
   * not parse throws where it is used rather than where it was written, so it
   * is caught and reported instead of taking the frame down.
   */
  private ring(host: HTMLElement, target: string | undefined): void {
    for (const rung of Array.from(host.querySelectorAll('.jm-target'))) {
      rung.classList.remove('jm-target');
    }
    if (!target) return;

    try {
      host.querySelector(target)?.classList.add('jm-target');
    } catch {
      console.error(`Journey clone: '${target}' is not a selector this browser understands.`);
    }
  }
}
