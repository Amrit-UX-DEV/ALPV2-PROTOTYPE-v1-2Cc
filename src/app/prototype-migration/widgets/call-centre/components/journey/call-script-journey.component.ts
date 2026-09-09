import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CallRepScript,
  CallRepScriptService,
  CallableFlow,
  CheckResult,
  CheckResults,
  PlayerOptions,
  ScriptButton,
  ScriptContentItem,
  ScriptOnEnter,
  ScriptOption,
  ScriptStep,
  ScriptUnit
} from './call-rep-script.service';

interface FlowFrame {
  flow: CallableFlow | null;
  stepId: string;
  args: Record<string, unknown>;
  onExit?: Record<string, string>;
}

interface RenderedItem {
  id: string;
  kind: ScriptUnit['kind'];
  content: string;
  options: ScriptOption[];
  optionLabels?: Record<string, string>;
}

interface RenderedCheck {
  ref: string;
  label: string;
  outcome: string;
}

interface DebugButton {
  label: string;
  target: string;
}

interface DebugCheck {
  id: string;
  value: string;
}

interface DefaultedCheck {
  id: string;
  label: string;
}

@Component({
  selector: 'alpha-call-script-journey',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-script-journey.component.html'
})
export class CallScriptJourneyComponent implements OnInit {
  private readonly scriptService = inject(CallRepScriptService);

  @Input() scriptId = 'surrender-001';

  readonly script = signal<CallRepScript | null>(null);
  readonly currentStepId = signal<string | null>(null);
  readonly activeFlow = signal<CallableFlow | null>(null);
  readonly flowArgs = signal<Record<string, unknown>>({});
  readonly flowStack = signal<FlowFrame[]>([]);
  readonly navigationHistory = signal<FlowFrame[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly showSummary = signal(false);

  readonly userAnswers = signal<Map<string, string>>(new Map());
  readonly checkResults = signal<CheckResults>({});
  readonly completedChecks = signal<Set<string>>(new Set());
  readonly completedActions = signal<string[]>([]);
  readonly waypoints = signal<Map<string, string>>(new Map());
  // Running history of checks evaluated anywhere on this journey.
  readonly screenChecks = signal<RenderedCheck[]>([]);
  readonly defaultedChecks = signal<DefaultedCheck[]>([]);
  readonly showCheckPopover = signal(false);
  readonly playerOptions = signal<PlayerOptions>({
    debugMode: false,
    showScriptInFirstStep: true
  });
  readonly checksPath = 'assets/data/call-rep-scripts/surrender/surrender.checks.json';
  readonly lastCheck = signal<{ id: string; result: string } | null>(null);
  readonly missingRouteTargets = signal<string[]>([]);

  readonly currentSteps = computed(() => this.activeFlow()?.steps ?? this.script()?.steps ?? []);
  readonly currentUnits = computed(() => this.activeFlow()?.units ?? this.script()?.units ?? {});
  readonly currentStep = computed(() => {
    const stepId = this.currentStepId();
    return stepId ? this.currentSteps().find(step => step.stepId === stepId) ?? null : null;
  });
  readonly currentStepIndex = computed(() => {
    const stepId = this.currentStepId();
    return stepId ? this.currentSteps().findIndex(step => step.stepId === stepId) : -1;
  });
  readonly sortedContent = computed(() => {
    const step = this.currentStep();
    return (step?.content ?? [])
      .map(item => this.renderContentItem(item))
      .filter((item): item is RenderedItem => item !== null);
  });
  readonly visibleButtons = computed(() => {
    const step = this.currentStep();
    return (step?.buttons ?? []).filter(button => button.kind !== 'auto' && this.isExpressionMet(button.visibleWhen));
  });
  readonly debugUnitIds = computed(() =>
    (this.currentStep()?.content ?? []).map(item => item.ref ?? item.inline?.unitId ?? item.id)
  );
  readonly debugButtons = computed<DebugButton[]>(() => {
    const step = this.currentStep();
    if (!step) {
      return [];
    }

    const buttons = (step.buttons ?? []).map(button => ({
      label: button.label ?? button.kind,
      target: button.routes?.map(route => route.to).join(' | ') || 'no route'
    }));
    if (step.callFlow) {
      buttons.push({
        label: 'callFlow',
        target: step.callFlow.ref
      });
    }
    return buttons;
  });
  readonly debugChecks = computed<DebugCheck[]>(() =>
    Object.entries(this.checkResults())
      .filter(([id]) => id.startsWith('chk.'))
      .flatMap(([id, result]) => {
        const unit = this.resolveUnit(id);
        const subChecks = this.getSubChecks(unit);
        if (!subChecks?.length) {
          return [{
            id,
            value: this.formatDebugCheckResult(id, result)
          }];
        }
        return subChecks.map(subCheck => {
          const raw = this.resolveSubCheckValue(id, subCheck.key);
          const defaulted = raw === undefined || raw === null;
          return {
            id: `${id}.${subCheck.key}`,
            value: `${this.formatSubCheckOutcome(unit, raw)}${defaulted ? ' (defaulted)' : ''}`
          };
        });
      })
  );
  readonly nextBlockedReason = computed(() => {
    const next = this.currentStep()?.buttons?.find(button =>
      button.kind === 'next' || button.key === 'next'
    );
    if (!next || this.isButtonEnabled(next)) {
      return '';
    }
    return next.enabledWhen
      ? `enabledWhen "${next.enabledWhen}" is false`
      : 'button is disabled';
  });

  async ngOnInit(): Promise<void> {
    await this.loadScript();
  }

  async loadScript(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.showSummary.set(false);
    this.currentStepId.set(null);
    this.activeFlow.set(null);
    this.flowStack.set([]);
    this.navigationHistory.set([]);
    this.userAnswers.set(new Map());
    this.checkResults.set({});
    this.completedChecks.set(new Set());
    this.completedActions.set([]);
    this.waypoints.set(new Map());
    this.screenChecks.set([]);
    this.defaultedChecks.set([]);
    this.showCheckPopover.set(false);
    this.playerOptions.set(await this.scriptService.getPlayerOptions());
    this.lastCheck.set(null);
    this.missingRouteTargets.set([]);

    try {
      const [loaded, checks] = await Promise.all([
        this.scriptService.getScript(this.scriptId),
        this.scriptService.getChecks()
      ]);

      if (!loaded || !checks) {
        throw new Error(`Failed to load Surrender runtime data`);
      }

      this.script.set(loaded);
      this.checkResults.set(checks);
      const flows = await Promise.all(
        Object.values(loaded.flows).map(link => this.scriptService.getFlow(link.ref, link.version))
      );
      this.missingRouteTargets.set(this.findMissingRouteTargets(loaded, flows));
      await this.enterStep(loaded.startStepId);
    } catch (err) {
      console.error(err);
      this.loadError.set(`Failed to load script: ${this.scriptId}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectOption(option: ScriptOption, itemId: string): void {
    this.userAnswers.update(answers => {
      const next = new Map(answers);
      next.set(itemId, option.key);
      return next;
    });
  }

  selectManualCheck(option: ScriptOption, itemId: string): void {
    this.selectOption(option, itemId);
  }

  isOptionSelected(optionKey: string, itemId: string): boolean {
    return this.userAnswers().get(itemId) === optionKey;
  }

  isButtonEnabled(button: ScriptButton): boolean {
    return this.isExpressionMet(button.enabledWhen);
  }

  async runButton(button: ScriptButton): Promise<void> {
    if (!this.isButtonEnabled(button)) {
      return;
    }

    if (button.kind === 'back') {
      this.goBack();
      return;
    }

    this.fireActions(button.onClick);
    if (button.kind === 'end' && !button.routes?.length) {
      this.finishJourney();
      return;
    }

    const route = button.routes?.find(candidate => this.isExpressionMet(candidate.when));
    if (!route) {
      if (button.kind === 'end') {
        this.finishJourney();
      } else {
        this.loadError.set(`No matching route for button: ${button.key}`);
      }
      return;
    }

    this.fireActions(route.onEnter);
    this.appendCheckHistory(this.checksReferencedBy(route.when));
    const checksUsedForRoute = this.screenChecks();
    if (route.to === '@end') {
      this.finishJourney();
      return;
    }

    if (route.to.startsWith('@exit:')) {
      await this.returnFromFlow(route.to.slice('@exit:'.length), checksUsedForRoute);
      return;
    }

    this.pushCurrentLocation();
    await this.enterStep(route.to, checksUsedForRoute);
  }

  goBack(): void {
    const previous = this.navigationHistory().at(-1);
    if (!previous) {
      return;
    }

    this.navigationHistory.update(history => history.slice(0, -1));
    this.activeFlow.set(previous.flow);
    this.flowArgs.set(previous.args);
    this.currentStepId.set(previous.stepId);
  }

  finishJourney(): void {
    this.showSummary.set(true);
    console.log('Script Journey Completed', {
      scriptId: this.script()?.scriptId,
      answers: Object.fromEntries(this.userAnswers()),
      completedChecks: Array.from(this.completedChecks()),
      completedActions: this.completedActions()
    });
  }

  restartJourney(): void {
    void this.loadScript();
  }

  openCheckPopover(): void {
    this.showCheckPopover.set(true);
  }

  closeCheckPopover(): void {
    this.showCheckPopover.set(false);
  }

  hasPreviousStep(): boolean {
    return this.navigationHistory().length > 0;
  }

  formatPrompt(text: string): string {
    if (!text) return '';

    return text
      .replace(/\. /g, '.<br><br>')
      .replace(/\? /g, '?<br><br>')
      .replace(/! /g, '!<br><br>')
      .replace(/£?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, match =>
        `<span class="alp-prompt-variable">${match}</span>`
      );
  }

  private async enterStep(stepId: string, incomingChecks: RenderedCheck[] = []): Promise<void> {
    const step = this.currentSteps().find(candidate => candidate.stepId === stepId);
    if (!step) {
      this.loadError.set(`Step not found: ${stepId}`);
      return;
    }

    this.currentStepId.set(stepId);
    const checksForStep = await this.runOnEnter(step);
    this.appendCheckHistory([...incomingChecks, ...checksForStep]);
    this.showCheckPopover.set(false);

    if (step.callFlow) {
      await this.enterFlow(step, this.screenChecks());
      return;
    }

    const autoButton = step.buttons?.find(button =>
      button.kind === 'auto' && this.isExpressionMet(button.visibleWhen) && this.isButtonEnabled(button)
    );
    if (autoButton) {
      await this.runButton(autoButton);
    }
  }

  private async enterFlow(callerStep: ScriptStep, incomingChecks: RenderedCheck[]): Promise<void> {
    const script = this.script();
    const callFlow = callerStep.callFlow;
    if (!script || !callFlow) {
      return;
    }

    const link = script.flows[callFlow.ref];
    const flow = await this.scriptService.getFlow(callFlow.ref, callFlow.version ?? link?.version ?? 1);
    this.flowStack.update(stack => [
      ...stack,
      {
        flow: this.activeFlow(),
        stepId: callerStep.stepId,
        args: this.flowArgs(),
        onExit: callerStep.onExit
      }
    ]);
    this.activeFlow.set(flow);
    this.flowArgs.set(callFlow.args ?? {});
    await this.enterStep(flow.startStepId, incomingChecks);
  }

  private async returnFromFlow(exitName: string, incomingChecks: RenderedCheck[]): Promise<void> {
    const frame = this.flowStack().at(-1);
    if (!frame) {
      this.finishJourney();
      return;
    }

    this.flowStack.update(stack => stack.slice(0, -1));
    const targetStepId = frame.onExit?.[exitName];
    if (!targetStepId) {
      this.finishJourney();
      return;
    }

    this.activeFlow.set(frame.flow);
    this.flowArgs.set(frame.args);
    await this.enterStep(targetStepId, incomingChecks);
  }

  private pushCurrentLocation(): void {
    const stepId = this.currentStepId();
    if (!stepId) {
      return;
    }

    this.navigationHistory.update(history => [
      ...history,
      {
        flow: this.activeFlow(),
        stepId,
        args: this.flowArgs()
      }
    ]);
  }

  private renderContentItem(item: ScriptContentItem): RenderedItem | null {
    if (!this.isExpressionMet(item.visibleWhen)) {
      return null;
    }

    const unit = item.inline ?? (item.ref ? this.resolveUnit(item.ref) : undefined);
    if (!unit) {
      return {
        id: item.id,
        kind: 'prompt',
        content: `Missing unit: ${item.ref ?? item.id}`,
        options: []
      };
    }

    const options = unit.options ?? unit.outcomes?.map(key => ({
      key,
      text: unit.optionLabels?.[key] ?? key
    })) ?? [];

    return {
      id: item.id,
      kind: unit.kind,
      content: this.resolveUnitText(unit),
      options,
      optionLabels: unit.optionLabels
    };
  }

  private renderCheck(ref: string): RenderedCheck[] {
    const unit = this.resolveUnit(ref);
    const result = this.checkResults()[ref];
    const subChecks = this.getSubChecks(unit);
    if (subChecks?.length) {
      return subChecks.map(subCheck => this.renderSubCheck(ref, unit, subCheck));
    }
    return [{
      ref,
      label: unit?.label ?? ref,
      outcome: this.formatCheckResult(ref, result)
    }];
  }

  private renderSubCheck(
    parentRef: string,
    unit: ScriptUnit | undefined,
    subCheck: NonNullable<ScriptUnit['subChecks']>[number]
  ): RenderedCheck {
    const raw = this.resolveSubCheckValue(parentRef, subCheck.key);
    if (raw === undefined || raw === null) {
      // Missing bulk-child values default to false/No for display only.
      this.recordDefaultedCheck(parentRef, subCheck.key, subCheck.label);
      return {
        ref: `${parentRef}.${subCheck.key}`,
        label: subCheck.label,
        outcome: 'No'
      };
    }

    return {
      ref: `${parentRef}.${subCheck.key}`,
      label: subCheck.label,
      outcome: this.formatSubCheckOutcome(unit, raw)
    };
  }

  private resolveSubCheckValue(parentRef: string, key: string): unknown {
    const result = this.checkResults()[parentRef];
    const detailValue = result?.detail?.[key];
    if (detailValue !== undefined && detailValue !== null) {
      return detailValue;
    }
    const childResult = this.checkResults()[`${parentRef}.${key}`] ?? this.checkResults()[key];
    if (childResult?.outcome !== undefined) {
      return childResult.outcome;
    }
    if (childResult?.raw !== undefined) {
      return childResult.raw;
    }
    const directValue = result?.[key];
    return directValue !== undefined && directValue !== null ? directValue : undefined;
  }

  private formatSubCheckOutcome(unit: ScriptUnit | undefined, raw: unknown): string {
    if (raw === undefined || raw === null) {
      return 'No';
    }
    const mappedOutcome = this.getSubOutcomeMap(unit)?.[String(raw)];
    return mappedOutcome
      ?? (typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : String(raw));
  }

  private recordDefaultedCheck(parentRef: string, key: string, label: string): void {
    const id = `${parentRef}.${key}`;
    this.defaultedChecks.update(checks =>
      checks.some(check => check.id === id)
        ? checks
        : [...checks, { id, label }]
    );
  }

  private resolveUnit(ref: string): ScriptUnit | undefined {
    const resolvedRef = ref.replace(/\{\{([^}]+)}}/g, (_match, key: string) =>
      String(this.flowArgs()[key] ?? ref)
    );
    return this.currentUnits()[resolvedRef] ?? this.script()?.units[resolvedRef];
  }

  private resolveUnitText(unit: ScriptUnit): string {
    let body = unit.body ?? unit.prompt ?? unit.label ?? '';
    const resultByKey = new Map<string, unknown>();

    for (const placeholder of unit.placeholders ?? []) {
      resultByKey.set(placeholder.key, this.resolvePlaceholder(placeholder));
    }

    body = body.replace(/\{\{#([^}]+)}}([\s\S]*?)\{\{\/\1}}/g, (_match, key: string, content: string) =>
      this.asBoolean(resultByKey.get(key)) ? content : ''
    );
    return body.replace(/\{\{([^}]+)}}/g, (_match, key: string) =>
      String(resultByKey.get(key) ?? '')
    );
  }

  private resolvePlaceholder(placeholder: NonNullable<ScriptUnit['placeholders']>[number]): unknown {
    const result = this.checkResults()[placeholder.source];
    if (!result) {
      return '';
    }

    const detail = result.detail ?? {};
    const path = placeholder.path.replace(/^items\[0\]\.?/, '');
    const value = path ? this.getPathValue(detail, path) : undefined;
    if (value !== undefined) {
      return placeholder.format === 'currency-gbp' ? this.formatCurrency(value) : value;
    }

    return placeholder.format === 'currency-gbp' ? this.formatCurrency(result.outcome) : result.outcome ?? '';
  }

  private formatCurrency(value: unknown): string {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
      : String(value ?? '');
  }

  private getPathValue(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, value);
  }

  private async runOnEnter(step: ScriptStep): Promise<RenderedCheck[]> {
    const checks: RenderedCheck[] = [];
    for (const entry of step.onEnter ?? []) {
      if (entry.kind === 'check' && entry.ref) {
        this.ensureCheck(entry.ref);
        checks.push(...this.renderCheck(entry.ref));
      }
      const waypointId = entry.id;
      const source = entry.source;
      if (entry.kind === 'waypoint' && waypointId && source) {
        if (!checks.some(check => check.ref === source || check.ref.startsWith(`${source}.`))) {
          this.ensureCheck(source);
          checks.push(...this.renderCheck(source));
        }
        this.waypoints.update(points => {
          const next = new Map(points);
          next.set(waypointId, this.deriveWaypoint(entry, source));
          return next;
        });
      }
    }
    return checks;
  }

  private checksReferencedBy(expression: string | undefined): RenderedCheck[] {
    if (!expression) {
      return [];
    }

    const refs = new Set<string>();
    for (const match of expression.matchAll(/(chk\.[\w-]+)/g)) {
      refs.add(match[1]);
    }
    for (const match of expression.matchAll(/(wp-[\w-]+)/g)) {
      const waypoint = this.currentStep()?.onEnter?.find(entry => entry.id === match[1]);
      if (waypoint?.source) {
        refs.add(waypoint.source);
      }
    }
    return [...refs].flatMap(ref => this.renderCheck(ref));
  }

  private appendCheckHistory(checks: RenderedCheck[]): void {
    if (!checks.length) {
      return;
    }

    this.screenChecks.update(history => {
      const next = [...history];
      for (const check of checks) {
        const existingIndex = next.findIndex(existing => existing.ref === check.ref);
        if (existingIndex === -1) {
          next.push(check);
        } else {
          next[existingIndex] = check;
        }
      }
      return next;
    });
  }

  private ensureCheck(ref: string): void {
    const existing = this.checkResults()[ref];
    if (existing?.status === 'ok') {
      this.recordCheck(ref, existing);
      return;
    }

    const unit = this.resolveUnit(ref);
    const result = this.createStubCheck(unit);
    this.checkResults.update(results => ({ ...results, [ref]: result }));
    this.recordCheck(ref, result);
  }

  private createStubCheck(unit: ScriptUnit | undefined): CheckResult {
    const outcome = unit?.outcomes?.includes('No')
      ? 'No'
      : unit?.outcomes?.[0] ?? 'No';
    const aggregateFlag = this.getAggregateFlag(unit);
    const detail = aggregateFlag
      ? Object.fromEntries(aggregateFlag.trueWhenAny.map(key => [key, false]))
      : undefined;

    return {
      outcome,
      detail,
      source: 'local-stub',
      status: 'ok'
    };
  }

  private recordCheck(ref: string, result: CheckResult): void {
    const outcome = this.formatCheckResult(ref, result);
    this.lastCheck.set({ id: ref, result: outcome });
    this.completedChecks.update(checks => {
      const next = new Set(checks);
      next.add(`${ref}: ${outcome}`);
      return next;
    });
  }

  private formatCheckResult(ref: string, result: CheckResult | undefined): string {
    if (!result) {
      return 'No result';
    }
    if (result.status === 'error') {
      return `Error: ${String(result['error'] ?? 'check failed')}`;
    }
    if (result.outcome !== undefined) {
      return String(result.outcome);
    }

    const unit = this.resolveUnit(ref);
    const aggregateValue = this.resolveAggregateFlag(unit, result);
    if (aggregateValue !== undefined) {
      return aggregateValue ? 'Yes' : 'No';
    }
    const mappedOutcome = unit?.binding?.outcomeMap?.[String(result.raw)];
    if (mappedOutcome !== undefined) {
      return mappedOutcome;
    }
    if (this.getSubChecks(unit)?.length) {
      return this.formatBulkCheckResult(ref, unit);
    }
    if (result.detail) {
      return JSON.stringify(result.detail);
    }
    return result.status ?? 'No result';
  }

  private formatBulkCheckResult(ref: string, unit: ScriptUnit | undefined): string {
    const outcomes = (this.getSubChecks(unit) ?? []).map(subCheck =>
      this.formatSubCheckOutcome(unit, this.resolveSubCheckValue(ref, subCheck.key))
    );
    if (outcomes.includes('Yes')) {
      return 'Yes';
    }
    if (outcomes.every(outcome => outcome === 'No')) {
      return 'No';
    }
    return outcomes.join(', ') || 'No';
  }

  private formatDebugCheckResult(ref: string, result: CheckResult | undefined): string {
    const value = this.formatCheckResult(ref, result);
    return result?.detail ? `${value}; detail=${JSON.stringify(result.detail)}` : value;
  }

  private getAggregateFlag(unit: ScriptUnit | undefined): ScriptUnit['aggregateFlag'] | undefined {
    return unit?.aggregateFlag ?? unit?.binding?.aggregateFlag;
  }

  private getSubChecks(unit: ScriptUnit | undefined): ScriptUnit['subChecks'] | undefined {
    return unit?.subChecks ?? unit?.binding?.subChecks;
  }

  private getSubOutcomeMap(unit: ScriptUnit | undefined): ScriptUnit['subOutcomeMap'] | undefined {
    return unit?.subOutcomeMap ?? unit?.binding?.subOutcomeMap;
  }

  private resolveAggregateFlag(unit: ScriptUnit | undefined, result: CheckResult | undefined): boolean | undefined {
    const aggregateFlag = this.getAggregateFlag(unit);
    if (!aggregateFlag || !result?.detail) {
      return undefined;
    }

    const values = aggregateFlag.trueWhenAny.map(key => result.detail?.[key]);
    if (values.some(value => value === undefined)) {
      return undefined;
    }
    return values.some(value => this.asBoolean(value));
  }

  private deriveWaypoint(entry: ScriptOnEnter, source: string): string {
    const result = this.checkResults()[source];
    const unit = this.resolveUnit(source);
    if (!result || !unit) {
      return 'pass';
    }

    if (entry.aggregate === 'single-joint') {
      return result.outcome === undefined
        ? 'unknown'
        : result.outcome === 'Joint'
          ? 'amber'
          : 'pass';
    }

    let hasUnknown = false;
    const subChecks = this.getSubChecks(unit);
    const subOutcomeMap = this.getSubOutcomeMap(unit);
    const styles = subChecks?.map(check => {
      const raw = result.detail?.[check.key];
      if (raw === undefined) {
        hasUnknown = true;
        return 'unknown';
      }
      const outcome = subOutcomeMap?.[String(raw)] ?? String(raw ?? 'No');
      return unit.styling?.[outcome] ?? 'pass';
    }) ?? [];

    if (styles.includes('fail')) {
      return 'fail';
    }
    if (styles.includes('amber') || unit.styling?.[result.outcome ?? ''] === 'amber') {
      return 'amber';
    }
    if (hasUnknown) {
      return 'unknown';
    }
    return unit.styling?.[result.outcome ?? ''] ?? 'pass';
  }

  private fireActions(actions: string[] | undefined): void {
    if (!actions?.length) {
      return;
    }
    this.completedActions.update(completed => [...completed, ...actions]);
  }

  private findMissingRouteTargets(script: CallRepScript, flows: CallableFlow[]): string[] {
    const missing: string[] = [];
    const checkScope = (scope: string, steps: ScriptStep[]): void => {
      const stepIds = new Set(steps.map(step => step.stepId));
      for (const step of steps) {
        for (const button of step.buttons ?? []) {
          for (const route of button.routes ?? []) {
            if (!route.to.startsWith('@') && !stepIds.has(route.to)) {
              missing.push(`${scope}:${step.stepId} ${button.label ?? button.key} -> ${route.to}`);
            }
          }
        }
      }
    };

    checkScope('bundle', script.steps);
    flows.forEach(flow => {
      if (flow.title.endsWith(' (stub)')) {
        missing.push(`flow:${flow.scriptId} -> missing flow file`);
      }
      checkScope(`flow:${flow.scriptId}`, flow.steps);
    });
    return missing;
  }

  private isExpressionMet(expression: string | undefined): boolean {
    if (!expression) {
      return true;
    }

    return expression
      .split('||')
      .some(orPart => orPart.split('&&').every(andPart => this.evaluateClause(andPart.trim())));
  }

  private evaluateClause(clause: string): boolean {
    const match = clause.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
    if (!match) {
      return this.asBoolean(this.resolveExpressionValue(clause));
    }

    const left = this.resolveExpressionValue(match[1].trim());
    const right = this.resolveExpressionValue(match[3].trim());
    const equal = this.normaliseValue(left) === this.normaliseValue(right);
    return match[2] === '==' ? equal : !equal;
  }

  private resolveExpressionValue(expression: string): unknown {
    const quoted = expression.match(/^['"](.*)['"]$/);
    if (quoted) {
      return quoted[1];
    }
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    if (expression === 'null') return null;
    if (!Number.isNaN(Number(expression))) return Number(expression);

    if (expression.startsWith('arg.')) {
      return this.flowArgs()[expression.slice(4)];
    }
    if (expression.startsWith('wp-')) {
      return this.waypoints().get(expression);
    }

    const checkMatch = expression.match(/^(chk\.[^.]+)(?:\.(.+))?$/);
    if (checkMatch) {
      const result = this.checkResults()[checkMatch[1]];
      if (!checkMatch[2]) {
        return result?.outcome;
      }
      const unit = this.resolveUnit(checkMatch[1]);
      const aggregateFlag = this.getAggregateFlag(unit);
      if (checkMatch[2] === aggregateFlag?.outputKey) {
        return this.resolveAggregateFlag(unit, result);
      }
      return this.getPathValue(result?.detail, checkMatch[2]);
    }

    const contentMatch = expression.match(/^(.+)\.(answered|value)$/);
    if (contentMatch) {
      const answer = this.userAnswers().get(contentMatch[1]);
      return contentMatch[2] === 'answered' ? !!answer : answer;
    }

    return expression;
  }

  private normaliseValue(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  private asBoolean(value: unknown): boolean {
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false' || value === null || value === undefined) {
      return false;
    }
    return typeof value === 'number' ? value !== 0 : value !== 'No' && value !== 'N' && value !== '';
  }
}
