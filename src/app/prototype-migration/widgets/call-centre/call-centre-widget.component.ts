import {
  Component,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CallerSelectorComponent } from '../../app-shell/components/caller-selector/caller-selector.component';
import { CallScriptJourneyComponent } from '../../app-shell/components/call-rep-scripts/journey/call-script-journey.component';
import { RecentCallersComponent } from '../../app-shell/components/recent-callers/recent-callers.component';
import { TransferCallPopoverComponent } from '../../app-shell/components/transfer-call-popover/transfer-call-popover.component';

/**
 * Call centre service app that docks into the app shell's right sidebar.
 *
 * The selector deliberately keeps the legacy `alpha-callcenter-steps-caller-details`
 * tag name: eight rules in the prototype stylesheets target it as an element
 * selector, so renaming it would drop that styling.
 */
@Component({
  selector: 'alpha-callcenter-steps-caller-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CallerSelectorComponent,
    CallScriptJourneyComponent,
    RecentCallersComponent,
    TransferCallPopoverComponent,
  ],
  templateUrl: './call-centre-widget.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallCentreWidgetComponent {
  @ViewChild(RecentCallersComponent) recentCallersComponent!: RecentCallersComponent;

  // ==================== TRANSFER POPOVER ====================
  showTransferPopover = false;

  handleTransferCall(data: { reason: string; notes: string }) {
    console.log('Transfer initiated with data:', data);

    if (this.recentCallersComponent) {
      this.recentCallersComponent.transferCallWithReason(data.reason, data.notes);
    } else {
      console.warn('RecentCallersComponent not found');
    }
  }

  transferCall() {
    this.recentCallersComponent?.transferCall();
  }

  onRecentCallerSelected(caller: any) {
    console.log('Recent caller selected:', caller);
  }

  // ==================== SCRATCH PAD / NOTE TEXT ====================
  typedContent = '';
  maxChars = 1000;

  @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('editablePart') editablePart!: ElementRef<HTMLDivElement>;

  onType() {
    if (this.editablePart?.nativeElement) {
      this.editablePart.nativeElement.textContent = this.typedContent;
    }
    this.updateCount();
  }

  updateCount() {
    setTimeout(() => {}, 0);
  }

  get totalChars(): number {
    return this.contentContainer?.nativeElement?.textContent?.trim().length || 0;
  }

  get remaining() {
    return this.maxChars - this.totalChars;
  }

  // ==================== DISCLOSURE TOGGLES ====================
  showDetails = false;
  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  showElement = false;
  toggle() {
    this.showElement = !this.showElement;
  }

  showScript = false;
  toggleScript() {
    this.showScript = !this.showScript;
  }
}
