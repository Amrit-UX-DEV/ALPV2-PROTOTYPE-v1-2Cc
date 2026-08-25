import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { WorkPlanService } from '../../../work-plans/work-plan.service';

/**
 * The business processes hub: which work plan to run.
 *
 * The rail's business processes button used to open script management, because
 * that was the only plan there was. It lands here now, and script management is
 * one tile of two. Nothing on this screen knows what either plan does: the tiles
 * are the work plan index, and pressing one hands its config to the wizard
 * shell, which is what has always read the steps.
 */
@Component({
  selector: 'alpha-work-plan-hub',
  standalone: true,
  templateUrl: './alpha-work-plan-hub.component.html',
  styleUrl: './alpha-work-plan-hub.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlphaWorkPlanHubComponent {
  protected readonly plans = inject(WorkPlanService);
}
