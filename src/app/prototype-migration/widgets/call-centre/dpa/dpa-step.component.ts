import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PrototypeContextService } from '../../../context/prototype-context.service';

/**
 * Step 2 of the call centre journey: DPA / security questions.
 *
 * Presentational only - the pass/fail states are driven by the prototype's
 * jQuery helpers toggling classes, not by component state.
 */
@Component({
  selector: 'li[alpha-dpa-step]',
  standalone: true,
  templateUrl: './dpa-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DpaStepComponent {
  /** The policy the call is about, read in the template as ctx.policy(). */
  protected readonly ctx = inject(PrototypeContextService);
}
