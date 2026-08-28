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

import { JourneyFocus } from './journey.model';

/**
 * A photograph of the running prototype, drawn but not working.
 *
 * The markup came off the app itself, so it is in the app's own classes and
 * carries Angular's own scoping attributes, and it is mounted in the same
 * document, which already holds every stylesheet. A frame is therefore drawn by
 * exactly the rules that drew the screen. Nothing is copied into this component
 * but the markup: no components are created, no services are touched, and no
 * state exists behind it.
 *
 * It is laid out at the size the app had on screen and then scaled to fit
 * whatever room it is given, so it is the same screen whether it is a thumbnail
 * in a timeline or blown up to read. Letting it reflow instead would make a
 * thumbnail a picture of a screen nobody ever saw.
 *
 * The scale is always applied, even at full size. A transform makes this the
 * containing block for anything fixed inside it, which is what keeps the app's
 * docked panels and dialogs inside the frame instead of escaping to the corners
 * of the browser window.
 *
 * What the step is about is said with a mask drawn over the frame: the rest of
 * the app dimmed, the subject left bright and ringed. Cutting the subject out
 * of the DOM instead would break everything positioned against something
 * outside it, which in this app is most of the chrome.
 *
 * It is inert, which takes the whole subtree out of pointer events, out of the
 * tab order and out of the accessibility tree in one attribute. A clone that
 * could be half-clicked would be worse than a picture, because it would look
 * like the prototype and then fail to behave like it.
 *
 * The markup is written straight to the element rather than bound through
 * [innerHTML]. It is this app's own output, taken from this app's own DOM and
 * stripped of scripts on the way; it is drawn inside an inert container, and
 * scripts in assigned markup do not run in any case. Going through the
 * sanitizer would strip the very attributes and inline styles that make a frame
 * look like the thing it is a picture of.
 */
@Component({
  selector: 'journey-clone',
  standalone: true,
  template: `
    <div #box class="jm-clone" [style.height.px]="boxHeight() || null">
      <div
        #surface
        class="jm-clone__surface"
        [style.width.px]="width() || null"
        [style.height.px]="height() || null"
        [style.color]="textColor() || null"
        [style.transform]="transform()"
      >
        <div #canvas class="jm-clone__canvas" inert></div>

        @if (focus(); as area) {
          <div class="jm-clone__mask" aria-hidden="true">
            <div class="jm-clone__shade" [style.height.px]="area.y"></div>
            <div
              class="jm-clone__shade"
              [style.top.px]="area.y + area.height"
              [style.bottom.px]="0"
            ></div>
            <div
              class="jm-clone__shade"
              [style.top.px]="area.y"
              [style.height.px]="area.height"
              [style.width.px]="area.x"
            ></div>
            <div
              class="jm-clone__shade"
              [style.top.px]="area.y"
              [style.height.px]="area.height"
              [style.left.px]="area.x + area.width"
              [style.right.px]="0"
            ></div>
            <div
              class="jm-clone__focus"
              [style.top.px]="area.y"
              [style.left.px]="area.x"
              [style.width.px]="area.width"
              [style.height.px]="area.height"
            ></div>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyCloneComponent {
  /** The captured markup. Empty draws nothing rather than an empty box. */
  readonly html = input.required<string>();

  /** The size the app had on screen. The frame is laid out at it. */
  readonly width = input(0);
  readonly height = input(0);

  /** The captured root colour, retained when the source relied on inheritance. */
  readonly textColor = input('');

  /** Where the step's subject was, or nothing on a step that only reads. */
  readonly focus = input<JourneyFocus | undefined>(undefined);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  private readonly destroyRef = inject(DestroyRef);

  private readonly fit = signal(1);

  protected readonly transform = computed(() => `scale(${this.fit().toFixed(4)})`);

  /**
   * A scaled element still takes up its full size in the layout around it, so
   * the box it sits in is told what the picture actually comes to.
   */
  protected readonly boxHeight = computed(() => Math.round(this.height() * this.fit()));

  constructor() {
    effect(() => {
      const host = this.canvas()?.nativeElement;
      if (!host) return;

      host.innerHTML = this.html();
      this.restoreScroll(host);
      this.measure();
    });

    afterNextRender(() => this.watch());
  }

  /** The room a frame has changes with the window, and with what it is in. */
  private watch(): void {
    const box = this.box()?.nativeElement;
    if (!box || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => this.measure());
    observer.observe(box);
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
  }

  /**
   * Puts scrolled panels back where they were.
   *
   * How far something is scrolled is a property, not an attribute, so it does
   * not survive being written out as markup. The pass leaves the numbers on the
   * elements that had them and they are read back here, which matters more than
   * it sounds: a list scrolled to the row a rep was reading is the whole reason
   * that frame is in the journey.
   */
  private restoreScroll(host: HTMLElement): void {
    for (const element of Array.from(host.querySelectorAll('[data-jm-scroll]'))) {
      const [top, left] = (element.getAttribute('data-jm-scroll') ?? '').split(',');
      element.scrollTop = Number(top) || 0;
      element.scrollLeft = Number(left) || 0;
    }
  }
}
