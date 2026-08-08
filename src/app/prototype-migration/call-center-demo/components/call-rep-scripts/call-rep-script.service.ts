import { Injectable, signal } from '@angular/core';

export interface ScriptOption {
  text: string;
  nextStep?: string;
  nextScriptId?: string;
}

export interface RequiredCheck {
  question?: string;
  answer?: string;
  text?: string;
  auto?: boolean;
  selectionMode?: 'single' | 'multi';
  options?: ScriptOption[];
}

export interface ScriptElement {
  id: string;
  order: number;
  type: 'prompt' | 'question' | 'required-check' | 'action';
  content: string;
  variables?: string[];
  selectionMode?: 'single' | 'multi';
  options?: ScriptOption[];
  requiredChecks?: RequiredCheck[];
  actionType?: string;
  condition?: {
    dependsOn: string;
    answer: string;
  };
}

export interface ScriptStep {
  id: string;
  order?: number;
  content: ScriptElement[];
}

export interface CallRepScript {
  scriptId: string;
  title: string;
  description: string;
  category: string;
  lastUpdated: string;
  isPrimaryScript: boolean;
  nextScriptIds?: string[];
  steps: ScriptStep[];
}

@Injectable({
  providedIn: 'root'
})
export class CallRepScriptService {

  private readonly cache = new Map<string, CallRepScript>();

  readonly scriptsIndex = signal<any[]>([]);

  constructor() {
    this.loadScriptsIndex();
  }

  private async loadScriptsIndex(): Promise<void> {
    try {
      const response = await fetch('assets/data/call-rep-scripts/index.json?t=' + Date.now());
      if (!response.ok) throw new Error('Failed to load index');
      const data = await response.json();
      this.scriptsIndex.set(data.scripts || []);
    } catch (err) {
      console.error('Failed to load scripts index:', err);
    }
  }

  async getScript(scriptId: string): Promise<CallRepScript | null> {
    if (this.cache.has(scriptId)) {
      return this.cache.get(scriptId)!;
    }

    const indexEntry = this.scriptsIndex().find(s => s.scriptId === scriptId);
    if (!indexEntry?.filename) {
      console.warn(`Script not found in index: ${scriptId}`);
      return null;
    }

    try {
      const response = await fetch(`assets/data/call-rep-scripts/${indexEntry.filename}`);
      if (!response.ok) throw new Error(`Failed to load script file`);

      const script: CallRepScript = await response.json();
      script.lastUpdated = indexEntry.lastUpdated || '';

      this.cache.set(scriptId, script);
      return script;
    } catch (err) {
      console.error(`Failed to load script ${scriptId}:`, err);
      return null;
    }
  }
}