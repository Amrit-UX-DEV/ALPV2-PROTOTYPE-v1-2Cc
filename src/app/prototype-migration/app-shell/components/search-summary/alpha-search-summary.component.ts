import { Component, inject } from '@angular/core';

import { PrototypeContextService } from '../../../context/prototype-context.service';

/**
 * The possible match summary.
 *
 * A caller gives a reference the rep searches for. Where it is found, what comes
 * back is partial data about someone who may or may not be on the system, which
 * is why this is a screen of its own rather than a group summary: there is no
 * policy in this context to summarise.
 *
 * This is a placeholder. It renders what the registry already knows, so the
 * screen can be seen to load on a match, and the summary proper follows once the
 * JSON that describes the partial data is defined.
 */
@Component({
  selector: 'alpha-search-summary',
  standalone: true,
  templateUrl: './alpha-search-summary.component.html',
  styleUrl: './alpha-search-summary.component.css',
})
export class AlphaSearchSummaryComponent {
  /** Read in the template as ctx.label() and ctx.journey(). */
  protected readonly ctx = inject(PrototypeContextService);
}
