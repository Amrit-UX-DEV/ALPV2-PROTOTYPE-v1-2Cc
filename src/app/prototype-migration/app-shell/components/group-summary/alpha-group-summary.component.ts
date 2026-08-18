import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VulnerableClientActionComponent } from '../vulnerable-client-action/vulnerable-client-action.component';
import { ageOn } from '../../../context/age';
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

  /**
   * The age shown in brackets after a date of birth.
   *
   * Derived rather than written into the tile, which is how one of them came to
   * say 55 for someone born in 1966.
   */
  protected ageOf(dateOfBirth: string): number | undefined {
    return ageOn(dateOfBirth);
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

  /**
   * There is a policy whenever this screen is rendered, since the body only
   * shows the group summary once a search has found one, but the context type
   * does not know that: before a search it holds no context and has no policy.
   * Both of these check rather than assert, so the screen cannot fail if it is
   * ever shown without one.
   */
  protected selectPolicy(): void {
    const policy = this.ctx.policy();
    if (policy) this.ctx.select('policy', policy.number);
  }

  protected readonly policySelected = computed(() => {
    const policy = this.ctx.policy();
    return policy !== undefined && this.ctx.isSelected('policy', policy.number);
  });

  /**
   * The selected client in linked-clients spelling, or null when the selection
   * is not a client. css-updates.css matches it with [selected-client*="..."].
   */
  protected readonly selectedClientToken = computed(() =>
    this.token(this.ctx.selectedClient()),
  );

  /**
   * The one linked member whose indicator the policy row should show, or
   * undefined when there is nothing to show.
   *
   * The template renders this and nothing else, so which indicator appears is
   * decided here rather than by rendering every member and leaving a
   * stylesheet to reveal one of them. Selecting the agent, the beneficiary or
   * a client who is not a member of this policy yields undefined.
   */
  protected readonly selectedLinkedMember = computed(() => {
    const selected = this.ctx.selectedClient();
    if (!selected?.linked) return undefined;
    const token = this.token(selected);
    return token !== null && this.linkedClients().split(' ').includes(token)
      ? selected
      : undefined;
  });

  /** Whether the policy row is showing a linked member at all. */
  protected readonly showLinkedMember = computed(() => this.selectedLinkedMember() !== undefined);

  /**
   * Whether the policy tile is expanded. It starts open, matching the markup
   * this replaced, where the details carried no collapse class.
   */
  protected readonly policyDetailsExpanded = signal(true);

  protected togglePolicyDetails(): void {
    this.policyDetailsExpanded.update((open) => !open);
  }
}
