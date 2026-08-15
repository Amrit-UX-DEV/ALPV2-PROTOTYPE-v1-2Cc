import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/**
 * Step 3 of the call centre journey: confirm and update contact information.
 *
 * Presentational only - the stored/updated detail panels are switched by
 * toggleCurrentlyStored() and toggleUpdateCurrentlyStored() in
 * prototype-interactions.js.
 */
@Component({
  selector: 'li[alpha-contact-info-step]',
  standalone: true,
  templateUrl: './contact-info-step.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ContactInfoStepComponent {}
