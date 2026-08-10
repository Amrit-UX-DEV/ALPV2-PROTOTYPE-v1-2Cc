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
  productId: string;
  requestTypeId: string;
  /** Shared journey JSON file id (no .json) */
  scriptFileId: string;
  versionHistory: VersionEntry[];
}

interface DraftPrimary {
  kind: 'draft';
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

interface ExistingPrimary {
  kind: 'existing';
  id: string;
  scriptFileId: string;
  name: string;
  description: string;
  productId: string;
  requestTypeId: string;
  version?: VersionEntry;
}

type PrimaryScript = DraftPrimary | ExistingPrimary;

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
    { id: 'all', label: 'All' },
    { id: 'life', label: 'Life' },
    { id: 'pension', label: 'Pension' }
  ];

  readonly requestTypes: RequestTypeOption[] = [
    { id: 'all', label: 'All', productId: 'all' },
    { id: 'surrender', label: 'Surrender', productId: 'all' },
    { id: 'fund-value', label: 'Fund Value', productId: 'all' },
    { id: 'full-policy-details', label: 'Full Policy Details', productId: 'all' },
    { id: 'third-parties', label: 'Third Parties', productId: 'all' },
    { id: 'letter-of-authority', label: 'Letter of Authority', productId: 'all' },
    { id: 'death-notification', label: 'Death Notification', productId: 'all' }
  ];

  readonly existingScripts: ExistingScript[] = [
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

  /* Primary slot: the single script being taken forward */
  readonly primaryScript = signal<PrimaryScript | null>(null);

  /* Browse filters */
  readonly browseProduct = signal<string | null>('all');
  readonly browseRequestType = signal<string | null>('all');

  readonly filteredExistingScripts = computed(() => {
    const product = this.browseProduct();
    const requestType = this.browseRequestType();
    return this.existingScripts.filter(s => {
      const matchesProduct = !product || product === 'all' || s.productId === product;
      const matchesRequestType = !requestType || requestType === 'all' || s.requestTypeId === requestType;
      return matchesProduct && matchesRequestType;
    });
  });

  /* Create new script dialog */
  readonly showCreateDialog = signal(false);
  readonly createName = signal('');
  readonly createDescription = signal('');
  readonly createProductId = signal<string | null>(null);
  readonly createRequestTypeId = signal<string | null>(null);

  /* Copy script dialog */
  readonly showCopyDialog = signal(false);
  readonly copyName = signal('');
  readonly copyDescription = signal('');
  readonly copySourceScript = signal<ExistingScript | null>(null);
  readonly copyHistoricVersion = signal<VersionEntry | null>(null);
  readonly copyProductId = signal<string | null>(null);
  readonly copyRequestTypeId = signal<string | null>(null);

  /* Version history dialog */
  readonly showVersionHistory = signal(false);
  readonly selectedScriptForHistory = signal<ExistingScript | null>(null);
  readonly selectedHistoricVersion = signal<VersionEntry | null>(null);

  /* Primary replacement confirmation */
  readonly showReplaceConfirm = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);

  /* Cross-association copy confirmation */
  readonly showCrossAssociationConfirm = signal(false);

  labelForProduct(id: string | null): string {
    return this.products.find(p => p.id === id)?.label || '';
  }

  labelForRequestType(id: string | null): string {
    return this.requestTypes.find(rt => rt.id === id)?.label || '';
  }

  primaryAssociationLabel(): string {
    const p = this.primaryScript();
    if (!p) return '';
    return `${this.labelForProduct(p.productId)} · ${this.labelForRequestType(p.requestTypeId)}`;
  }

  isAssociationMismatch(): boolean {
    const p = this.primaryScript();
    if (!p || p.kind !== 'draft') return false;
    return p.productId !== this.browseProduct() || p.requestTypeId !== this.browseRequestType();
  }

  primaryTagLabel(): string {
    const p = this.primaryScript();
    if (!p) return '';
    if (p.kind === 'existing') return 'Selected';
    return p.copy ? 'Copy draft' : 'Draft';
  }

  primaryTitle(): string {
    const p = this.primaryScript();
    if (!p) return '';
    if (p.kind === 'existing' && p.version) {
      return `${p.name} (v${p.version.version})`;
    }
    if (p.kind === 'draft' && p.copy) {
      return `${p.name} (copy)`;
    }
    return p.name;
  }

  matchFiltersToPrimary() {
    const p = this.primaryScript();
    if (!p) return;
    this.browseProduct.set(p.productId);
    this.browseRequestType.set(p.requestTypeId);
  }

  /* Primary slot actions */
  requestCreateNew() {
    if (this.primaryScript()) {
      this.pendingAction.set({ type: 'create-new' });
      this.showReplaceConfirm.set(true);
    } else {
      this.openCreateDialog();
    }
  }

  openCreateDialog() {
    if (this.primaryScript()) {
      this.requestCreateNew();
      return;
    }
    const defaultProduct = this.browseProduct() && this.browseProduct() !== 'all'
      ? this.browseProduct()
      : this.products[1]?.id || null;
    const defaultRequestType = this.browseRequestType() && this.browseRequestType() !== 'all'
      ? this.browseRequestType()
      : this.requestTypes[1]?.id || null;
    this.createName.set('');
    this.createDescription.set('');
    this.createProductId.set(defaultProduct);
    this.createRequestTypeId.set(defaultRequestType);
    this.showCreateDialog.set(true);
  }

  saveCreateDialog() {
    const name = this.createName().trim();
    const description = this.createDescription().trim();
    const productId = this.createProductId();
    const requestTypeId = this.createRequestTypeId();
    if (!name || !description || !productId || !requestTypeId) return;

    this.primaryScript.set({
      kind: 'draft',
      id: 'draft-' + Date.now(),
      name,
      description,
      productId,
      requestTypeId,
      copy: false,
      lastEdited: new Date().toISOString().slice(0, 10)
    });
    this.browseProduct.set(productId);
    this.browseRequestType.set(requestTypeId);
    this.closeCreateDialog();
    this.emitContinue();
  }

  closeCreateDialog() {
    this.showCreateDialog.set(false);
    this.createName.set('');
    this.createDescription.set('');
    this.createProductId.set(null);
    this.createRequestTypeId.set(null);
  }

  removePrimary() {
    this.primaryScript.set(null);
  }

  /* Select existing */
  requestSelectExisting(script: ExistingScript) {
    if (this.primaryScript()) {
      this.pendingAction.set({ type: 'select-existing', script });
      this.showReplaceConfirm.set(true);
    } else {
      this.selectExisting(script);
    }
  }

  selectExisting(script: ExistingScript) {
    this.primaryScript.set({
      kind: 'existing',
      id: script.id,
      scriptFileId: script.scriptFileId,
      name: script.name,
      description: script.description,
      productId: script.productId,
      requestTypeId: script.requestTypeId
    });
    this.emitContinue();
  }

  /* Copy existing or historic */
  requestCopy(script: ExistingScript, version: VersionEntry | null = null) {
    if (this.primaryScript()) {
      this.pendingAction.set({ type: 'copy', script, version });
      this.showReplaceConfirm.set(true);
    } else {
      this.openCopyDialog(script, version);
    }
  }

  openCopyDialog(script: ExistingScript, version: VersionEntry | null = null) {
    if (this.primaryScript()) {
      this.requestCopy(script, version);
      return;
    }
    const defaultProduct = this.browseProduct() && this.browseProduct() !== 'all'
      ? this.browseProduct()
      : script.productId;
    const defaultRequestType = this.browseRequestType() && this.browseRequestType() !== 'all'
      ? this.browseRequestType()
      : script.requestTypeId;
    this.copySourceScript.set(script);
    this.copyHistoricVersion.set(version);
    this.copyName.set(
      version
        ? `${script.name} (copy of v${version.version})`
        : `${script.name} (copy)`
    );
    this.copyDescription.set(script.description || '');
    this.copyProductId.set(defaultProduct);
    this.copyRequestTypeId.set(defaultRequestType);
    this.showCopyDialog.set(true);
  }

  saveCopyDialog() {
    const name = this.copyName().trim();
    const description = this.copyDescription().trim();
    const source = this.copySourceScript();
    const productId = this.copyProductId();
    const requestTypeId = this.copyRequestTypeId();
    if (!name || !description || !source || !productId || !requestTypeId) return;

    const changedAssociation = productId !== this.browseProduct() || requestTypeId !== this.browseRequestType();
    if (changedAssociation) {
      this.showCrossAssociationConfirm.set(true);
      return;
    }

    this.createCopyDraft(name, description, source, productId, requestTypeId);
  }

  confirmCrossAssociationCopy() {
    const name = this.copyName().trim();
    const description = this.copyDescription().trim();
    const source = this.copySourceScript();
    const productId = this.copyProductId();
    const requestTypeId = this.copyRequestTypeId();
    if (!name || !description || !source || !productId || !requestTypeId) return;
    this.createCopyDraft(name, description, source, productId, requestTypeId);
    this.showCrossAssociationConfirm.set(false);
  }

  cancelCrossAssociationCopy() {
    this.showCrossAssociationConfirm.set(false);
  }

  private createCopyDraft(
    name: string,
    description: string,
    source: ExistingScript,
    productId: string,
    requestTypeId: string
  ) {
    this.primaryScript.set({
      kind: 'draft',
      id: 'draft-' + Date.now(),
      name,
      description,
      productId,
      requestTypeId,
      sourceScriptFileId: source.scriptFileId,
      copy: true,
      lastEdited: new Date().toISOString().slice(0, 10)
    });
    this.browseProduct.set(productId);
    this.browseRequestType.set(requestTypeId);
    this.closeCopyDialog();
    this.emitContinue();
  }

  closeCopyDialog() {
    this.showCopyDialog.set(false);
    this.copyName.set('');
    this.copyDescription.set('');
    this.copySourceScript.set(null);
    this.copyHistoricVersion.set(null);
    this.copyProductId.set(null);
    this.copyRequestTypeId.set(null);
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
    if (this.primaryScript()) {
      this.pendingAction.set({ type: 'select-historic', script, version });
      this.showReplaceConfirm.set(true);
    } else {
      this.selectHistoric(script, version);
    }
  }

  selectHistoric(script: ExistingScript, version: VersionEntry) {
    this.primaryScript.set({
      kind: 'existing',
      id: script.id,
      scriptFileId: script.scriptFileId,
      name: script.name,
      description: script.description,
      productId: script.productId,
      requestTypeId: script.requestTypeId,
      version
    });
    this.showVersionHistory.set(false);
    this.emitContinue();
  }

  /* Primary replacement confirmation */
  confirmReplacePrimary() {
    const action = this.pendingAction();
    if (!action) return;

    this.primaryScript.set(null);

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
    const p = this.primaryScript();
    if (!p) return;

    if (p.kind === 'existing') {
      this.continue.emit({
        mode: 'edit',
        scriptId: p.id,
        scriptFileId: p.scriptFileId,
        scriptName: p.version ? `${p.name} (v${p.version.version})` : p.name,
        scriptDescription: p.description,
        productId: p.productId,
        productLabel: this.labelForProduct(p.productId),
        requestTypeId: p.requestTypeId,
        requestTypeLabel: this.labelForRequestType(p.requestTypeId)
      });
    } else {
      this.continue.emit({
        mode: 'new',
        scriptId: p.id,
        scriptFileId: undefined,
        sourceScriptFileId: p.sourceScriptFileId,
        scriptName: p.name,
        scriptDescription: p.description,
        productId: p.productId,
        productLabel: this.labelForProduct(p.productId),
        requestTypeId: p.requestTypeId,
        requestTypeLabel: this.labelForRequestType(p.requestTypeId)
      });
    }
  }
}
