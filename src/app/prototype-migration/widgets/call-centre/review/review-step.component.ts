import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PrototypeContextService } from '../../../context/prototype-context.service';

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
export class ReviewStepComponent {
  /** The policy the call is about, read in the template as ctx.policy(). */
  protected readonly ctx = inject(PrototypeContextService);
}
