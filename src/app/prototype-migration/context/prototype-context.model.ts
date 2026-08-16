/**
 * The shape of a prototype "context": the policy, the clients attached to it
 * and the screen the user is looking at.
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
  /**
   * Value for the client-id attribute, e.g. 'ux02'. Optional because not every
   * client has a tile of its own; some appear only as a linked-client
   * indicator on the policy, and those carry no client-id in the markup.
   */
  id?: string;
  /**
   * Identity key. The markup needs it in two shapes that differ by a hyphen:
   * the class is ux-{key} and the linked-clients token is ux{key}. Store the
   * bare key and let the template build both, so they cannot drift apart.
   */
  key: string;
  /** Display name, e.g. 'Mr Joe Bloggs'. */
  name: string;
  /** e.g. ['Policy Holder', 'Life 1']. Rendered joined by ', '. */
  roles: string[];
  /** Absent or empty means this client is not flagged for extra care. */
  extraCare?: ExtraCareEntry[];
}

/**
 * A policy and the clients attached to it.
 *
 * Clients are nested rather than held in a flat list because attachment is the
 * thing the screens actually render: the group summary draws a policy and the
 * clients linked to it. A scheme owns clients too, but the scheme is not
 * modelled yet, so it stays as markup for now.
 */
export interface ContextPolicy {
  /** Bare number, e.g. '80007'. Rendered as "Policy 80007". */
  number: string;
  /** Product description, e.g. 'Group Stakeholder Pen Plan Pre Nov 04'. */
  productName: string;
  /** Provider shown as "Company", e.g. 'HSBC (LifePen)'. */
  company: string;
  /** e.g. 'Unit Linked'. */
  policyType: string;
  /** e.g. 'In Force', 'On Hold'. */
  status: string;
  /** e.g. 'Great Britain'. */
  territory: string;
  currency: ContextCurrency;
  /**
   * Order matters. It is the order the linked-client indicators render in and
   * the order of the tokens in the row's linked-clients attribute.
   */
  clients: ContextClient[];
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
  screen: ContextScreen;
}
