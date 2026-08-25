import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { ComparisonService } from '../../../context/comparison.service';
import { PossibleMatchService } from '../../../context/possible-match.service';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { DashboardReferenceOutcome, MatchDecision } from './dashboard-reference-outcome.model';

/**
 * Step one of the dashboard reference work plan: confirm, record, decide.
 *
 * Three things in the order the call happens in. The reference and the policy
 * it resolved to are shown first, because everything after them is about that
 * record and a rep who has been through several calls needs to see which one
 * this is. Then what was supplied, since that is what the call was for. Then
 * the decision, which is the thing the plan exists to capture and the only
 * answer the step insists on.
 *
 * What can be supplied is the comparison's own list of fields, not a list
 * written out here: the same service the dashboard reference summary reads,
 * filtered to what the two platforms disagree on and what neither of them
 * holds. A field they already agree on has nothing to supply against it, so it
 * is not offered.
 *
 * The step reports itself on every change rather than when the rep presses
 * Save, so the wizard can see whether it has been given a decision and hold the
 * button until it has.
 */
@Component({
  selector: 'dashboard-reference-outcome',
  standalone: true,
  templateUrl: './dashboard-reference-outcome.component.html',
  styleUrl: './dashboard-reference-plan.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardReferenceOutcomeComponent {
  private readonly ctx = inject(PrototypeContextService);
  private readonly matches = inject(PossibleMatchService);
  private readonly comparison = inject(ComparisonService);

  /**
   * What this step recorded last time it was on screen.
   *
   * The wizard rebuilds a step each time it is opened, so coming back from the
   * confirmation would otherwise show an empty form having just been told the
   * answers were saved. The wizard already holds them, and the step config
   * hands them back in.
   */
  readonly initial = input<DashboardReferenceOutcome | null>(null);

  /** Everything recorded so far, reported on every change. */
  @Output() readonly outcome = new EventEmitter<DashboardReferenceOutcome>();

  /* ── What the rep is deciding about ──────────────────────────── */

  protected readonly record = this.matches.record;
  protected readonly loading = this.matches.loading;
  protected readonly detail = this.matches.detail;
  protected readonly policy = this.ctx.policy;
  protected readonly reference = this.ctx.reference;

  /** The name on the other platform's record, which is who the caller says they are. */
  protected readonly recordName = computed(() => {
    const them = this.record();
    if (!them) return '';
    return `${them.givenName} ${them.surName}`.replace(/\s+/g, ' ').trim();
  });

  protected readonly validUntil = computed(() =>
    this.comparison.asDate(this.detail()?.pensionValidUntill),
  );

  /** Everything the two platforms disagree on, and everything neither holds. */
  protected readonly options = this.comparison.supplyableFields;

  /**
   * Why a field is on the list, said in as few words as the line allows. A rep
   * ticking Postcode should be able to see whether they were correcting one or
   * supplying the first one either platform has.
   */
  protected readonly supplyReasons: Record<string, string> = {
    'not-matched': 'Records differ',
    'not-held': 'Neither platform holds this',
  };

  /* ── What the rep has recorded ───────────────────────────────── */

  private readonly suppliedFields = signal<string[]>([]);
  private readonly nothingSupplied = signal(false);
  private readonly matchDecision = signal<MatchDecision | null>(null);

  protected readonly noChanges = this.nothingSupplied.asReadonly();
  protected readonly decision = this.matchDecision.asReadonly();

  constructor() {
    // Restored once, from whatever the wizard held: after that the rep's own
    // answers are the truth, and re-applying an old one would undo an edit.
    let restored = false;
    effect(() => {
      const previous = this.initial();
      if (restored || !previous) return;
      restored = true;
      this.suppliedFields.set(previous.supplied);
      this.nothingSupplied.set(previous.noChanges);
      this.matchDecision.set(previous.decision);
    });
  }

  protected isSupplied(label: string): boolean {
    return this.suppliedFields().includes(label);
  }

  /**
   * One field ticked or unticked.
   *
   * Ticking a field is saying something was supplied, so it clears an earlier
   * claim that nothing was: the two cannot both be true, and leaving the rep to
   * notice that themselves is how a contradiction gets saved.
   */
  protected toggleField(label: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.suppliedFields.update((fields) =>
      checked ? [...fields, label] : fields.filter((field) => field !== label),
    );
    if (checked) this.nothingSupplied.set(false);
    this.report();
  }

  /** Nothing was supplied, which clears anything ticked to say otherwise. */
  protected toggleNoChanges(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.nothingSupplied.set(checked);
    if (checked) this.suppliedFields.set([]);
    this.report();
  }

  protected choose(decision: MatchDecision): void {
    this.matchDecision.set(decision);
    this.report();
  }

  private report(): void {
    this.outcome.emit({
      reference: this.reference(),
      pensionReference: this.detail()?.pensionReference ?? '',
      record: this.recordName(),
      noChanges: this.nothingSupplied(),
      supplied: this.suppliedFields(),
      decision: this.matchDecision(),
    });
  }
}
