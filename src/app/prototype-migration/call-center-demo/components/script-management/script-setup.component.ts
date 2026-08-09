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

interface CreatedScript {
  id: string;
  name: string;
  description: string;
  lastEdited: string;
  productId: string;
  requestTypeId: string;
  /** When set, this draft is a copy of the referenced script file. */
  sourceScriptFileId?: string;
  copy?: boolean;
}

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

  readonly selectedProduct = signal<string | null>(null);
  readonly selectedRequestType = signal<string | null>(null);

  readonly selectedScriptId = signal<string | null>(null);
  readonly isCreateNewSelected = signal(false);
  readonly showCreateTile = signal(true);

  readonly createdScripts = signal<CreatedScript[]>([]);

  /* Product dialog */
  readonly showProductDialog = signal(false);
  readonly productDialogSearch = signal('');
  readonly selectedProductInDialog = signal<string | null>(null);
  readonly filteredProductsForDialog = computed(() => {
    const term = this.productDialogSearch().toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p => p.label.toLowerCase().includes(term));
  });

  /* Request type dialog */
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

  /* Create new / copy dialog */
  readonly showCreateScriptPopover = signal(false);
  readonly newScriptName = signal('');
  readonly newScriptDescription = signal('');
  readonly isCopyDialog = signal(false);
  readonly copySourceScript = signal<ExistingScript | null>(null);
  readonly copyHistoricVersion = signal<VersionEntry | null>(null);
  readonly editingDraftId = signal<string | null>(null);

  readonly showVersionHistory = signal(false);
  readonly selectedScriptForHistory = signal<ExistingScript | null>(null);
  readonly selectedHistoricVersion = signal<VersionEntry | null>(null);

  /* Draft replacement confirmation */
  readonly showDraftReplaceConfirm = signal(false);
  readonly pendingExistingScriptId = signal<string | null>(null);

  selectedProductLabel(): string {
    const id = this.selectedProduct();
    return this.products.find(p => p.id === id)?.label || '';
  }

  selectedRequestTypeLabel(): string {
    const id = this.selectedRequestType();
    return this.requestTypes.find(r => r.id === id)?.label || '';
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
      this.selectedRequestType.set(null);
      this.clearScriptSelection();
    } else if (!id) {
      this.selectedProduct.set(null);
      this.selectedRequestType.set(null);
      this.clearScriptSelection();
    }
    this.closeProductDialog();
  }

  onProductDialogSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.productDialogSearch.set(value);
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
      this.clearScriptSelection();
    } else if (!id) {
      this.selectedRequestType.set(null);
      this.clearScriptSelection();
    }
    this.closeRequestTypeDialog();
  }

  onRequestTypeDialogSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.requestTypeDialogSearch.set(value);
  }

  clearScriptSelection() {
    this.selectedScriptId.set(null);
    this.isCreateNewSelected.set(false);
    this.selectedHistoricVersion.set(null);
    this.selectedScriptForHistory.set(null);
  }

  /* Create new script */
  toggleCreateNew() {
    this.isCreateNewSelected.set(!this.isCreateNewSelected());
    if (this.isCreateNewSelected()) {
      this.clearScriptSelection();
      this.isCreateNewSelected.set(true);
      this.openCreatePopover();
    }
  }

  openCreatePopover() {
    this.isCopyDialog.set(false);
    this.copySourceScript.set(null);
    this.copyHistoricVersion.set(null);
    this.newScriptName.set('');
    this.newScriptDescription.set('');
    this.editingDraftId.set(null);
    this.showCreateScriptPopover.set(true);
  }

  /* Copy existing or historic script */
  openCopyDialog(script: ExistingScript, version: VersionEntry | null = null) {
    this.isCopyDialog.set(true);
    this.copySourceScript.set(script);
    this.copyHistoricVersion.set(version);
    this.newScriptName.set(
      version
        ? `${script.name} (Copy of v${version.version})`
        : `${script.name} (Copy)`
    );
    this.newScriptDescription.set(script.description || '');
    this.editingDraftId.set(null);
    this.showCreateScriptPopover.set(true);
  }

  editCreatedScript(script: CreatedScript) {
    this.isCopyDialog.set(!!script.copy);
    this.copySourceScript.set(
      script.copy && script.sourceScriptFileId
        ? this.existingScripts.find(s => s.scriptFileId === script.sourceScriptFileId) || null
        : null
    );
    this.copyHistoricVersion.set(null);
    this.newScriptName.set(script.name);
    this.newScriptDescription.set(script.description);
    this.editingDraftId.set(script.id);
    this.isCreateNewSelected.set(false);
    this.showCreateScriptPopover.set(true);
  }

  cancelNewScript() {
    this.showCreateScriptPopover.set(false);
    this.isCreateNewSelected.set(false);
    this.isCopyDialog.set(false);
    this.copySourceScript.set(null);
    this.copyHistoricVersion.set(null);
    this.editingDraftId.set(null);
    this.newScriptName.set('');
    this.newScriptDescription.set('');
  }

  saveNewScript() {
    const name = this.newScriptName().trim();
    const description = this.newScriptDescription().trim();
    if (!name || !description || !this.selectedProduct() || !this.selectedRequestType()) return;

    const productId = this.selectedProduct()!;
    const requestTypeId = this.selectedRequestType()!;
    const source = this.copySourceScript();
    const sourceScriptFileId = source ? source.scriptFileId : undefined;
    const editingId = this.editingDraftId();

    let draftId: string;

    if (editingId) {
      this.createdScripts.update(list => list.map(s => {
        if (s.id !== editingId) return s;
        return {
          ...s,
          name,
          description,
          sourceScriptFileId,
          copy: !!source,
          lastEdited: new Date().toISOString().slice(0, 10)
        };
      }));
      draftId = editingId;
    } else {
      draftId = 'draft-' + Date.now();
      const created: CreatedScript = {
        id: draftId,
        name,
        description,
        lastEdited: new Date().toISOString().slice(0, 10),
        productId,
        requestTypeId,
        sourceScriptFileId,
        copy: !!source
      };
      this.createdScripts.update(list => [created, ...list]);
      this.showCreateTile.set(false);
    }

    this.selectedScriptId.set(draftId);
    this.isCreateNewSelected.set(false);
    this.isCopyDialog.set(false);
    this.copySourceScript.set(null);
    this.copyHistoricVersion.set(null);
    this.editingDraftId.set(null);
    this.selectedHistoricVersion.set(null);
    this.selectedScriptForHistory.set(null);
    this.showCreateScriptPopover.set(false);

    const draft = this.createdScripts().find(s => s.id === draftId);

    this.continue.emit({
      mode: 'new',
      scriptId: draftId,
      scriptFileId: undefined,
      sourceScriptFileId,
      scriptName: draft?.name || name,
      scriptDescription: draft?.description || description,
      productId,
      productLabel: this.selectedProductLabel(),
      requestTypeId,
      requestTypeLabel: this.selectedRequestTypeLabel()
    });
  }

  cancelCreatedScript(id: string) {
    this.createdScripts.update(list => list.filter(s => s.id !== id));
    if (this.selectedScriptId() === id) {
      this.selectedScriptId.set(null);
    }
    if (this.createdScripts().length === 0) {
      this.showCreateTile.set(true);
    }
  }

  selectScript(id: string) {
    this.selectedScriptId.set(id);
    this.isCreateNewSelected.set(false);
    this.selectedHistoricVersion.set(null);

    const existing = this.existingScripts.find(s => s.id === id);
    const draft = this.createdScripts().find(s => s.id === id);

    if (existing) {
      this.continue.emit({
        mode: 'edit',
        scriptId: existing.id,
        scriptFileId: existing.scriptFileId,
        scriptName: existing.name,
        scriptDescription: existing.description,
        productId: this.selectedProduct()!,
        productLabel: this.selectedProductLabel(),
        requestTypeId: this.selectedRequestType()!,
        requestTypeLabel: this.selectedRequestTypeLabel()
      });
    } else if (draft) {
      this.continue.emit({
        mode: 'new',
        scriptId: draft.id,
        scriptFileId: undefined,
        sourceScriptFileId: draft.sourceScriptFileId,
        scriptName: draft.name,
        scriptDescription: draft.description,
        productId: this.selectedProduct()!,
        productLabel: this.selectedProductLabel(),
        requestTypeId: this.selectedRequestType()!,
        requestTypeLabel: this.selectedRequestTypeLabel()
      });
    }
  }

  /* Selecting an existing script while a draft exists needs confirmation */
  onSelectExistingScript(id: string) {
    if (this.createdScripts().length > 0) {
      this.pendingExistingScriptId.set(id);
      this.showDraftReplaceConfirm.set(true);
    } else {
      this.selectScript(id);
    }
  }

  confirmReplaceDraft() {
    const id = this.pendingExistingScriptId();
    if (id) {
      this.createdScripts.set([]);
      this.showCreateTile.set(true);
      this.selectScript(id);
    }
    this.pendingExistingScriptId.set(null);
    this.showDraftReplaceConfirm.set(false);
  }

  cancelReplaceDraft() {
    this.pendingExistingScriptId.set(null);
    this.showDraftReplaceConfirm.set(false);
  }

  openVersionHistory(script: ExistingScript) {
    this.selectedScriptForHistory.set(script);
    this.showVersionHistory.set(true);
  }

  closeVersionHistory() {
    this.showVersionHistory.set(false);
  }

  selectVersion(version: VersionEntry) {
    const script = this.selectedScriptForHistory();
    if (!script || !this.selectedProduct() || !this.selectedRequestType()) return;

    this.selectedHistoricVersion.set(version);
    this.selectedScriptId.set(script.id);
    this.showVersionHistory.set(false);

    this.continue.emit({
      mode: 'edit',
      scriptId: script.id,
      scriptFileId: script.scriptFileId,
      scriptName: `${script.name} (v${version.version})`,
      scriptDescription: script.description,
      productId: this.selectedProduct()!,
      productLabel: this.selectedProductLabel(),
      requestTypeId: this.selectedRequestType()!,
      requestTypeLabel: this.selectedRequestTypeLabel()
    });
  }

  cancelHistoricSelection() {
    this.selectedHistoricVersion.set(null);
  }
}
