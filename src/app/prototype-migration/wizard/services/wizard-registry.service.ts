import { Injectable, Type } from '@angular/core';

/**
 * Maps string IDs to Angular component classes so that wizard JSON
 * configs can reference components by name without importing them directly.
 */
@Injectable({ providedIn: 'root' })
export class WizardRegistryService {

  private readonly components = new Map<string, Type<any>>();

  /** Register a component under a string ID. */
  register(id: string, component: Type<any>): void {
    this.components.set(id, component);
  }

  /** Look up a component by its registered ID. */
  get(id: string): Type<any> | undefined {
    return this.components.get(id);
  }

  /** Check whether a component ID has been registered. */
  has(id: string): boolean {
    return this.components.has(id);
  }
}
