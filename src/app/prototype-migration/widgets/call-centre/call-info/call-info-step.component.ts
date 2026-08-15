import {
  Component,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CallScriptJourneyComponent } from '../components/journey/call-script-journey.component';
import { CallInformationOptionsComponent } from '../components/call-information-options/call-information-options.component';
import { CallPensionOptionsComponent } from '../components/call-pension-options/call-pension-options.component';

/**
 * Step 4 of the call centre journey: log the call information.
 *
 * By far the largest step. Holds the pension guidance question sets
 * (ux-show-question-set01..12), the Pension Wise booking flow and the call
 * note scratch pad. The question sets are still switched by class toggling in
 * the prototype's jQuery helpers rather than by component state.
 */
@Component({
  selector: 'li[alpha-call-info-step]',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CallScriptJourneyComponent,
    CallInformationOptionsComponent,
    CallPensionOptionsComponent,
  ],
  templateUrl: './call-info-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallInfoStepComponent {
  // ==================== CALL NOTE SCRATCH PAD ====================
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
