import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';

/**
 * A photograph of part of the prototype, drawn but not working.
 *
 * The markup came off the running app, so it is in the app's own classes and
 * carries Angular's own scoping attributes, and the page already holds every
 * stylesheet. A clone is therefore drawn by exactly the rules that drew the
 * thing it is a picture of. Nothing is copied into this component but the
 * markup: no components are created, no services are touched, and no state
 * exists behind it.
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
    <div class="jm-clone">
      <div #surface class="jm-clone__surface" inert></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyCloneComponent {
  /** The captured markup. Empty draws nothing rather than an empty box. */
  readonly html = input.required<string>();

  /**
   * The selector of the thing the step acts on, rung inside the clone.
   *
   * The same selector the live prototype is rung by, so a step cannot point at
   * one thing in the map and another in the app. Where it matches nothing
   * inside the frame, the frame is left unrung rather than ringing something
   * else.
   */
  readonly target = input<string | undefined>(undefined);

  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  constructor() {
    effect(() => {
      const host = this.surface()?.nativeElement;
      if (!host) return;

      host.innerHTML = this.html();
      this.ring(host, this.target());
    });
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

    let found: Element | null = null;
    try {
      found = target ? host.querySelector(target) : null;
    } catch {
      console.error(`Journey clone: '${target}' is not a selector this browser understands.`);
    }

    found?.classList.add('jm-target');
  }
}
