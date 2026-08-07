export type ContentType = 'prompt' | 'question' | 'required-check' | 'log-task' | 'end-call';
export type SelectionMode = 'single' | 'multi';

export interface ScriptOption {
  text: string;
  nextStep?: string;
}

export interface RequiredCheckItem {
  question: string;
  answer?: string;
  auto?: boolean;
  manual?: boolean;
  selectionMode?: SelectionMode;
  options?: ScriptOption[];
}

export interface ContentCondition {
  dependsOn: string;
  answers?: string[];
}

export interface ContentBlock {
  id: string;
  order: number;
  type: ContentType;
  content: string;
  selectionMode?: SelectionMode;
  options?: ScriptOption[];
  requiredChecks?: RequiredCheckItem[];
  condition?: ContentCondition;
}

export interface StepActivity {
  createdAt?: number;
  contentEditedAt?: number;
  orderChangedAt?: number;
}

export interface ScriptStep {
  id: string;
  order: number;
  title: string;
  hideTitleInJourney: boolean;
  content: ContentBlock[];
  activity?: StepActivity;
}

export interface ScriptSetupSelection {
  mode: 'new' | 'edit';
  scriptId?: string;
  /** Filename key used under assets/data/call-rep-scripts/ */
  scriptFileId?: string;
  scriptName: string;
  scriptDescription: string;
  productId: string;
  productLabel: string;
  requestTypeId: string;
  requestTypeLabel: string;
}

export interface ScriptDefinition {
  scriptId: string;
  title: string;
  description?: string;
  category?: string;
  lastUpdated?: string;
  isPrimaryScript?: boolean;
  steps: ScriptStep[];
}

/** Shape of the front-office journey JSON (shared file) */
export interface JourneyScriptOption {
  text: string;
  nextStep?: string;
}

export interface JourneyRequiredCheck {
  question?: string;
  answer?: string;
  auto?: boolean;
  manual?: boolean;
  selectionMode?: SelectionMode;
  options?: JourneyScriptOption[];
  text?: string;
}

export interface JourneyStep {
  id: string;
  title?: string;
  question?: string;
  scriptedReply?: string;
  selectionMode?: SelectionMode;
  options?: JourneyScriptOption[];
  requiredChecks?: Array<string | JourneyRequiredCheck>;
  actions?: string[];
  endCall?: boolean;
}

export interface JourneyScriptFile {
  scriptId: string;
  title: string;
  description?: string;
  category?: string;
  lastUpdated?: string;
  steps: JourneyStep[];
}