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
  /** A Font Awesome class list, e.g. 'fas fa-clipboard-check'. */
  icon: string;
  /** Where the wizard shell reads the plan's own config from. */
  configUrl: string;
}

/** The work plan index: what the hub is called, and the plans it offers. */
export interface WorkPlanIndex {
  heading: string;
  plans: WorkPlan[];
}
