import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { PrototypeContextService } from '../context/prototype-context.service';
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
 *
 * Which of them a rep can reach is two questions. Whether this build offers the
 * plan is a decision, so it is in the index. Whether it can be run right now is
 * not: a plan about a dashboard reference cannot be run without one, so it
 * follows from the context and is worked out here. Everything that offers a way
 * into a plan, the rail and the hub both, reads the same answer.
 */
@Injectable({ providedIn: 'root' })
export class WorkPlanService {
  private readonly views = inject(AppViewService);
  private readonly ctx = inject(PrototypeContextService);

  private readonly index = signal<WorkPlanIndex | undefined>(undefined);

  /** What the hub is called, absent until the index has been read. */
  readonly heading = computed(() => this.index()?.heading ?? '');

  /**
   * Whether the hub is always a screen, or is skipped where there is only one
   * plan to choose. True until the index says otherwise, so a build that cannot
   * read its own index still shows the list rather than guessing what to open.
   */
  readonly alwaysShowHub = computed(() => this.index()?.hub.alwaysShow ?? true);

  /** Every plan this build offers, whether or not it can be run right now. */
  private readonly offered = computed<WorkPlan[]>(() =>
    (this.index()?.plans ?? []).filter((plan) => plan.show),
  );

  /**
   * The plans that can be run as things stand: the ones needing no context, and
   * the ones whose context is the one in play.
   *
   * This is what the hub lists and what the rail counts. A plan offered but not
   * runnable is not shown as unavailable, because a rep cannot do anything
   * about it: what puts it in reach is searching for something, which is a
   * different act on a different part of the screen.
   */
  readonly eligible = computed<WorkPlan[]>(() =>
    this.offered().filter((plan) => this.inContext(plan)),
  );

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

    // A plan runs on the context it was opened in. Losing that context, by
    // searching for something else or clearing the search, leaves the wizard
    // holding a reference that is no longer on screen anywhere, so it closes
    // rather than carrying on against nothing.
    effect(() => {
      const open = this.current();
      if (!open) return;
      if (this.eligible().some((plan) => plan.id === open.id)) return;
      this.close();
    });
  }

  /**
   * Where the rail's business processes button leads.
   *
   * The hub where there is a choice to make, and straight into the plan where
   * there is not and the build has said it does not want the hub. A list of one
   * is a question with a single answer.
   */
  openFromRail(): void {
    const eligible = this.eligible();
    const only = !this.alwaysShowHub() && eligible.length === 1 ? eligible[0] : undefined;
    if (only) {
      this.open(only);
      return;
    }
    this.views.show('work-plans');
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
    // Back to the hub where the hub is a screen this build has, and to the
    // group summary where it is not: a hub the rep was never shown on the way
    // in is not somewhere to leave them on the way out.
    this.views.show(this.alwaysShowHub() || this.eligible().length > 1 ? 'work-plans' : 'group-summary');
  }

  /** Whether a plan's context is the one in play, or it needs none. */
  private inContext(plan: WorkPlan): boolean {
    const needs = plan.requiresContext;
    if (!needs) return true;
    return this.ctx.kind() === needs && this.ctx.reference().length > 0;
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
