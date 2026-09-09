import { Injectable } from '@angular/core';

export interface ScriptOption {
  key: string;
  text: string;
}

export interface ScriptUnit {
  unitId: string;
  version: number;
  kind: 'prompt' | 'question' | 'manual' | 'automated' | 'action';
  body?: string;
  prompt?: string;
  label?: string;
  actionType?: string;
  options?: ScriptOption[];
  outcomes?: string[];
  optionLabels?: Record<string, string>;
  styling?: Record<string, string>;
  aggregateFlag?: {
    outputKey: string;
    trueWhenAny: string[];
  };
  subChecks?: Array<{
    key: string;
    label: string;
  }>;
  subOutcomeMap?: Record<string, string>;
  placeholders?: Array<{
    key: string;
    source: string;
    path: string;
    format?: string;
  }>;
}

export interface ScriptContentItem {
  id: string;
  ref?: string;
  inline?: ScriptUnit;
  visibleWhen?: string;
}

export interface ScriptOnEnter {
  kind: 'check' | 'waypoint';
  ref?: string;
  id?: string;
  aggregate?: 'all-pass' | 'tri-state' | 'single-joint';
  source?: string;
}

export interface ScriptRoute {
  when?: string;
  to: string;
  onEnter?: string[];
}

export interface ScriptButton {
  key: string;
  kind: 'auto' | 'next' | 'back' | 'custom' | 'end';
  label?: string;
  visibleWhen?: string;
  enabledWhen?: string;
  onClick?: string[];
  routes?: ScriptRoute[];
}

export interface ScriptCallFlow {
  ref: string;
  version?: number;
  args?: Record<string, unknown>;
}

export interface ScriptStep {
  stepId: string;
  version: number;
  title?: string;
  onEnter?: ScriptOnEnter[];
  content?: ScriptContentItem[];
  buttons?: ScriptButton[];
  callFlow?: ScriptCallFlow;
  onExit?: Record<string, string>;
}

export interface FlowLink {
  ref: string;
  version: number;
}

export interface CallRepScript {
  scriptId: string;
  version: number;
  title: string;
  libraryVersion: string;
  startStepId: string;
  steps: ScriptStep[];
  flows: Record<string, FlowLink>;
  units: Record<string, ScriptUnit>;
}

export interface CallableFlow {
  version: number;
  scriptId: string;
  title: string;
  terminal: boolean;
  params: Array<{
    key: string;
    required: boolean;
    type: string;
    note?: string;
  }>;
  exits: string[];
  startStepId: string;
  steps: ScriptStep[];
  units: Record<string, ScriptUnit>;
}

export interface CheckResult {
  raw?: string;
  outcome?: string;
  detail?: Record<string, unknown>;
  version?: number;
  source?: string;
  status?: string;
  [key: string]: unknown;
}

export type CheckResults = Record<string, CheckResult>;

export interface PlayerOptions {
  debugMode: boolean;
  showScriptInFirstStep: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CallRepScriptService {
  private readonly runtimePath = 'assets/data/call-rep-scripts/surrender';
  private readonly scriptCache = new Map<string, CallRepScript>();
  private checksCache: CheckResults | null = null;
  private readonly flowCache = new Map<string, CallableFlow>();
  private playerOptionsCache: PlayerOptions | null = null;

  async getPlayerOptions(): Promise<PlayerOptions> {
    if (this.playerOptionsCache) {
      return this.playerOptionsCache;
    }

    try {
      const response = await fetch('assets/data/call-rep-scripts/player-options.json');
      if (!response.ok) {
        throw new Error(`Failed to load player options: ${response.status}`);
      }

      const options = (await response.json()) as Partial<PlayerOptions>;
      this.playerOptionsCache = {
        debugMode: options.debugMode === true,
        showScriptInFirstStep: options.showScriptInFirstStep !== false
      };
    } catch (err) {
      console.error('Failed to load player options:', err);
      this.playerOptionsCache = {
        debugMode: false,
        showScriptInFirstStep: true
      };
    }

    return this.playerOptionsCache;
  }

  async getScript(scriptId: string): Promise<CallRepScript | null> {
    if (scriptId !== 'surrender-001') {
      return null;
    }

    const cached = this.scriptCache.get(scriptId);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.runtimePath}/surrender.bundle.json`);
      if (!response.ok) {
        throw new Error(`Failed to load script bundle: ${response.status}`);
      }

      const script = (await response.json()) as CallRepScript;
      this.scriptCache.set(scriptId, script);
      return script;
    } catch (err) {
      console.error(`Failed to load script ${scriptId}:`, err);
      return null;
    }
  }

  async getChecks(): Promise<CheckResults | null> {
    if (this.checksCache) {
      return this.checksCache;
    }

    try {
      const response = await fetch(`${this.runtimePath}/surrender.checks.json`);
      if (!response.ok) {
        throw new Error(`Failed to load checks: ${response.status}`);
      }

      const checks = (await response.json()) as CheckResults;
      this.checksCache = checks;
      return checks;
    } catch (err) {
      console.error('Failed to load surrender checks:', err);
      return null;
    }
  }

  async getFlow(ref: string, version = 1): Promise<CallableFlow> {
    const cacheKey = `${ref}.v${version}`;
    const cached = this.flowCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.runtimePath}/flows/${cacheKey}.json`);
      if (!response.ok) {
        return this.createStubFlow(ref);
      }

      const flow = (await response.json()) as CallableFlow;
      this.flowCache.set(cacheKey, flow);
      return flow;
    } catch {
      return this.createStubFlow(ref);
    }
  }

  private createStubFlow(ref: string): CallableFlow {
    return {
      version: 1,
      scriptId: ref,
      title: `${ref} (stub)`,
      terminal: true,
      params: [],
      exits: [],
      startStepId: 'stub-end',
      steps: [
        {
          stepId: 'stub-end',
          version: 1,
          title: `${ref} is not available`,
          content: [
            {
              id: 'stub-message',
              inline: {
                unitId: `stub.${ref}`,
                version: 1,
                kind: 'prompt',
                body: 'This callable flow is not available for the local Surrender walkthrough.'
              }
            }
          ],
          buttons: [
            {
              key: 'end',
              kind: 'end',
              label: 'End call'
            }
          ]
        }
      ],
      units: {}
    };
  }
}
