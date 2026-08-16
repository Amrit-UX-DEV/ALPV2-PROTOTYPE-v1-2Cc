/**
 * The shape of a prototype "context": the policy, its clients and the screen
 * the user is looking at.
 *
 * Everything the prototype currently hard-codes about a situation belongs
 * here, so a demo becomes a JSON file rather than a markup edit.
 *
 * One constraint drives several of the fields below. The prototype's jQuery
 * and stylesheets select clients by identity class (ux-MrJoeBloggs) and by
 * client id (client-id="ux02"), so those are data, not presentation. Rendering
 * a client without them would leave the interaction layer unable to find it.
 */

export interface ContextCurrency {
  /** Display name, e.g. 'UK Sterling'. */
  label: string;
  /** Symbol rendered in .ui-currency-icon, e.g. '£'. */
  symbol: string;
}

export interface ContextPolicy {
  /** Bare number, e.g. '80007'. Rendered as "Policy 80007". */
  number: string;
  /** e.g. 'Group Stakeholder Pen Plan Pre Nov 04'. */
  productName: string;
  /** e.g. 'In Force', 'On Hold'. */
  status: string;
  /** e.g. 'Great Britain'. */
  territory: string;
  currency: ContextCurrency;
}

/**
 * One reason a client is flagged as needing extra care. The presence of any
 * entry is what makes the Extra Care affordances appear.
 */
export interface ExtraCareEntry {
  /** e.g. 'Health- Hearing'. */
  type: string;
  /** How it was notified, e.g. 'Phone'. */
  method: string;
  /** e.g. '21 Aug 2025'. */
  notified: string;
  /** e.g. 'Permanent'. */
  stop: string;
  /** The accommodation to make, e.g. 'Speak Slower / Louder'. */
  helpingHand: string;
}

export interface ContextClient {
  /** Value for the client-id attribute, e.g. 'ux02'. */
  id: string;
  /** Identity key; the markup uses it as the class ux-{key}, e.g. 'MrJoeBloggs'. */
  key: string;
  /** Display name, e.g. 'Mr Joe Bloggs'. */
  name: string;
  /** e.g. ['Life 1', 'Payer']. */
  roles: string[];
  /** Absent or empty means this client is not flagged for extra care. */
  extraCare?: ExtraCareEntry[];
}

export interface ContextScreen {
  /** Breadcrumb trail, e.g. ['Search', 'Group Summary']. */
  breadcrumbs: string[];
  /** Text before the context summary in the h1, e.g. 'Group Summary:'. */
  headingPrefix: string;
}

export interface PrototypeContext {
  /** Identifier for this context file, e.g. 'policy-80007'. */
  id: string;
  policy: ContextPolicy;
  clients: ContextClient[];
  screen: ContextScreen;
}
