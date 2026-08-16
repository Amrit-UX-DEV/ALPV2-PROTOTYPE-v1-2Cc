import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AlphaGroupSummaryComponent } from '../../components/group-summary/alpha-group-summary.component';
import { WizardShellComponent } from '../../../wizard';
import { AppView } from '../explorer-toolbar/explorer-toolbar.component';

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
 */
@Component({
  selector: 'div[alpha-app-body]',
  standalone: true,
  imports: [CommonModule, AlphaGroupSummaryComponent, WizardShellComponent],
  templateUrl: './app-body.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppBodyComponent {
  @Input() currentView: AppView = 'work-plan';
}
