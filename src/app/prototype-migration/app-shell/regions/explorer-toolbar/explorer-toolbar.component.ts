import { Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { AppView } from '../../../ui/app-view.service';

export type { AppView } from '../../../ui/app-view.service';

/**
 * The left explorer: the always-visible icon rail and the slide-out search
 * panel beneath it.
 *
 * The selector is an attribute so the host stays the existing
 * <div class="alpha-explorer-toolbar ux-toolbar-example pinned01">. That div is
 * a flex item of main > .alpha-layout-row-2, and the search panel is hidden by
 * `.alpha-explorer-toolbar .ui-action-menu-extended { display: none }` and
 * revealed when jQuery adds .extended to the host. An element selector would
 * insert a node between the two and the panel would render open by default,
 * which is how it broke once before.
 *
 * Two rail buttons switch the main view. The shell owns currentView because
 * three places depend on it: these buttons set it, these buttons also render
 * their own .active state from it, and the app body renders the view itself.
 * So it comes in as an input and changes go back out as an event, leaving the
 * rail markup exactly as it was.
 */
@Component({
  selector: 'div[alpha-explorer-toolbar]',
  standalone: true,
  templateUrl: './explorer-toolbar.component.html',
  styleUrl: './explorer-toolbar.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ExplorerToolbarComponent {
  @Input() currentView: AppView = 'work-plan';
  @Output() viewChange = new EventEmitter<AppView>();

  switchView(view: AppView) {
    this.viewChange.emit(view);
  }
}
