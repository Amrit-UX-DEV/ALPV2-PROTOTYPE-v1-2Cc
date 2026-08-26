import { ContextKind } from '../context/prototype-context.model';

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
  /**
   * Whether this build offers the plan at all.
   *
   * develop offers every plan there is. A release branch turns off the ones its
   * audience has no use for, and turning off the last plan that needs no
   * context is what makes business processes a context-driven button.
   */
  show: boolean;
  /**
   * The context the plan needs before it can be run, absent where it needs
   * none.
   *
   * Script management is about scripts, not about whoever is on the phone, so
   * it runs from anywhere. The dashboard reference plan is about one reference,
   * so without one there is nothing for it to be about: it is not offered, and
   * the rail does not offer a way to reach it.
   *
   * 'possible-match' is the dashboard reference context. The screen was renamed
   * and the context kind was not; renaming it is a change of its own, touching
   * the context index and the data files named after it.
   */
  requiresContext?: ContextKind;
}

/** How the hub itself behaves. */
export interface WorkPlanHub {
  /**
   * Whether the hub is a screen a rep always lands on.
   *
   * True on develop, where the hub is part of what is being shown. False on a
   * build cut down to one runnable plan, where a list of one is a screen that
   * asks a question with a single answer: business processes then goes straight
   * into that plan and the hub is never drawn.
   */
  alwaysShow: boolean;
}

/** The work plan index: what the hub is called, how it behaves, and the plans. */
export interface WorkPlanIndex {
  heading: string;
  hub: WorkPlanHub;
  plans: WorkPlan[];
}
