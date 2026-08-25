/**
 * One business process a rep can work through, as the work plan index lists it.
 *
 * A work plan is a wizard, and the wizard is already described by its own JSON
 * config, so this holds only what the hub needs to offer the plan and where its
 * config lives. Nothing here knows what the steps are.
 */
export interface WorkPlan {
  id: string;
  /** What the tile, the heading and the breadcrumb call it. */
  name: string;
  description: string;
  /** A Font Awesome class list, e.g. 'fas fa-clipboard-check'. */
  icon: string;
  /** How many steps it runs to, so a rep can see the size of it before starting. */
  stepCount: number;
  /** Where the wizard shell reads the plan's own config from. */
  configUrl: string;
  /** What has to be in context first, where a plan needs something to work on. */
  note?: string;
}

/** The work plan index: the hub's own wording, and the plans it offers. */
export interface WorkPlanIndex {
  heading: string;
  lead: string;
  plans: WorkPlan[];
}
