import { Component, Input, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AlphaGroupSummaryComponent } from '../../components/group-summary/alpha-group-summary.component';
import { AlphaSearchSummaryComponent } from '../../components/search-summary/alpha-search-summary.component';
import { AlphaWorkPlanHubComponent } from '../../components/work-plans/alpha-work-plan-hub.component';
import { WizardShellComponent } from '../../../wizard';
import { AppView } from '../explorer-toolbar/explorer-toolbar.component';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { WorkPlanService } from '../../../work-plans/work-plan.service';

/**
 * The main body: whichever view the explorer rail last selected.
 *
 * The selector is an attribute so the host stays the existing
 * <div class="alpha-layout-col-2 alpha-app-body">, which is a flex item of
 * main > .alpha-layout-row-2 and must remain a sibling of the toolbar and the
 * right dock.
 *
 * The <router-outlet> is kept exactly where it was and deliberately left
 * unresolved. RouterOutlet is not imported and app.routes.ts exports an empty
 * Routes array, so it renders as an inert unknown element. Its one real job is
 * structural: `.alpha-layout-col-2.alpha-app-body > router-outlet + *` in
 * 16-alpha-form-control-and-menu-toolbar-enhancements.css styles the element
 * immediately after it, which is the ngSwitch container below. Removing the
 * tag, or importing RouterOutlet so it renders differently, would break that
 * rule.
 *
 * currentView is an input rather than local state because the rail sets it and
 * also renders its own active state from it, so the shell owns it.
 *
 * The group summary is a view of a policy, so it is only rendered once a search
 * has found one. Before that the app is in no context and this says so, rather
 * than drawing a summary with nothing in it. The dashboard reference summary
 * follows the same rule against its own kind of context, so neither screen can
 * be reached by switching view without having searched.
 *
 * The business processes are two views rather than one: the hub, which lists the
 * work plans, and the wizard shell running whichever one was opened. The shell
 * is handed a config rather than importing one, so a third plan is a JSON file
 * and an entry in the index with nothing to change here.
 */
@Component({
  selector: 'div[alpha-app-body]',
  standalone: true,
  imports: [
    CommonModule,
    AlphaGroupSummaryComponent,
    AlphaSearchSummaryComponent,
    AlphaWorkPlanHubComponent,
    WizardShellComponent,
  ],
  templateUrl: './app-body.component.html',
  styleUrl: './app-body.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppBodyComponent {
  @Input() currentView: AppView = 'group-summary';

  protected readonly ctx = inject(PrototypeContextService);

  /** Which work plan the hub opened, which is the config the shell loads. */
  protected readonly plans = inject(WorkPlanService);
}
