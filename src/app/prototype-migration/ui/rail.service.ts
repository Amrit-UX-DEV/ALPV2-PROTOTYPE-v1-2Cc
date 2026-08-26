import { Injectable, computed, inject, signal } from '@angular/core';

import { PrototypeContextService } from '../context/prototype-context.service';
import { WorkPlanService } from '../work-plans/work-plan.service';
import { RailConfig, RailItemId } from './rail.model';

/** Where the rail's own switches live. */
export const RAIL_CONFIG_PATH = 'assets/data/navigation/rail.json';

/**
 * Which rail buttons are showing.
 *
 * Two different things decide it, and keeping them apart is the point of this
 * service. What a build offers is a decision someone makes, so it is JSON:
 * develop offers everything, and a release branch turns off what its audience
 * should not be shown. What is reachable right now is not a decision at all,
 * it follows from what has been searched and what work plans that context
 * qualifies for, so it is computed here and cannot drift out of step with the
 * screens.
 *
 * A button leading nowhere is worse than a button that is absent: the rep
 * presses it, gets an empty screen, and learns not to trust the rail. So a
 * button whose destination does not exist yet is not drawn.
 *
 * The rail markup asks for each button by name rather than looping over a list,
 * because it is the legacy markup: every block carries its own classes and its
 * own icon, and a loop would mean holding all of that in data to render
 * something that never varies.
 */
@Injectable({ providedIn: 'root' })
export class RailService {
  private readonly ctx = inject(PrototypeContextService);
  private readonly workPlans = inject(WorkPlanService);

  private readonly config = signal<RailConfig | undefined>(undefined);

  readonly home = computed(() => this.offered('home'));

  readonly search = computed(() => this.offered('search'));

  /**
   * The group summary needs something to summarise. In no context there is
   * nothing behind the button, and the screen it would open is the same empty
   * screen the app already opens on.
   */
  readonly groupSummary = computed(
    () => this.offered('group-summary') && this.ctx.hasGroupSummary(),
  );

  readonly enquiry = computed(() => this.offered('enquiry'));

  /**
   * Business processes needs a work plan that can actually be run: one that
   * needs no context, or one whose context is in play.
   */
  readonly businessProcesses = computed(
    () => this.offered('business-processes') && this.workPlans.eligible().length > 0,
  );

  constructor() {
    void this.load();
  }

  /**
   * Whether the build offers a button, defaulting to yes.
   *
   * An unreadable config leaves the rail as it was rather than empty: a
   * prototype with no navigation cannot be demonstrated at all, and a button
   * that should have been turned off is a visible mistake rather than a silent
   * one.
   */
  private offered(id: RailItemId): boolean {
    return this.config()?.items[id]?.show ?? true;
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch(`${RAIL_CONFIG_PATH}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.config.set((await response.json()) as RailConfig);
    } catch (err) {
      console.error('Failed to load the rail config:', err);
      this.config.set(undefined);
    }
  }
}
