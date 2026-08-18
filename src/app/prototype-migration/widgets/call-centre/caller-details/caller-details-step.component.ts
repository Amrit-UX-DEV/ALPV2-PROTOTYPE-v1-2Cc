import { Component, ViewChild, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';

import { CallerSelectorComponent } from '../components/caller-selector/caller-selector.component';
import { RecentCallersComponent, RecentCaller } from '../components/recent-callers/recent-callers.component';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { ContextSearchService } from '../../../context/context-search.service';

/**
 * Step 1 of the call centre journey: find the policy, then identify the caller.
 *
 * The selector is an attribute on <li> rather than an element, so the host
 * element stays the <li class="step-container"> the stylesheets expect as a
 * direct child of <ul class="sidebar-vertical-steps">.
 *
 * Nothing about the caller is available until a search has found a policy. That
 * is not only sequencing: under data protection the rep has to establish which
 * policy they are looking at before they can be shown, or ask about, the people
 * attached to it. So the policy tile, the recent callers and the caller
 * selector are all gated on the context having a policy.
 */
@Component({
  selector: 'li[alpha-caller-details-step]',
  standalone: true,
  imports: [CallerSelectorComponent, RecentCallersComponent],
  templateUrl: './caller-details-step.component.html',
  styleUrl: './caller-details-step.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallerDetailsStepComponent {
  /** Read in the template as ctx.policy() and ctx.hasPolicy(). */
  protected readonly ctx = inject(PrototypeContextService);

  /**
   * The search this form drives, shared with the left menu search.
   *
   * The form binds to the service rather than to its own signals, so a search
   * run from the left menu shows here and a search run here shows there.
   */
  protected readonly search = inject(ContextSearchService);

  /** Absent while the caller details section is hidden, so it cannot be asserted. */
  @ViewChild(CallerSelectorComponent) callerSelector?: CallerSelectorComponent;

  /** Whoever the rep picked, for the collapsed step summary. */
  protected readonly selectedCaller = signal<{ name: string; role: string } | null>(null);

  protected onCriteriaChange(event: Event): void {
    this.search.setCriteria((event.target as HTMLSelectElement).value);
  }

  protected onReferenceInput(event: Event): void {
    this.search.setTerm((event.target as HTMLInputElement).value);
  }

  protected async onSearch(event?: Event): Promise<void> {
    event?.preventDefault();
    await this.search.run();

    // A different policy means a different set of people to identify.
    if (this.ctx.hasPolicy()) this.selectedCaller.set(null);
  }

  /** The cross on the policy tile: drops the policy and everything under it. */
  protected clearSearch(): void {
    this.selectedCaller.set(null);
    this.search.clear();
  }

  /**
   * Hands a recent caller to the selector.
   *
   * This used to be a template reference reaching across the template, which
   * only worked while both elements always existed. Now that each is inside its
   * own conditional block the reference would be out of scope, so the component
   * passes it along instead.
   */
  protected onRecentCallerSelected(caller: RecentCaller): void {
    this.callerSelector?.onRecentCallerSelected(caller);
  }

  protected onCallerSelected(caller: { name: string; role: string } | null): void {
    this.selectedCaller.set(caller);
  }
}
