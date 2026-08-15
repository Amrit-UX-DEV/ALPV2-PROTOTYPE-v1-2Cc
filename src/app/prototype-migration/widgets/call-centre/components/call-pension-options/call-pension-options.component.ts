import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { PensionQuestionSetsComponent } from '../pension-question-sets/pension-question-sets.component';

/**
 * The pension information options panel inside the call information step.
 *
 * Holds the guidance question sets and the Pension Wise guidance and booking
 * containers (ui-pension-guidance-information-container-a/b/c and
 * ui-pension-booking-information-container-c), which start hidden with
 * .ux-hide and are revealed by the prototype's jQuery toggles.
 *
 * Presentational only. The panel is revealed when the surrounding
 * .call-info-action-container gains .show-call-pension-action-options.
 */
@Component({
  selector: 'div[alpha-call-pension-options]',
  standalone: true,
  imports: [PensionQuestionSetsComponent],
  templateUrl: './call-pension-options.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallPensionOptionsComponent {}
