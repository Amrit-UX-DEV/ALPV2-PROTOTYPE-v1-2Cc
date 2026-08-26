import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Step two of the dashboard reference work plan: it saved.
 *
 * A bar and nothing else. What was recorded is a step away on Previous, and
 * reading it back here would turn a confirmation into a second form to check.
 */
@Component({
  selector: 'dashboard-reference-confirmation',
  standalone: true,
  templateUrl: './dashboard-reference-confirmation.component.html',
  styleUrl: './dashboard-reference-plan.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardReferenceConfirmationComponent {}
