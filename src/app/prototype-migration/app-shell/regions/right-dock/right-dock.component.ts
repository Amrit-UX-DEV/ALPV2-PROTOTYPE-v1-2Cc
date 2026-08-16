import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { CallCentreWidgetComponent } from '../../../widgets/call-centre/call-centre-widget.component';

/**
 * The right-hand dock: the app rail listing running and available service
 * apps, and the widget dock beneath it.
 *
 * The selector is the existing <alpha-right-sidebar> tag rather than a new
 * element, so the rendered DOM is unchanged. That matters twice over: this
 * element is a flex item of main > .alpha-layout-row-2 and must stay a
 * SIBLING of .alpha-app-body, and 70 CSS rules key off .alpha-right-sidebar.
 * Wrapping it in a component element collapsed the rail and the dock the last
 * time it was attempted.
 *
 * The markup has no Angular bindings. Everything interactive here is driven by
 * the prototype's jQuery: 11 alpha-ui-* hooks and one inline onclick, all bound
 * after render by the scripts the shell loads in ngAfterViewInit.
 *
 * It does host the call centre widget, though. That import is load-bearing:
 * CUSTOM_ELEMENTS_SCHEMA means an unimported component selector renders as an
 * empty unknown element with no compile error, so the widget silently vanishes
 * without it.
 */
@Component({
  selector: 'alpha-right-sidebar',
  standalone: true,
  imports: [CallCentreWidgetComponent],
  templateUrl: './right-dock.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RightDockComponent {}
