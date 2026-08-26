/** What the rep decided about the record behind a dashboard reference. */
export type MatchDecision = 'matched' | 'not-matched';

/** Whether the decision leaves anything to do. */
export type DecisionActions = 'no-actions' | 'actions';

/**
 * A category of change, as the application classifies one.
 *
 * The comparison is field by field, because that is how the other platform
 * sends it, but nothing downstream works at that grain: a given name, a surname
 * and any of the five alternate surnames are all one thing, a change of name.
 * So the plan records the categories rather than the fields, and there are four
 * of them and an "other".
 *
 * Held here rather than in the comparison, because it is not a fact about the
 * two records; it is how this business process classifies work. Held in one
 * place rather than in the markup, so the confirmation and the form cannot come
 * to name them differently.
 */
export interface ChangeCategory {
  id: string;
  label: string;
}

export const CHANGE_CATEGORIES: readonly ChangeCategory[] = [
  { id: 'name', label: 'Change of Name' },
  { id: 'ni-number', label: 'Change of National Insurance Number' },
  { id: 'address', label: 'Change of Address' },
  { id: 'contact', label: 'Change of Contact Details' },
  { id: 'other', label: 'Other' },
];

/** The category that has to be written out rather than ticked. */
export const OTHER_CATEGORY = 'other';

/** How much may be written against Other. */
export const NOTE_LIMIT = 1000;

/**
 * What the first step of the dashboard reference work plan records.
 *
 * complete is the step's own verdict on itself, and it is what the wizard holds
 * the Save button against. It is worked out here rather than in the shell
 * because only the step knows what its answers imply: whether categories are
 * needed at all depends on the answer before them, and whether a note is needed
 * depends on one of the categories.
 */
export interface DashboardReferenceOutcome {
  /** The reference the caller read out, e.g. PMR12345678910. */
  reference: string;
  /** Whether this record is the caller. Null until the rep says. */
  decision: MatchDecision | null;
  /** Whether the decision leaves anything to do. Null until the rep says. */
  actions: DecisionActions | null;
  /** The categories of change, by id, where there are actions. */
  categories: string[];
  /** What was written against Other, empty unless Other is one of them. */
  note: string;
  /** Whether every answer the step needs has been given. */
  complete: boolean;
}
