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
}

@Component({
  selector: 'alpha-script-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './script-setup.component.html',
  styleUrls: ['./script-setup.component.css']
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

  readonly productSearch = signal('');
  readonly requestTypeSearch = signal('');

  readonly selectedScriptId = signal<string | null>(null);
  readonly isCreateNewSelected = signal(false);
  readonly showCreateTile = signal(true);

  readonly createdScripts = signal<CreatedScript[]>([]);

  readonly showCreateScriptPopover = signal(false);
  readonly newScriptName = signal('');
  readonly newScriptDescription = signal('');

  readonly showVersionHistory = signal(false);
  readonly selectedScriptForHistory = signal<ExistingScript | null>(null);
  readonly selectedHistoricVersion = signal<VersionEntry | null>(null);

  readonly filteredProducts = computed(() => {
    const term = this.productSearch().toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p => p.label.toLowerCase().includes(term));
  });

  readonly filteredRequestTypes = computed(() => {
    const term = this.requestTypeSearch().toLowerCase().trim();
    let list = [...this.requestTypes];
    if (term) {
      list = list.filter(rt => rt.label.toLowerCase().includes(term));
    }
    return list;
  });

  selectedProductLabel(): string {
    const id = this.selectedProduct();
    return this.products.find(p => p.id === id)?.label || '';
  }

  selectedRequestTypeLabel(): string {
    const id = this.selectedRequestType();
    return this.requestTypes.find(r => r.id === id)?.label || '';
  }

  onProductSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.productSearch.set(value);
  }

  onRequestTypeSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.requestTypeSearch.set(value);
  }

  toggleProduct(id: string) {
    if (this.selectedProduct() === id) {
      this.selectedProduct.set(null);
      this.selectedRequestType.set(null);
    } else {
      this.selectedProduct.set(id);
      this.selectedRequestType.set(null);
      this.clearScriptSelection();
    }
  }

  toggleRequestType(id: string) {
    if (this.selectedRequestType() === id) {
      this.selectedRequestType.set(null);
    } else {
      this.selectedRequestType.set(id);
      this.clearScriptSelection();
    }
  }

  private clearScriptSelection() {
    this.selectedScriptId.set(null);
    this.isCreateNewSelected.set(false);
    this.selectedHistoricVersion.set(null);
    this.selectedScriptForHistory.set(null);
  }

  toggleCreateNew() {
    this.isCreateNewSelected.set(!this.isCreateNewSelected());
    if (this.isCreateNewSelected()) {
      this.selectedScriptId.set(null);
      this.selectedHistoricVersion.set(null);
      this.openCreatePopover();
    }
  }

  openCreatePopover() {
    this.newScriptName.set('');
    this.newScriptDescription.set('');
    this.showCreateScriptPopover.set(true);
  }

  cancelNewScript() {
    this.showCreateScriptPopover.set(false);
    this.isCreateNewSelected.set(false);
    this.newScriptName.set('');
    this.newScriptDescription.set('');
  }

  saveNewScript() {
    const name = this.newScriptName().trim();
    if (!name || !this.selectedProduct() || !this.selectedRequestType()) return;

    const description = this.newScriptDescription().trim();
    const productId = this.selectedProduct()!;
    const requestTypeId = this.selectedRequestType()!;

    const created: CreatedScript = {
      id: 'draft-' + Date.now(),
      name,
      description,
      lastEdited: new Date().toISOString().slice(0, 10),
      productId,
      requestTypeId
    };

    this.createdScripts.update(list => [created, ...list]);
    this.showCreateTile.set(false);
    this.selectedScriptId.set(created.id);
    this.isCreateNewSelected.set(false);
    this.showCreateScriptPopover.set(false);

    this.continue.emit({
      mode: 'new',
      scriptId: created.id,
      scriptFileId: undefined,
      scriptName: name,
      scriptDescription: description,
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
    this.showCreateTile.set(true);
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
        scriptName: draft.name,
        scriptDescription: draft.description,
        productId: this.selectedProduct()!,
        productLabel: this.selectedProductLabel(),
        requestTypeId: this.selectedRequestType()!,
        requestTypeLabel: this.selectedRequestTypeLabel()
      });
    }
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