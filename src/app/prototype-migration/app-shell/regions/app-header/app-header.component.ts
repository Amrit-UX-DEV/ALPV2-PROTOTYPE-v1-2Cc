import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

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
 * No Angular bindings at all: 314 lines of static markup with 20 alpha-ui-*
 * hooks that the prototype's jQuery binds after render.
 *
 * This is the region the context work lands in first. .app-page--header holds
 * the breadcrumb and the heading, and the heading's .context-info spans are
 * where the hard-coded policy currently lives: policy 80007, In Force, Group
 * Stakeholder Pen Plan Pre Nov 04, Great Britain, UK Sterling, Extra Care
 * Client. Those are 31 of these 314 lines, and they become the first consumer
 * of the context JSON.
 */
@Component({
  selector: 'div[alpha-app-header]',
  standalone: true,
  templateUrl: './app-header.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppHeaderComponent {}
