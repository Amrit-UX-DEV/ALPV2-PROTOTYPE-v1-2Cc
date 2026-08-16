import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';

import { PrototypeContextService } from '../../../context/prototype-context.service';

/**
 * The application header strip: system date, the user and settings dropdown,
 * notifications, branding, and the breadcrumb plus page heading.
 *
 * Despite the name this is not the top browser-chrome bar. It sits inside
 * <main> and is the header users actually see; the old <header> element that
 * used to sit above it was hidden and has been removed.
 *
 * The selector is an attribute so the host stays the existing
 * <div class="app-header">, which is a flex item of main.alpha-layout-col-2.
 * Its own CSS is all descendant-based, but the theme stylesheets reach into it
 * with rules like `.ui-app-theme--dark .app-header .app-page--heading h1`, so
 * the element and its position both need to stay put.
 *
 * The breadcrumb and page heading are the prototype's first context consumers:
 * the policy number, status, product, territory, currency and the Extra Care
 * indicator all come from the context JSON now. The rest of the region is
 * still static markup with 20 alpha-ui-* hooks that jQuery binds after render.
 */
@Component({
  selector: 'div[alpha-app-header]',
  standalone: true,
  templateUrl: './app-header.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppHeaderComponent {
  /** Read directly in the template as ctx.policy(), ctx.screen() and so on. */
  protected readonly ctx = inject(PrototypeContextService);
}
