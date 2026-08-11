import { Component, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScriptSetupSelection } from '../call-rep-scripts/script-builder/models/script-builder.models';

interface ProductOption {
  id: string;
  label: string;
}

interface RequestTypeOption {
  id: string;
  label: string;
  productId: string;
}

interface VersionEntry {
  version: string;
  date: string;
  editedBy: string;
}

interface ExistingScript {
  id: string;
  name: string;
  description: string;
  version: string;
  lastEdited: string;
  isActive: boolean;
  /** Global templates are not tied to a product or request type. */
  isGlobalTemplate?: boolean;
  productId?: string;
  requestTypeId?: string;
  /** Shared journey JSON file id (no .json) */
  scriptFileId: string;
  versionHistory: VersionEntry[];
}

interface TopSlotDraft {
  id: string;
  name: string;
  description: string;
  productId: string;
  requestTypeId: string;
  /** When set, this draft is a copy of the referenced script file. */
  sourceScriptFileId?: string;
  copy: boolean;
  lastEdited: string;
}

type ScriptAssociation =
  | { kind: 'global-template' }
  | { kind: 'product'; productId: string }
  | { kind: 'request-type'; productId: string; requestTypeId: string };

type PickerTarget = 'browse' | 'create' | 'copy';

type PendingAction =
  | { type: 'create-new' }
  | { type: 'copy'; script: ExistingScript; version: VersionEntry | null }
  | { type: 'select-existing'; script: ExistingScript }
  | { type: 'select-historic'; script: ExistingScript; version: VersionEntry };

@Component({
  selector: 'alpha-script-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './script-setup.component.html'
})
export class ScriptSetupComponent {

  @Output() continue = new EventEmitter<ScriptSetupSelection>();

  readonly products: ProductOption[] = [
    { id: 'life', label: 'Life' },
    { id: 'pension', label: 'Pension' }
  ];

  readonly requestTypes: RequestTypeOption[] = [
    { id: 'surrender', label: 'Surrender', productId: 'all' },
    { id: 'fund-value', label: 'Fund Value', productId: 'all' },
    { id: 'full-policy-details', label: 'Full Policy Details', productId: 'all' },
    { id: 'third-parties', label: 'Third Parties', productId: 'all' },
    { id: 'letter-of-authority', label: 'Letter of Authority', productId: 'all' },
    { id: 'death-notification', label: 'Death Notification', productId: 'all' }
  ];

  readonly existingScripts: ExistingScript[] = [
    {
      id: 'g1',
      name: 'Generic Welcome Script',
      description: 'Global template available across all products and request types',
      version: '1.0',
      lastEdited: '2026-07-01',
      isActive: false,
      isGlobalTemplate: true,
      scriptFileId: 'generic-welcome',
      versionHistory: [
        { version: '1.0', date: '2026-07-01', editedBy: 'A. Smith' }
      ]
    },
    {
      id: 's1',
      name: 'Surrender Script v1',
      description: 'Primary surrender journey',
      version: '1.2',
      lastEdited: '2026-07-10',
      isActive: true,
      productId: 'life',
      requestTypeId: 'surrender',
      scriptFileId: 'surrender-001',
      versionHistory: [
        { version: '1.2', date: '2026-07-10', editedBy: 'A. Smith' },
        { version: '1.1', date: '2026-06-02', editedBy: 'J. Patel' },
        { version: '1.0', date: '2026-05-01', editedBy: 'A. Smith' }
      ]
    },
    {
      id: 's2',
      name: 'Surrender Script v2',
      description: 'Updated branching for suspended funds',
      version: '2.0',
      lastEdited: '2026-07-14',
      isActive: false,
      productId: 'life',
      requestTypeId: 'surrender',
      scriptFileId: 'surrender-001',
      versionHistory: [
        { version: '2.0', date: '2026-07-14', editedBy: 'J. Patel' },
        { version: '1.0', date: '2026-04-20', editedBy: 'A. Smith' }
      ]
    }
  ];

  /* Top slot: only for new or copy drafts */
  readonly topSlotDraft = signal<TopSlotDraft | null>(null);

  /* Browse association */
  readonly currentAssociation = signal<ScriptAssociation | null>(null);

  /* Association for create/copy dialogs */
  readonly createAssociation = signal<ScriptAssociation | null>(null);
  readonly copyAssociation = signal<ScriptAssociation | null>(null);

  /* Selected existing script in the browse list */
  readonly selectedScriptId = signal<string | null>(null);
  readonly selectedHistoricVersion = signal<VersionEntry | null>(null);

  readonly filteredExistingScripts = computed(() => {
    const assoc = this.currentAssociation();
    if (!assoc) return [];
    if (assoc.kind === 'global-template') {
      return this.existingScripts.filter(s => s.isGlobalTemplate);
    }
    if (assoc.kind === 'product') {
      return this.existingScripts.filter(s => !s.isGlobalTemplate && s.productId === assoc.productId);
    }
    return this.existingScripts.filter(s =>
      !s.isGlobalTemplate && s.productId === assoc.productId && s.requestTypeId === assoc.requestTypeId
    );
  });

  readonly isAssociationMismatch = computed(() => {
    const d = this.topSlotDraft();
    const assoc = this.currentAssociation();
    if (!d || !assoc) return false;
    if (assoc.kind === 'global-template') return false;
    return d.productId !== assoc.productId || (assoc.kind === 'request-type' && d.requestTypeId !== assoc.requestTypeId);
  });

  /* Association picker dialog */
  readonly showAssociationPicker = signal(false);
  readonly pickerTarget = signal<PickerTarget>('browse');
  readonly pickerDraftAssociation = signal<ScriptAssociation | null>(null);
  readonly pickerSearch = signal('');

  readonly pickerGlobalScripts = computed(() => {
    const term = this.pickerSearch().toLowerCase().trim();
    const list = this.existingScripts.filter(s => s.isGlobalTemplate);
    if (!term) return list;
    return list.filter(s => s.name.toLowerCase().includes(term));
  });

  readonly filteredPickerProducts = computed(() => {
    const term = this.pickerSearch().toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p => p.label.toLowerCase().includes(term));
  });

  readonly filteredPickerRequestTypes = computed(() => {
    const term = this.pickerSearch().toLowerCase().trim();
    let list = [...this.requestTypes];
    if (term) {
      list = list.filter(rt => rt.label.toLowerCase().includes(term));
    }
    return list;
  });

  /* Create new script dialog */
  readonly showCreateDialog = signal(false);
  readonly createName = signal('');
  readonly createDescription = signal('');

  /* Copy script dialog */
  readonly showCopyDialog = signal(false);
  readonly copyName = signal('');
  readonly copyDescription = signal('');
  readonly copySourceScript = signal<ExistingScript | null>(null);
  readonly copyHistoricVersion = signal<VersionEntry | null>(null);

  /* Version history dialog */
  readonly showVersionHistory = signal(false);
  readonly selectedScriptForHistory = signal<ExistingScript | null>(null);

  /* Draft replacement confirmation when selecting existing while draft is in top slot */
  readonly showReplaceConfirm = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);

  /* Cross-association copy confirmation */
  readonly showCrossAssociationConfirm = signal(false);

  labelForProduct(id: string | null): string {
    if (id === 'all') return 'Global Template';
    return this.products.find(p => p.id === id)?.label || '';
  }

  labelForRequestType(id: string | null): string {
    if (id === 'all') return 'Global Template';
    return this.requestTypes.find(rt => rt.id === id)?.label || '';
  }

  associationLabel(assoc: ScriptAssociation | null): string {
    if (!assoc) return 'Select Association';
    if (assoc.kind === 'global-template') return 'Global Template';
    if (assoc.kind === 'product') return this.labelForProduct(assoc.productId);
    return `${this.labelForProduct(assoc.productId)} · ${this.labelForRequestType(assoc.requestTypeId)}`;
  }

  topSlotTitle(): string {
    const d = this.topSlotDraft();
    if (!d) return '';
    return d.copy ? `${d.name} (copy)` : d.name;
  }

  topSlotAssociationLabel(): string {
    const d = this.topSlotDraft();
    if (!d) return '';
    return `${this.labelForProduct(d.productId)} · ${this.labelForRequestType(d.requestTypeId)}`;
  }

  private defaultAssociation(): ScriptAssociation {
    return {
      kind: 'request-type',
      productId: this.products[0]?.id || 'all',
      requestTypeId: this.requestTypes[0]?.id || 'all'
    };
  }

  /* Association picker */
  openAssociationPicker(target: PickerTarget) {
    this.pickerTarget.set(target);
    const assoc = target === 'browse'
      ? this.currentAssociation()
      : target === 'create'
        ? this.createAssociation()
        : this.copyAssociation();
    this.pickerDraftAssociation.set(assoc ? { ...assoc } : null);
    this.pickerSearch.set('');
    this.showAssociationPicker.set(true);
  }

  closeAssociationPicker() {
    this.showAssociationPicker.set(false);
    this.pickerDraftAssociation.set(null);
    this.pickerSearch.set('');
  }

  selectPickerTab(tab: 'global' | 'product') {
    if (tab === 'global') {
      this.pickerDraftAssociation.set({ kind: 'global-template' });
    } else {
      const current = this.pickerDraftAssociation();
      if (!current || current.kind === 'global-template') {
        this.pickerDraftAssociation.set({ kind: 'product', productId: this.products[0]?.id || 'all' });
      }
    }
  }

  selectPickerProduct(id: string) {
    const current = this.pickerDraftAssociation();
    if (current && current.kind === 'product' && current.productId === id) {
      this.pickerDraftAssociation.set({ kind: 'product', productId: id });
      return;
    }
    this.pickerDraftAssociation.set({ kind: 'product', productId: id });
  }

  selectPickerRequestType(id: string) {
    const current = this.pickerDraftAssociation();
    const productId = current?.kind === 'product' || current?.kind === 'request-type'
      ? current.productId
      : this.products[0]?.id || 'all';
    this.pickerDraftAssociation.set({ kind: 'request-type', productId, requestTypeId: id });
  }

  confirmAssociationPicker() {
    const assoc = this.pickerDraftAssociation();
    if (!assoc) return;
    const target = this.pickerTarget();
    if (target === 'browse') {
      this.currentAssociation.set(assoc);
    } else if (target === 'create') {
      this.createAssociation.set(assoc);
    } else {
      this.copyAssociation.set(assoc);
    }
    this.closeAssociationPicker();
  }

  onPickerSearchChange(event: Event) {
    this.pickerSearch.set((event.target as HTMLInputElement).value);
  }

  pickerIsGlobalScope(): boolean {
    return this.pickerDraftAssociation()?.kind === 'global-template';
  }

  pickerSelectedProductId(): string | null {
    const a = this.pickerDraftAssociation();
    return a && a.kind !== 'global-template' ? a.productId : null;
  }

  pickerSelectedRequestTypeId(): string | null {
    const a = this.pickerDraftAssociation();
    return a?.kind === 'request-type' ? a.requestTypeId : null;
  }

  matchFiltersToDraft() {
    const d = this.topSlotDraft();
    if (!d) return;
    this.currentAssociation.set({
      kind: 'request-type',
      productId: d.productId,
      requestTypeId: d.requestTypeId
    });
  }

  /* Top slot actions */
  openCreateDialog() {
    if (this.topSlotDraft()) {
      this.requestCreateNew();
      return;
    }
    const assoc = this.currentAssociation() || this.defaultAssociation();
    this.createAssociation.set(assoc);
    this.createName.set('');
    this.createDescription.set('');
    this.showCreateDialog.set(true);
  }

  requestCreateNew() {
    if (this.topSlotDraft()) {
      this.pendingAction.set({ type: 'create-new' });
      this.showReplaceConfirm.set(true);
    } else {
      this.openCreateDialog();
    }
  }

  saveCreateDialog() {
    const name = this.createName().trim();
    const description = this.createDescription().trim();
    const assoc = this.createAssociation();
    if (!name || !description || !assoc) return;

    const { productId, requestTypeId } = this.associationToIds(assoc);
    this.selectedScriptId.set(null);
    this.selectedHistoricVersion.set(null);
    this.topSlotDraft.set({
      id: 'draft-' + Date.now(),
      name,
      description,
      productId,
      requestTypeId,
      copy: false,
      lastEdited: new Date().toISOString().slice(0, 10)
    });
    this.currentAssociation.set(assoc);
    this.closeCreateDialog();
    this.emitContinue();
  }

  closeCreateDialog() {
    this.showCreateDialog.set(false);
    this.createName.set('');
    this.createDescription.set('');
    this.createAssociation.set(null);
  }

  removeTopSlotDraft() {
    this.topSlotDraft.set(null);
  }

  /* Select existing */
  requestSelectExisting(script: ExistingScript) {
    if (this.topSlotDraft()) {
      this.pendingAction.set({ type: 'select-existing', script });
      this.showReplaceConfirm.set(true);
    } else {
      this.selectExisting(script);
    }
  }

  selectExisting(script: ExistingScript) {
    this.topSlotDraft.set(null);
    this.selectedScriptId.set(script.id);
    this.selectedHistoricVersion.set(null);
    this.emitContinue();
  }

  /* Copy existing or historic */
  requestCopy(script: ExistingScript, version: VersionEntry | null = null) {
    if (this.topSlotDraft()) {
      this.pendingAction.set({ type: 'copy', script, version });
      this.showReplaceConfirm.set(true);
    } else {
      this.openCopyDialog(script, version);
    }
  }

  openCopyDialog(script: ExistingScript, version: VersionEntry | null = null) {
    if (this.topSlotDraft()) {
      this.requestCopy(script, version);
      return;
    }
    const assoc = this.currentAssociation() || this.scriptAssociation(script) || this.defaultAssociation();
    this.copyAssociation.set(assoc);
    this.copySourceScript.set(script);
    this.copyHistoricVersion.set(version);
    this.copyName.set(
      version
        ? `${script.name} (copy of v${version.version})`
        : `${script.name} (copy)`
    );
    this.copyDescription.set(script.description || '');
    this.showCopyDialog.set(true);
  }

  saveCopyDialog() {
    const name = this.copyName().trim();
    const description = this.copyDescription().trim();
    const source = this.copySourceScript();
    const assoc = this.copyAssociation();
    if (!name || !description || !source || !assoc) return;

    const changedAssociation = !this.associationMatches(assoc, this.currentAssociation());
    if (changedAssociation) {
      this.showCrossAssociationConfirm.set(true);
      return;
    }

    this.createCopyDraft(name, description, source, assoc);
  }

  confirmCrossAssociationCopy() {
    const name = this.copyName().trim();
    const description = this.copyDescription().trim();
    const source = this.copySourceScript();
    const assoc = this.copyAssociation();
    if (!name || !description || !source || !assoc) return;
    this.createCopyDraft(name, description, source, assoc);
    this.showCrossAssociationConfirm.set(false);
  }

  cancelCrossAssociationCopy() {
    this.showCrossAssociationConfirm.set(false);
  }

  private createCopyDraft(
    name: string,
    description: string,
    source: ExistingScript,
    assoc: ScriptAssociation
  ) {
    const { productId, requestTypeId } = this.associationToIds(assoc);
    this.selectedScriptId.set(null);
    this.selectedHistoricVersion.set(null);
    this.topSlotDraft.set({
      id: 'draft-' + Date.now(),
      name,
      description,
      productId,
      requestTypeId,
      sourceScriptFileId: source.scriptFileId,
      copy: true,
      lastEdited: new Date().toISOString().slice(0, 10)
    });
    this.currentAssociation.set(assoc);
    this.closeCopyDialog();
    this.emitContinue();
  }

  closeCopyDialog() {
    this.showCopyDialog.set(false);
    this.copyName.set('');
    this.copyDescription.set('');
    this.copySourceScript.set(null);
    this.copyHistoricVersion.set(null);
    this.copyAssociation.set(null);
  }

  private scriptAssociation(script: ExistingScript): ScriptAssociation | null {
    if (script.isGlobalTemplate) return { kind: 'global-template' };
    if (script.productId && script.requestTypeId) {
      return { kind: 'request-type', productId: script.productId, requestTypeId: script.requestTypeId };
    }
    if (script.productId) {
      return { kind: 'product', productId: script.productId };
    }
    return null;
  }

  private associationToIds(assoc: ScriptAssociation): { productId: string; requestTypeId: string } {
    if (assoc.kind === 'global-template') return { productId: 'all', requestTypeId: 'all' };
    if (assoc.kind === 'product') return { productId: assoc.productId, requestTypeId: 'all' };
    return { productId: assoc.productId, requestTypeId: assoc.requestTypeId };
  }

  private associationMatches(a: ScriptAssociation, b: ScriptAssociation | null): boolean {
    if (!b) return false;
    if (a.kind === 'global-template') return b.kind === 'global-template';
    if (a.kind === 'product') return b.kind === 'product' && a.productId === b.productId;
    return b.kind === 'request-type' && a.productId === b.productId && a.requestTypeId === b.requestTypeId;
  }

  /* Version history */
  openVersionHistory(script: ExistingScript) {
    this.selectedScriptForHistory.set(script);
    this.showVersionHistory.set(true);
  }

  closeVersionHistory() {
    this.showVersionHistory.set(false);
  }

  requestSelectHistoric(script: ExistingScript, version: VersionEntry) {
    if (this.topSlotDraft()) {
      this.pendingAction.set({ type: 'select-historic', script, version });
      this.showReplaceConfirm.set(true);
    } else {
      this.selectHistoric(script, version);
    }
  }

  selectHistoric(script: ExistingScript, version: VersionEntry) {
    this.topSlotDraft.set(null);
    this.selectedScriptId.set(script.id);
    this.selectedHistoricVersion.set(version);
    this.showVersionHistory.set(false);
    this.emitContinue();
  }

  /* Draft replacement confirmation */
  confirmReplacePrimary() {
    const action = this.pendingAction();
    if (!action) return;

    this.topSlotDraft.set(null);

    switch (action.type) {
      case 'create-new':
        this.openCreateDialog();
        break;
      case 'copy':
        this.openCopyDialog(action.script, action.version);
        break;
      case 'select-existing':
        this.selectExisting(action.script);
        break;
      case 'select-historic':
        this.selectHistoric(action.script, action.version);
        break;
    }

    this.pendingAction.set(null);
    this.showReplaceConfirm.set(false);
  }

  cancelReplacePrimary() {
    this.pendingAction.set(null);
    this.showReplaceConfirm.set(false);
  }

  private emitContinue() {
    const draft = this.topSlotDraft();
    if (draft) {
      this.continue.emit({
        mode: 'new',
        scriptId: draft.id,
        scriptFileId: undefined,
        sourceScriptFileId: draft.sourceScriptFileId,
        scriptName: draft.name,
        scriptDescription: draft.description,
        productId: draft.productId,
        productLabel: this.labelForProduct(draft.productId),
        requestTypeId: draft.requestTypeId,
        requestTypeLabel: this.labelForRequestType(draft.requestTypeId)
      });
      return;
    }

    const id = this.selectedScriptId();
    if (!id) return;
    const existing = this.existingScripts.find(s => s.id === id);
    if (!existing) return;

    const version = this.selectedHistoricVersion();
    const productId = existing.productId || 'all';
    const requestTypeId = existing.requestTypeId || 'all';
    this.continue.emit({
      mode: 'edit',
      scriptId: existing.id,
      scriptFileId: existing.scriptFileId,
      scriptName: version ? `${existing.name} (v${version.version})` : existing.name,
      scriptDescription: existing.description,
      productId,
      productLabel: this.labelForProduct(productId),
      requestTypeId,
      requestTypeLabel: this.labelForRequestType(requestTypeId)
    });
  }
}
