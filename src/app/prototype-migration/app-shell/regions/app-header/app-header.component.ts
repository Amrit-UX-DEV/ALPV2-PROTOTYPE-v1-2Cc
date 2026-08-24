import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';

import { PrototypeContextService } from '../../../context/prototype-context.service';
import { AppViewService } from '../../../ui/app-view.service';
import { ThemeService } from '../../../ui/theme.service';

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
 *
 * The heading reads the policy the context says to show, not simply the one it
 * resolved: a possible match holds a policy for DPA but is not on it yet, so its
 * context asks for the summary to be left off and the heading names the possible
 * match alone. Where a context has no policy at all, its label stands in.
 *
 * A view that no context describes names itself instead. A business process is
 * not something a rep searched for, so on the work plan the heading reads
 * 'Business Processes: Script Management' and the breadcrumb follows it, while
 * the group summary and the possible match summary are still named by whatever
 * context they are showing.
 */
@Component({
  selector: 'div[alpha-app-header]',
  standalone: true,
  templateUrl: './app-header.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppHeaderComponent {
  /** Read directly in the template as ctx.headerPolicy(), ctx.label() and so on. */
  protected readonly ctx = inject(PrototypeContextService);

  private readonly views = inject(AppViewService);

  /**
   * The branding block shows whatever the active theme's stylesheet swaps in,
   * so the alt text is read from the theme rather than written in the markup.
   */
  protected readonly theme = inject(ThemeService);

  /** The breadcrumb and prefix, from the view where it names itself. */
  protected readonly screen = computed(() => this.views.screen() ?? this.ctx.screen());

  /** No policy is summarised on a screen the context is not describing. */
  protected readonly headerPolicy = computed(() =>
    this.views.screen() ? undefined : this.ctx.headerPolicy(),
  );

  /**
   * What follows the prefix where no policy does: the screen's own name, or the
   * context's label where a context has no policy to summarise.
   */
  protected readonly label = computed(() => {
    const view = this.views.screen();
    if (view) return view.label;
    return this.ctx.hasPolicy() ? '' : this.ctx.label();
  });
}
