import { Injectable, computed, signal } from '@angular/core';

/** The views the app body can show. */
export type AppView = 'group-summary' | 'search-summary' | 'work-plans' | 'work-plan';

/**
 * What the header says while a view is showing something no context describes.
 *
 * The group summary and the dashboard reference summary are views of a context,
 * so the context names them and this stays out of the way. A business process is
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
 * Only the views that name themselves appear here, and only the ones whose name
 * is fixed. The hub is the list of business processes, so it is the one that can
 * be written down; a work plan is named by the plan that was opened, which is
 * something only the plan knows.
 */
const VIEW_SCREENS: Partial<Record<AppView, ViewScreen>> = {
  'work-plans': {
    breadcrumbs: ['Business Processes'],
    headingPrefix: 'Business Processes',
    label: '',
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
   * its group summary here, a dashboard reference opens the comparison, and the
   * rail reaches the business processes.
   */
  private readonly current = signal<AppView>('group-summary');

  readonly view = this.current.asReadonly();

  /**
   * What the header says on the work plan, which is whatever plan was opened.
   *
   * Set by the work plan service rather than listed above, because the plans are
   * data: a third one is an entry in the index, and no view of the app should
   * have to be told about it.
   */
  private readonly process = signal<ViewScreen | undefined>(undefined);

  /** What the header should say for this view, absent where the context says it. */
  readonly screen = computed<ViewScreen | undefined>(() =>
    this.current() === 'work-plan' ? this.process() : VIEW_SCREENS[this.current()],
  );

  show(view: AppView): void {
    this.current.set(view);
  }

  /** Opens the work plan on a named process, which is what the header reads. */
  showProcess(name: string): void {
    this.process.set({
      breadcrumbs: ['Business Processes', name],
      headingPrefix: 'Business Processes:',
      label: name,
    });
    this.current.set('work-plan');
  }
}
