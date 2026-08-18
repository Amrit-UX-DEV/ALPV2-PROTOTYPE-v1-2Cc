import { Injectable, computed, signal } from '@angular/core';

/** The views the app body can show. */
export type AppView = 'group-summary' | 'search-summary' | 'work-plan';

/**
 * What the header says while a view is showing something no context describes.
 *
 * The group summary and the possible match summary are views of a context, so
 * the context names them and this stays out of the way. A business process is
 * not: the rep picked it off the rail, there is nothing searched, and the header
 * still has to say where they are.
 */
export interface ViewScreen {
  breadcrumbs: string[];
  /** Text before the screen's own name in the h1, e.g. 'Business Processes:'. */
  headingPrefix: string;
  /** The screen's own name, which follows the prefix. */
  label: string;
}

/**
 * Only the views that name themselves appear here. Once the work plan runs more
 * than one business process, its heading should come from the process it loaded
 * rather than from the view.
 */
const VIEW_SCREENS: Partial<Record<AppView, ViewScreen>> = {
  'work-plan': {
    breadcrumbs: ['Business Processes', 'Script Management'],
    headingPrefix: 'Business Processes:',
    label: 'Script Management',
  },
};

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
   * screen a rep spends the call on and, empty, is the screen that says there is
   * no context yet. Where they go next is their decision: a policy number opens
   * its group summary here, a possible match reference opens the comparison, and
   * the rail reaches the work plan.
   */
  private readonly current = signal<AppView>('group-summary');

  readonly view = this.current.asReadonly();

  /** What the header should say for this view, absent where the context says it. */
  readonly screen = computed<ViewScreen | undefined>(() => VIEW_SCREENS[this.current()]);

  show(view: AppView): void {
    this.current.set(view);
  }
}
