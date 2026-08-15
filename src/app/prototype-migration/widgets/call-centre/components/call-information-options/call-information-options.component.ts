import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/**
 * The "call information options" panel inside the call information step.
 *
 * Presentational only. The panel is revealed when the surrounding
 * .call-info-action-container gains .show-call-information-options.
 *
 * The selector is an attribute so the host element stays the existing
 * <div class="overlay--local-container call-information-options">. Several
 * rules target `.overlay--local-container > div`, so an element selector
 * would insert a wrapper and stop those matching.
 */
@Component({
  selector: 'div[alpha-call-information-options]',
  standalone: true,
  templateUrl: './call-information-options.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallInformationOptionsComponent {}
