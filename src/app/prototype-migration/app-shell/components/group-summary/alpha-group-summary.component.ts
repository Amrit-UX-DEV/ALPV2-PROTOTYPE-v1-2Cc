import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VulnerableClientActionComponent } from '../vulnerable-client-action/vulnerable-client-action.component';
import { ContextClient } from '../../../context/prototype-context.model';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { OverlayService } from '../../../ui/overlay.service';

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
  protected readonly overlay = inject(OverlayService);

  /** The parties drawn on the policy row as linked-member indicators. */
  protected readonly linkedMembers = computed(() =>
    this.ctx.clients().filter((client) => client.linked),
  );

  /**
   * Tokens for the row's linked-clients attribute, e.g.
   * "uxMrMrsBloggs uxMrJoeBloggs uxMrsLucyBloggs".
   *
   * Only linked members appear. A servicing agent is attached to the policy
   * but is not one of its linked members, so it has no token and no indicator.
   */
  protected readonly linkedClients = computed(() =>
    this.linkedMembers().map((client) => this.token(client)).join(' '),
  );

  /**
   * The party a hand-authored tile shows.
   *
   * Several tiles are authored one per party and sit alongside entries that
   * are not modelled yet, so they cannot be looped over. Until they can, each
   * names the party it is for.
   */
  protected client(key: string): ContextClient | undefined {
    return this.ctx.clientByKey(key);
  }

  /** The linked-clients / policy-client-link spelling of a party's identity. */
  protected token(client: ContextClient | undefined): string | null {
    return client ? `ux${client.key}` : null;
  }

  /** Same, looked up by key, for the tiles that name their party. */
  protected tokenFor(key: string): string | null {
    return this.token(this.client(key));
  }

  /**
   * Puts the app into the context this party implies: a client tile gives
   * client context, the servicing agent gives agent context.
   */
  protected selectParty(key: string): void {
    this.ctx.select(this.client(key)?.scope ?? 'client', key);
  }

  protected isPartySelected(key: string): boolean {
    return this.ctx.isSelected(this.client(key)?.scope ?? 'client', key);
  }

  protected selectPolicy(): void {
    this.ctx.select('policy', this.ctx.policy().number);
  }

  protected readonly policySelected = computed(() =>
    this.ctx.isSelected('policy', this.ctx.policy().number),
  );

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
   * True only when the selected client is actually a linked member of this
   * policy, which is what stops selecting the agent, the beneficiary or an
   * unrelated client from lighting the row up.
   */
  protected readonly showLinkedMember = computed(() => {
    const token = this.selectedClientToken();
    return token !== null && this.linkedClients().split(' ').includes(token);
  });
}
