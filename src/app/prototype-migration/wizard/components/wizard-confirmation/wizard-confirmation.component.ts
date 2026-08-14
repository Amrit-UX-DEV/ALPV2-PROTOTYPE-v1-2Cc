import { Component, input } from '@angular/core';

/** Simple confirmation step showing a success message. */
@Component({
  selector: 'wizard-confirmation',
  standalone: true,
  template: `
    <div class="notification-block status-success">
      <div class="notification-message">
        <p>{{ message() }}</p>
      </div>
    </div>
  `,
})
export class WizardConfirmationComponent {
  readonly message = input('Success — wizard complete.');
}
