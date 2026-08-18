import { Injectable, signal } from '@angular/core';

/** The views the app body can show. */
export type AppView = 'group-summary' | 'search-summary' | 'work-plan';

/**
 * Which view the app body is showing.
 *
 * The explorer rail is no longer the only thing that changes the view: finding
 * a policy in the call centre has to bring its group summary up, and the widget
 * is nowhere near the shell in the component tree. Holding the view here means
 * neither has to know about the other, and the rail still renders its own
 * active state from the same signal that a search sets.
 */
@Injectable({ providedIn: 'root' })
export class AppViewService {
  /**
   * The app opens on the group summary with nothing searched, which is the
   * screen a rep spends the call on and, empty, is also the screen that tells
   * them to search for something. Where they go next is their decision: a policy
   * number opens its group summary here, a possible match reference opens the
   * comparison, and the rail still reaches the work plan.
   */
  private readonly current = signal<AppView>('group-summary');

  readonly view = this.current.asReadonly();

  show(view: AppView): void {
    this.current.set(view);
  }
}
