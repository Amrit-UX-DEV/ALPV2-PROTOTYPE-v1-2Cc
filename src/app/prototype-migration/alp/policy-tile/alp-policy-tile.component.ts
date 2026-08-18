import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ContextPolicy } from '../../context/prototype-context.model';

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

  /** Empty means no action, which is what makes the tile read-only. */
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
