import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';

import { TransferCallPopoverComponent } from '../components/transfer-call-popover/transfer-call-popover.component';
import { CallTransferService } from '../call-transfer.service';

/**
 * Step 3 of the call centre journey: confirm and update contact information.
 *
 * The stored and updated detail panels are switched by toggleCurrentlyStored()
 * and toggleUpdateCurrentlyStored() in prototype-interactions.js.
 *
 * This is one of the two steps that can transfer the call. The transfer itself
 * belongs to the service, because the tile for it appears back in step 1.
 */
@Component({
  selector: 'li[alpha-contact-info-step]',
  standalone: true,
  imports: [TransferCallPopoverComponent],
  templateUrl: './contact-info-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ContactInfoStepComponent {
  private readonly transfers = inject(CallTransferService);

  protected readonly showTransferPopover = signal(false);

  protected onTransferCall(data: { reason: string; notes: string }): void {
    this.transfers.transfer(data.reason, data.notes);
    this.showTransferPopover.set(false);
  }
}
