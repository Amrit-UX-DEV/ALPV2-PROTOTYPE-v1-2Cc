import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';

import { VERDICT_LABELS } from '../../../context/comparison.service';
import { DashboardReferenceOutcome } from './dashboard-reference-outcome.model';

/**
 * Step two of the dashboard reference work plan: what was saved.
 *
 * It reads back the step before it rather than the context, so a rep who
 * changed their mind, went back and changed it again is shown what they
 * actually recorded.
 *
 * The decision is named with the same two words the comparison uses for a field
 * that agrees and one that does not, because it is the same judgement made about
 * the record as a whole.
 */
@Component({
  selector: 'dashboard-reference-confirmation',
  standalone: true,
  templateUrl: './dashboard-reference-confirmation.component.html',
  styleUrl: './dashboard-reference-plan.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardReferenceConfirmationComponent {
  private readonly locale = inject(LOCALE_ID);

  /** What step one recorded, handed over by the wizard. */
  readonly outcome = input<DashboardReferenceOutcome | null>(null);

  protected readonly decisionLabel = computed(() => {
    const decision = this.outcome()?.decision;
    return decision ? VERDICT_LABELS[decision] : '';
  });

  /**
   * Matched wears the same green chip an agreeing field wears, not matched the
   * same amber one. Neither is the only thing saying which it is; the word is
   * on the chip.
   */
  protected readonly decisionTag = computed(() =>
    this.outcome()?.decision === 'matched' ? 'alp-status-tag--primary' : 'alp-status-tag--warning',
  );

  /**
   * What was supplied, as a sentence. Nothing ticked and no declaration either
   * way is reported as exactly that, rather than as an empty line.
   */
  protected readonly suppliedText = computed(() => {
    const saved = this.outcome();
    if (!saved) return '';
    if (saved.noChanges) return 'No changes were needed';
    if (saved.supplied.length === 0) return 'Nothing was recorded';
    return saved.supplied.join(', ');
  });

  /**
   * When it was saved, which is when this step was reached.
   *
   * Read once, as the step is built, rather than as a signal: it is a record of
   * a moment, and a clock ticking on a confirmation would say the action had
   * been saved again.
   */
  protected readonly savedAt = formatDate(new Date(), 'dd MMM yyyy, HH:mm', this.locale);
}
