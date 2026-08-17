import { Component, ViewChild, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';

import { CallerSelectorComponent } from '../components/caller-selector/caller-selector.component';
import { RecentCallersComponent, RecentCaller } from '../components/recent-callers/recent-callers.component';
import { TransferCallPopoverComponent } from '../components/transfer-call-popover/transfer-call-popover.component';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { AppViewService } from '../../../ui/app-view.service';

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
  imports: [CallerSelectorComponent, RecentCallersComponent, TransferCallPopoverComponent],
  templateUrl: './caller-details-step.component.html',
  styleUrl: './caller-details-step.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallerDetailsStepComponent {
  /** Read in the template as ctx.policy() and ctx.hasPolicy(). */
  protected readonly ctx = inject(PrototypeContextService);

  private readonly views = inject(AppViewService);

  /**
   * Both are absent while the caller details section is hidden, so neither can
   * be asserted as always present.
   */
  @ViewChild(RecentCallersComponent) recentCallersComponent?: RecentCallersComponent;
  @ViewChild(CallerSelectorComponent) callerSelector?: CallerSelectorComponent;

  showTransferPopover = false;

  /** Matches the Search Criteria dropdown, which opens on Policy. */
  protected readonly searchCriteria = signal('Policy');

  /** Empty until the rep keys something in. */
  protected readonly referenceNumber = signal('');

  protected readonly searching = signal(false);

  /** Set only after a search that matched nothing, so the form starts silent. */
  protected readonly notFound = signal(false);

  /** What was keyed for the search that failed, for the message. */
  protected readonly notFoundTerm = signal('');

  /** Whoever the rep picked, for the collapsed step summary. */
  protected readonly selectedCaller = signal<{ name: string; role: string } | null>(null);

  protected onCriteriaChange(event: Event): void {
    this.searchCriteria.set((event.target as HTMLSelectElement).value);
  }

  protected onReferenceInput(event: Event): void {
    this.referenceNumber.set((event.target as HTMLInputElement).value);
    this.notFound.set(false);
  }

  /**
   * Resolves what was keyed against the context registry.
   *
   * A hit becomes the app's context, which is what makes the group summary show
   * the same policy: both read the one context rather than passing a number
   * between them.
   */
  protected async onSearch(event?: Event): Promise<void> {
    event?.preventDefault();

    const term = this.referenceNumber().trim();
    if (!term) return;

    this.searching.set(true);
    const result = await this.ctx.searchAndActivate(this.searchCriteria(), term);
    this.searching.set(false);

    this.notFound.set(result === 'not-found');
    this.notFoundTerm.set(result === 'not-found' ? term : '');

    if (result === 'found') {
      this.selectedCaller.set(null);
      this.views.show('group-summary');
    }
  }

  /** The cross on the policy tile: drops the policy and everything under it. */
  protected clearSearch(): void {
    this.referenceNumber.set('');
    this.notFound.set(false);
    this.notFoundTerm.set('');
    this.selectedCaller.set(null);
    this.ctx.clear();
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

  handleTransferCall(data: { reason: string; notes: string }) {
    if (this.recentCallersComponent) {
      this.recentCallersComponent.transferCallWithReason(data.reason, data.notes);
    } else {
      console.warn('RecentCallersComponent not found');
    }
  }
}
