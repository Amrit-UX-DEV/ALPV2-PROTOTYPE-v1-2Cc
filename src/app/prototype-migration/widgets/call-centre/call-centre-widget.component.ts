import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { CallerDetailsStepComponent } from './caller-details/caller-details-step.component';
import { DpaStepComponent } from './dpa/dpa-step.component';
import { ContactInfoStepComponent } from './contact-info/contact-info-step.component';
import { CallInfoStepComponent } from './call-info/call-info-step.component';
import { ReviewStepComponent } from './review/review-step.component';

/**
 * Call centre service app that docks into the app shell's right sidebar.
 *
 * A container for the five journey steps, each of which owns its own markup
 * and state. Cross-step behaviour still lives in the prototype's jQuery
 * helpers, which find elements globally by class name.
 *
 * The selector deliberately keeps the legacy `alpha-callcenter-steps-caller-details`
 * tag name: eight rules in the prototype stylesheets target it as an element
 * selector, so renaming it would drop that styling.
 */
@Component({
  selector: 'alpha-callcenter-steps-caller-details',
  standalone: true,
  imports: [
    CallerDetailsStepComponent,
    DpaStepComponent,
    ContactInfoStepComponent,
    CallInfoStepComponent,
    ReviewStepComponent,
  ],
  templateUrl: './call-centre-widget.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallCentreWidgetComponent {}
