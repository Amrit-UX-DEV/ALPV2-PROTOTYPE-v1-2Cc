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
  /**
   * What selecting this party puts the app into. Defaults to 'client'; a
   * servicing agent is an 'agent'. It is what lets one list hold everyone
   * attached to the policy without flattening the distinction between them.
   */
  scope?: ContextScope;
  /**
   * Whether this party appears as a linked-client indicator on the policy row.
   *
   * Only the lives and holders are drawn on the row; a servicing agent or a
   * beneficiary is attached to the policy but is not one of its linked
   * members, and has no indicator to reveal.
   */
  linked?: boolean;
  /** Absent or empty means this client is not flagged for extra care. */
  extraCare?: ExtraCareEntry[];
  /**
   * What we hold about this client, as distinct from what another platform
   * holds. Every field is optional because our record is often partial too, and
   * a comparison has to be able to say that neither side holds something.
   */
  /**
   * The name in parts, where a comparison needs it that way. name stays the
   * display form, because splitting 'Mr Joe Bloggs' back up is guesswork.
   */
  givenName?: string;
  surname?: string;
  dateOfBirth?: string;
  niNumber?: string;
  email?: string;
  phoneNumber?: string;
  address?: ContextAddress;
}

/**
 * An address as we hold it.
 *
 * Lines are a list rather than line1 to line5, because ours is our own shape
 * and nothing here needs to count to five.
 */
export interface ContextAddress {
  lines: string[];
  postcode: string;
  countryCode?: string;
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

/**
 * What kind of thing is currently selected.
 *
 * Selecting something is what puts the prototype into a context: choose a
 * client and the app is in client context, choose the policy and it is in
 * policy context, and so on. The hierarchy is a group wrapping clients and
 * policies, where a client may hold several policies.
 */
export type ContextScope = 'group' | 'policy' | 'client' | 'agent';

export interface ContextSelection {
  scope: ContextScope;
  /** Identity key of the selected thing, e.g. 'MrJoeBloggs' for a client. */
  key: string;
}

/**
 * What kind of context the app is in.
 *
 * 'none' is a context in its own right, not the absence of one: before
 * anything has been searched the app is in no context, and screens are
 * expected to say so rather than render an empty policy. Every other kind
 * names the thing the context is about.
 *
 * 'possible-match' is not a scope, because nothing in it can be selected: it
 * describes partial data held against a reference a caller has given, which may
 * or may not turn out to be someone on the system. It has no policy of its own,
 * so screens that read a policy must not be shown for it.
 */
export type ContextKind = ContextScope | 'none' | 'possible-match';

/**
 * The journey this context runs.
 *
 * Two policies can present the same screens and still need different call
 * handling, so the journey belongs to the context rather than to the widget.
 * scriptId points at an entry in call-rep-scripts/index.json.
 */
export interface ContextJourney {
  scriptId: string;
  /** Shown where the journey is named, e.g. 'Surrender Request'. */
  title: string;
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
  /**
   * What this context is about. Defaults to 'policy' when a file omits it,
   * since every context file so far describes a policy.
   */
  kind?: ContextKind;
  /**
   * What the header calls this context, e.g. 'No Context'. Only needed where
   * there is no policy to summarise.
   */
  label?: string;
  /**
   * What was keyed to find this context, e.g. 'PMR12345678910'.
   *
   * Held here so a screen can show the reference on its own. The label reads as
   * a sentence for the header, and picking the reference back out of it would
   * tie the screen to how the header happens to be worded.
   */
  reference?: string;
  /**
   * Absent in no context. Screens that show policy detail check for it rather
   * than rendering a blank policy.
   */
  policy?: ContextPolicy;
  /**
   * For a possible match: the reference of the policy the other platform's
   * pension reference names.
   *
   * A possible match holds no policy of its own, but the caller still has to be
   * taken through DPA, and DPA needs a policy. Naming the reference here rather
   * than copying the policy in keeps one copy of it, and activating the context
   * brings that policy with it.
   */
  pensionReference?: string;
  /**
   * For a possible match: the other platform's record, as a file within
   * POSSIBLE_MATCH_DATA_PATH. Their payload is kept out of our context file
   * because it is their contract, on their field names.
   */
  record?: string;
  screen: ContextScreen;
  journey?: ContextJourney;
}

/**
 * One searchable entry in the context registry.
 *
 * The registry is what makes contexts findable. It holds only what a search
 * needs to match on and where the context lives, so looking up a policy costs
 * one small file rather than every context in the prototype.
 */
export interface ContextIndexEntry {
  /** Context id, and the file name without .json, e.g. 'policy-80007'. */
  id: string;
  /** File within CONTEXT_DATA_PATH. Held explicitly so ids can outlive names. */
  file: string;
  kind: ContextKind;
  /**
   * Which search criteria this entry answers to, matching the values in the
   * Search Criteria dropdown, e.g. 'Policy'.
   */
  criteria: string;
  /** What has to be keyed to find it, e.g. '80007'. */
  reference: string;
  /** Product description, for showing a match before it is loaded. */
  label: string;
  company: string;
  /** Client names, so a search by client can find the policy. */
  clients: string[];
  /** scriptId of the journey this context runs. */
  journey?: string;
}

export interface ContextIndex {
  version: string;
  lastUpdated: string;
  contexts: ContextIndexEntry[];
}
