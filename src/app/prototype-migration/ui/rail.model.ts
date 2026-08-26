/**
 * The rail buttons a build can offer.
 *
 * The ids are the rail's own, matching the block classes in its markup, so a
 * button and its switch are recognisably the same thing when reading either.
 */
export type RailItemId =
  | 'home'
  | 'search'
  | 'group-summary'
  | 'enquiry'
  | 'business-processes';

/** What the config says about one button. */
export interface RailItem {
  /**
   * Whether this build offers the button at all.
   *
   * A false here is final: it is how a release branch drops a button its
   * audience has no use for. A true is not final, because some buttons lead
   * somewhere that has to exist first, and that is decided from what is in
   * play rather than from this file.
   */
  show: boolean;
}

/** The rail config as its JSON holds it. */
export interface RailConfig {
  items: Partial<Record<RailItemId, RailItem>>;
}
