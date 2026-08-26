import { Injectable, computed, inject, signal } from '@angular/core';

import { AppViewService } from '../ui/app-view.service';
import { WorkPlan, WorkPlanIndex } from './work-plan.model';

/** Where the list of business processes lives. */
export const WORK_PLAN_INDEX_PATH = 'assets/data/work-plans/index.json';

/**
 * Which business processes there are, and which one is open.
 *
 * The rail used to go straight into script management, because that was the
 * only work plan there was. There are two now, so the rail lands on the hub and
 * a rep chooses; this holds the choice, because three places need it. The hub
 * makes it, the body renders whichever config it names, and the header takes the
 * plan's name for the heading and the breadcrumb.
 *
 * The plans are read from JSON like every other list in the prototype. Adding a
 * third is a wizard config and an entry beside it, with nothing to change here
 * or in the hub.
 */
@Injectable({ providedIn: 'root' })
export class WorkPlanService {
  private readonly views = inject(AppViewService);

  private readonly index = signal<WorkPlanIndex | undefined>(undefined);

  /** What the hub is called, absent until the index has been read. */
  readonly heading = computed(() => this.index()?.heading ?? '');

  readonly plans = computed<WorkPlan[]>(() => this.index()?.plans ?? []);

  private readonly current = signal<WorkPlan | undefined>(undefined);

  /** The plan the rep opened, absent while they are on the hub. */
  readonly plan = this.current.asReadonly();

  /**
   * The config the wizard shell should load. Empty where no plan is open, which
   * the shell reads as nothing to load rather than as a missing file.
   */
  readonly configUrl = computed(() => this.current()?.configUrl ?? '');

  constructor() {
    void this.load();
  }

  /**
   * Opens a plan, which is what puts its name in the header: a business process
   * is not something a rep searched for, so the view has to name itself, and it
   * now names the plan rather than the one process there used to be.
   */
  open(plan: WorkPlan): void {
    this.current.set(plan);
    this.views.showProcess(plan.name);
  }

  /**
   * Leaves the plan, back to the hub.
   *
   * The plan is dropped rather than remembered, so exiting and coming back
   * starts it again. A half-finished wizard held in the background is a promise
   * the prototype cannot keep: nothing here is saved anywhere.
   */
  close(): void {
    this.current.set(undefined);
    this.views.show('work-plans');
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch(`${WORK_PLAN_INDEX_PATH}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.index.set((await response.json()) as WorkPlanIndex);
    } catch (err) {
      console.error('Failed to load the work plan index:', err);
      this.index.set(undefined);
    }
  }
}
