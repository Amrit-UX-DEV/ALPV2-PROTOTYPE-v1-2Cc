import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/**
 * Step 5 of the call centre journey: review the call and capture the survey.
 *
 * Presentational only.
 */
@Component({
  selector: 'li[alpha-review-step]',
  standalone: true,
  templateUrl: './review-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReviewStepComponent {}
