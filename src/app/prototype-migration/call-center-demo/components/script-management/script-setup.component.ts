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
    { id: 'all', label: 'Global template' },
    { id: 'life', label: 'Life' },
    { id: 'pension', label: 'Pension' }
  ];

  readonly requestTypes: RequestTypeOption[] = [
    { id: 'all', label: 'Global template', productId: 'all' },
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

  /* Top slot: only for new or copy drafts */
  readonly topSlotDraft = signal<TopSlotDraft | null>(null);

  /* Association used for browsing and as default for new drafts */
  readonly selectedProduct = signal<string | null>(null);
  readonly selectedRequestType = signal<string | null>(null);

  /* Selected existing script in the browse list */
  readonly selectedScriptId = signal<string | null>(null);
  readonly selectedHistoricVersion = signal<VersionEntry | null>(null);

  readonly filteredExistingScripts = computed(() => {
    const product = this.selectedProduct();
    const requestType = this.selectedRequestType();
    if (!product || !requestType) return [];
    return this.existingScripts.filter(s => {
      const matchesProduct = product === 'all' || s.productId === product;
      const matchesRequestType = requestType === 'all' || s.requestTypeId === requestType;
      return matchesProduct && matchesRequestType;
    });
  });

  readonly isAssociationMismatch = computed(() => {
    const d = this.topSlotDraft();
    if (!d) return false;
    return d.productId !== this.selectedProduct() || d.requestTypeId !== this.selectedRequestType();
  });

  /* Product selection dialog */
  readonly showProductDialog = signal(false);
  readonly productDialogSearch = signal('');
  readonly selectedProductInDialog = signal<string | null>(null);
  readonly filteredProductsForDialog = computed(() => {
    const term = this.productDialogSearch().toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p => p.label.toLowerCase().includes(term));
  });

  /* Request type selection dialog */
  readonly showRequestTypeDialog = signal(false);
  readonly requestTypeDialogSearch = signal('');
  readonly selectedRequestTypeInDialog = signal<string | null>(null);
  readonly filteredRequestTypesForDialog = computed(() => {
    const term = this.requestTypeDialogSearch().toLowerCase().trim();
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

  /* Draft replacement confirmation when selecting existing while draft is in top slot */
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

  /* Product selection via dialog */
  openProductDialog() {
    this.selectedProductInDialog.set(this.selectedProduct());
    this.productDialogSearch.set('');
    this.showProductDialog.set(true);
  }

  closeProductDialog() {
    this.showProductDialog.set(false);
    this.selectedProductInDialog.set(null);
  }

  selectProductInDialog(id: string) {
    if (this.selectedProductInDialog() === id) {
      this.selectedProductInDialog.set(null);
    } else {
      this.selectedProductInDialog.set(id);
    }
  }

  confirmProductDialog() {
    const id = this.selectedProductInDialog();
    if (id && id !== this.selectedProduct()) {
      this.selectedProduct.set(id);
    } else if (!id) {
      this.selectedProduct.set(null);
    }
    this.closeProductDialog();
  }

  onProductDialogSearchChange(event: Event) {
    this.productDialogSearch.set((event.target as HTMLInputElement).value);
  }

  /* Request type selection via dialog */
  openRequestTypeDialog() {
    if (!this.selectedProduct()) return;
    this.selectedRequestTypeInDialog.set(this.selectedRequestType());
    this.requestTypeDialogSearch.set('');
    this.showRequestTypeDialog.set(true);
  }

  closeRequestTypeDialog() {
    this.showRequestTypeDialog.set(false);
    this.selectedRequestTypeInDialog.set(null);
  }

  selectRequestTypeInDialog(id: string) {
    if (this.selectedRequestTypeInDialog() === id) {
      this.selectedRequestTypeInDialog.set(null);
    } else {
      this.selectedRequestTypeInDialog.set(id);
    }
  }

  confirmRequestTypeDialog() {
    const id = this.selectedRequestTypeInDialog();
    if (id && id !== this.selectedRequestType()) {
      this.selectedRequestType.set(id);
    } else if (!id) {
      this.selectedRequestType.set(null);
    }
    this.closeRequestTypeDialog();
  }

  onRequestTypeDialogSearchChange(event: Event) {
    this.requestTypeDialogSearch.set((event.target as HTMLInputElement).value);
  }

  matchFiltersToDraft() {
    const d = this.topSlotDraft();
    if (!d) return;
    this.selectedProduct.set(d.productId);
    this.selectedRequestType.set(d.requestTypeId);
  }

  /* Top slot actions */
  openCreateDialog() {
    if (this.topSlotDraft()) {
      this.requestCreateNew();
      return;
    }
    const defaultProduct = this.selectedProduct() && this.selectedProduct() !== 'all'
      ? this.selectedProduct()
      : this.products[1]?.id || null;
    const defaultRequestType = this.selectedRequestType() && this.selectedRequestType() !== 'all'
      ? this.selectedRequestType()
      : this.requestTypes[1]?.id || null;
    this.createName.set('');
    this.createDescription.set('');
    this.createProductId.set(defaultProduct);
    this.createRequestTypeId.set(defaultRequestType);
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
    const productId = this.createProductId();
    const requestTypeId = this.createRequestTypeId();
    if (!name || !description || !productId || !requestTypeId) return;

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
    this.selectedProduct.set(productId);
    this.selectedRequestType.set(requestTypeId);
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
    const defaultProduct = this.selectedProduct() && this.selectedProduct() !== 'all'
      ? this.selectedProduct()
      : script.productId;
    const defaultRequestType = this.selectedRequestType() && this.selectedRequestType() !== 'all'
      ? this.selectedRequestType()
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

    const changedAssociation = productId !== this.selectedProduct() || requestTypeId !== this.selectedRequestType();
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
    this.selectedProduct.set(productId);
    this.selectedRequestType.set(requestTypeId);
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
    this.continue.emit({
      mode: 'edit',
      scriptId: existing.id,
      scriptFileId: existing.scriptFileId,
      scriptName: version ? `${existing.name} (v${version.version})` : existing.name,
      scriptDescription: existing.description,
      productId: existing.productId,
      productLabel: this.labelForProduct(existing.productId),
      requestTypeId: existing.requestTypeId,
      requestTypeLabel: this.labelForRequestType(existing.requestTypeId)
    });
  }
}
