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

import { PrototypeContextService } from '../../../context/prototype-context.service';
import {
  CHANGE_CATEGORIES,
  DashboardReferenceOutcome,
  DecisionActions,
  MatchDecision,
  NOTE_LIMIT,
  OTHER_CATEGORY,
} from './dashboard-reference-outcome.model';

/**
 * Step one of the dashboard reference work plan: the decision, and what it
 * leaves to do.
 *
 * One question at a time, and the next one only once the last has an answer.
 * The whole step is about a single judgement, so the reference it is about is
 * the heading and nothing else about the policy is repeated here: the rep has
 * just come off the comparison, and a second summary of it is a screen to read
 * rather than a question to answer.
 *
 * Changes are recorded by category, not by field. The comparison is field by
 * field because that is how the other platform sends it, but a name is a name:
 * a given name, a surname and five alternate surnames are one change of name to
 * everything downstream of this.
 *
 * The step reports itself on every change, including whether it has everything
 * it needs, so the wizard can hold its Save button without knowing what any of
 * these answers mean.
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

  /** The reference the whole step is about, which is its heading. */
  protected readonly reference = this.ctx.reference;

  protected readonly categories = CHANGE_CATEGORIES;
  protected readonly noteLimit = NOTE_LIMIT;

  /* ── What the rep has answered ───────────────────────────────── */

  private readonly matchDecision = signal<MatchDecision | null>(null);
  private readonly decisionActions = signal<DecisionActions | null>(null);
  private readonly chosenCategories = signal<string[]>([]);
  private readonly otherNote = signal('');

  protected readonly decision = this.matchDecision.asReadonly();
  protected readonly actions = this.decisionActions.asReadonly();
  protected readonly note = this.otherNote.asReadonly();

  /** Whether the categories are being asked for, which is the only reveal here. */
  protected readonly needsCategories = computed(() => this.decisionActions() === 'actions');

  protected readonly otherChosen = computed(() =>
    this.chosenCategories().includes(OTHER_CATEGORY),
  );

  /** What is left of the thousand, counted down as it is typed. */
  protected readonly noteRemaining = computed(() => NOTE_LIMIT - this.otherNote().length);

  /**
   * Whether the step has been given everything it asks for.
   *
   * A decision, then what it leaves to do, then a category if there is anything
   * to do, then something written down if one of those categories is the one
   * that does not name itself.
   */
  private readonly complete = computed(() => {
    if (this.matchDecision() === null) return false;

    const actions = this.decisionActions();
    if (actions === null) return false;
    if (actions === 'no-actions') return true;

    if (this.chosenCategories().length === 0) return false;
    return !this.otherChosen() || this.otherNote().trim().length > 0;
  });

  constructor() {
    // Restored once, from whatever the wizard held: after that the rep's own
    // answers are the truth, and re-applying an old one would undo an edit.
    let restored = false;
    effect(() => {
      const previous = this.initial();
      if (restored || !previous) return;
      restored = true;
      this.matchDecision.set(previous.decision);
      this.decisionActions.set(previous.actions);
      this.chosenCategories.set(previous.categories);
      this.otherNote.set(previous.note);
    });
  }

  protected isChosen(id: string): boolean {
    return this.chosenCategories().includes(id);
  }

  protected chooseDecision(decision: MatchDecision): void {
    this.matchDecision.set(decision);
    this.report();
  }

  /**
   * Nothing to do clears what was ticked, since the categories are no longer
   * being asked about and a list held behind an answer that hides it is a list
   * that gets saved by accident.
   */
  protected chooseActions(actions: DecisionActions): void {
    this.decisionActions.set(actions);
    if (actions === 'no-actions') {
      this.chosenCategories.set([]);
      this.otherNote.set('');
    }
    this.report();
  }

  protected toggleCategory(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.chosenCategories.update((chosen) =>
      checked ? [...chosen, id] : chosen.filter((entry) => entry !== id),
    );
    // Unticking Other takes what was written with it, for the same reason.
    if (id === OTHER_CATEGORY && !checked) this.otherNote.set('');
    this.report();
  }

  protected writeNote(event: Event): void {
    this.otherNote.set((event.target as HTMLTextAreaElement).value.slice(0, NOTE_LIMIT));
    this.report();
  }

  private report(): void {
    this.outcome.emit({
      reference: this.reference(),
      decision: this.matchDecision(),
      actions: this.decisionActions(),
      categories: this.chosenCategories(),
      note: this.otherNote(),
      complete: this.complete(),
    });
  }
}
