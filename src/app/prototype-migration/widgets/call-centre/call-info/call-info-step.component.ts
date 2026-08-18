import { Component, inject, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CallInformationOptionsComponent } from '../components/call-information-options/call-information-options.component';
import { CallActionOptionsComponent } from '../components/call-action-options/call-action-options.component';
import { CallPensionOptionsComponent } from '../components/call-pension-options/call-pension-options.component';
import { TransferCallPopoverComponent } from '../components/transfer-call-popover/transfer-call-popover.component';
import { CallTransferService } from '../call-transfer.service';
import { PrototypeContextService } from '../../../context/prototype-context.service';

/**
 * Step 4 of the call centre journey: log the call information.
 *
 * Three overlay panels hang off this step, each revealed by the prototype's
 * jQuery adding a show-* class to .call-info-action-container.
 *
 * `showDetails` lives here rather than in the action options panel because two
 * places read it: the summary tiles in this template, and the panel. The panel
 * holds the button, so it reports the click back up.
 *
 * This is one of the two steps that can transfer the call. The transfer itself
 * belongs to the service, because the tile for it appears back in step 1.
 */
@Component({
  selector: 'li[alpha-call-info-step]',
  standalone: true,
  imports: [
    CommonModule,
    CallInformationOptionsComponent,
    CallActionOptionsComponent,
    CallPensionOptionsComponent,
    TransferCallPopoverComponent,
  ],
  templateUrl: './call-info-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallInfoStepComponent {
  /** The policy the call is about, read in the template as ctx.policy(). */
  protected readonly ctx = inject(PrototypeContextService);

  showDetails = false;

  private readonly transfers = inject(CallTransferService);

  protected readonly showTransferPopover = signal(false);

  protected onTransferCall(data: { reason: string; notes: string }): void {
    this.transfers.transfer(data.reason, data.notes);
    this.showTransferPopover.set(false);
  }
}
