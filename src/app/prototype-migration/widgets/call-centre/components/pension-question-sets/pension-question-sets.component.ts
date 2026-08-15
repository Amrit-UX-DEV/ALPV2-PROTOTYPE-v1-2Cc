import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/**
 * The twelve pension guidance question sets (cc-question-set01..12).
 *
 * Presentational only. Exactly one set is visible at a time, chosen by the
 * ux-show-question-setNN class on the host element, which the prototype's
 * jQuery toggles swap as the adviser moves through the guidance. The rule
 * that does the work is:
 *
 *   .ux-question-visibility.ux-show-question-setNN [class*="cc-question-setNN"]
 *
 * so the host must keep both .ux-question-visibility and the current
 * ux-show-question-setNN class - hence the attribute selector rather than an
 * element one.
 */
@Component({
  selector: 'div[alpha-pension-question-sets]',
  standalone: true,
  templateUrl: './pension-question-sets.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PensionQuestionSetsComponent {}
