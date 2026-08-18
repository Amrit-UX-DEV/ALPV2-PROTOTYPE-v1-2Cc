import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ContextPolicy } from '../../context/prototype-context.model';

/**
 * A count signposted on the tile, e.g. Interested Parties 2.
 *
 * A label and a number rather than named inputs, because which parties are
 * worth signposting is the screen's decision, not the tile's.
 */
export interface PolicyTileSignpost {
  label: string;
  value: number;
}

/**
 * A compact policy tile, in ALP design system classes.
 *
 * It mirrors what the legacy policy tile shows rather than reusing it: the
 * legacy tile carries selection, linked members and an expanded panel that only
 * the group summary needs, and its classes are the ones being retired. This is
 * the replacement, built on alp- classes and design tokens so it can be dropped
 * anywhere a policy needs summarising without inheriting any of that.
 *
 * Everything shown comes from the policy passed in. The action is optional: a
 * tile with no action label is a read-only summary.
 */
@Component({
  selector: 'alp-policy-tile',
  standalone: true,
  templateUrl: './alp-policy-tile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlpPolicyTileComponent {
  /** The policy to summarise. */
  readonly policy = input.required<ContextPolicy>();

  /**
   * Extra badges beside the status, e.g. 'Life'.
   *
   * Kept as free text because what is worth flagging differs by screen, and the
   * tile should not have to know the whole vocabulary.
   */
  readonly flags = input<string[]>([]);

  /** Party counts to signpost. Empty means the tile signposts none. */
  readonly signposts = input<PolicyTileSignpost[]>([]);

  /**
   * Empty means no action, which is what makes the tile read-only.
   *
   * The label is not drawn: the action is the group summary's own full-height
   * chevron button at the end of the tile, and the label becomes its accessible
   * name and its tooltip. So it still has to read as an instruction, e.g. 'View
   * Group Summary', for anyone hearing it rather than seeing the chevron.
   */
  readonly actionLabel = input('');

  /** Draws the tile as the current selection. */
  readonly selected = input(false);

  /**
   * Whether the policy is live, which is what turns the border green, the way
   * state--ui-active does on the group summary's tile.
   *
   * Read from the status rather than passed in, so a screen showing a policy
   * cannot describe it as live while its status says otherwise.
   */
  protected readonly active = computed(() => /in force|active/i.test(this.policy().status));

  /** What the action does is the caller's business, not the tile's. */
  readonly action = output<void>();
}
