import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VulnerableClientActionComponent } from '../vulnerable-client-action/vulnerable-client-action.component';
import { ContextClient } from '../../../context/prototype-context.model';
import { PrototypeContextService } from '../../../context/prototype-context.service';

@Component({
  selector: 'alpha-group-summary',
  standalone: true,
  imports: [
    CommonModule,
    VulnerableClientActionComponent,
  ],
  templateUrl: './alpha-group-summary.component.html',
  styleUrls: ['./alpha-group-summary.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AlphaGroupSummaryComponent {
  protected readonly ctx = inject(PrototypeContextService);

  /**
   * Tokens for the row's linked-clients attribute, e.g.
   * "uxMrMrsBloggs uxMrJoeBloggs uxMrsLucyBloggs".
   *
   * alpha-core.js matches these against a client tile's policy-client-link
   * with a substring selector and css-updates.css highlights the row from the
   * result, so the ux{key} spelling here has to be exact. Note it has no
   * hyphen, unlike the ux-{key} identity class on the same clients.
   */
  protected readonly linkedClients = computed(() =>
    this.ctx.clients().map((client) => this.token(client)).join(' '),
  );

  /**
   * The client a hand-authored tile shows.
   *
   * Several tiles are authored one per client and sit alongside entries that
   * are not modelled yet, so they cannot be looped over. Until they can, each
   * names the client it is for.
   */
  protected client(key: string): ContextClient | undefined {
    return this.ctx.clientByKey(key);
  }

  /** The linked-clients / policy-client-link spelling of a client's identity. */
  protected token(client: ContextClient | undefined): string | null {
    return client ? `ux${client.key}` : null;
  }

  /** Same, looked up by key, for the tiles that name their client. */
  protected tokenFor(key: string): string | null {
    return this.token(this.client(key));
  }

  /**
   * The selected client in linked-clients spelling, or null when the selection
   * is not a client. css-updates.css matches it with [selected-client*="..."].
   */
  protected readonly selectedClientToken = computed(() =>
    this.token(this.ctx.selectedClient()),
  );

  /**
   * Whether the policy row should reveal its linked-member indicator.
   *
   * True only when the selected client is actually one of this policy's, which
   * is what stops an unrelated selection from lighting the row up.
   */
  protected readonly showLinkedMember = computed(() => {
    const token = this.selectedClientToken();
    return token !== null && this.linkedClients().split(' ').includes(token);
  });
}
