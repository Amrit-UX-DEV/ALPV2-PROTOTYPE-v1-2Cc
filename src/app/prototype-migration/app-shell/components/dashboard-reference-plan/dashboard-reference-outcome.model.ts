/** What the rep decided about the record behind a dashboard reference. */
export type MatchDecision = 'matched' | 'not-matched';

/**
 * What the first step of the dashboard reference work plan records.
 *
 * It is the whole of what the plan saves, so the confirmation reads it back
 * from here rather than going to the context again: the rep should be shown
 * what was recorded, not what happens to be on screen afterwards.
 */
export interface DashboardReferenceOutcome {
  /** The reference the caller read out, e.g. PMR12345678910. */
  reference: string;
  /** The pension it resolved to, which is a policy of ours. */
  pensionReference: string;
  /** The name on the other platform's record. */
  record: string;
  /** Nothing was supplied on the call, which is an answer in itself. */
  noChanges: boolean;
  /** The fields the rep supplied or corrected, by their names on the comparison. */
  supplied: string[];
  /** Whether this record is the caller. Null until the rep says. */
  decision: MatchDecision | null;
}
