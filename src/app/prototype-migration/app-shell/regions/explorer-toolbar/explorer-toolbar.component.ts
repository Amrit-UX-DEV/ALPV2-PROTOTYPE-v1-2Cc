import { Component, Input, Output, EventEmitter, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { AppView } from '../../../ui/app-view.service';
import { ContextSearchService } from '../../../context/context-search.service';

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
 *
 * The search panel drives the same search as the one in the call centre widget.
 * A rep can use either and the result is the same, because both forms bind to
 * the one service rather than each holding its own criteria and term.
 */
@Component({
  selector: 'div[alpha-explorer-toolbar]',
  standalone: true,
  templateUrl: './explorer-toolbar.component.html',
  styleUrl: './explorer-toolbar.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ExplorerToolbarComponent {
  /** Read in the template as search.criteria(), search.term() and so on. */
  protected readonly search = inject(ContextSearchService);

  @Input() currentView: AppView = 'group-summary';
  @Output() viewChange = new EventEmitter<AppView>();

  switchView(view: AppView) {
    this.viewChange.emit(view);
  }

  protected onCriteriaChange(event: Event): void {
    this.search.setCriteria((event.target as HTMLSelectElement).value);
  }

  protected onReferenceInput(event: Event): void {
    this.search.setTerm((event.target as HTMLInputElement).value);
  }

  /** A hit here activates the context and brings its group summary up. */
  protected async onSearch(event: Event): Promise<void> {
    event.preventDefault();
    await this.search.run();
  }
}
