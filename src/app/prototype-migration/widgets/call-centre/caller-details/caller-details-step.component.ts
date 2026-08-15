import { Component, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { CallerSelectorComponent } from '../components/caller-selector/caller-selector.component';
import { RecentCallersComponent } from '../components/recent-callers/recent-callers.component';
import { TransferCallPopoverComponent } from '../components/transfer-call-popover/transfer-call-popover.component';

/**
 * Step 1 of the call centre journey: identify the caller.
 *
 * The selector is an attribute on <li> rather than an element, so the host
 * element stays the <li class="step-container"> the stylesheets expect as a
 * direct child of <ul class="sidebar-vertical-steps">.
 */
@Component({
  selector: 'li[alpha-caller-details-step]',
  standalone: true,
  imports: [CallerSelectorComponent, RecentCallersComponent, TransferCallPopoverComponent],
  templateUrl: './caller-details-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallerDetailsStepComponent {
  @ViewChild(RecentCallersComponent) recentCallersComponent!: RecentCallersComponent;

  showTransferPopover = false;

  handleTransferCall(data: { reason: string; notes: string }) {
    if (this.recentCallersComponent) {
      this.recentCallersComponent.transferCallWithReason(data.reason, data.notes);
    } else {
      console.warn('RecentCallersComponent not found');
    }
  }
}
