import { Injectable, signal } from '@angular/core';

/**
 * Which full-screen overlay is showing.
 *
 * The overlays live in the app shell but are opened from deep inside the
 * screens, so the state cannot belong to either one. It is not context: an
 * overlay being open says nothing about which policy or client the user is
 * working on, so it stays out of PrototypeContextService.
 *
 * Only one can be open at a time, which is what makes opening a second one
 * close the first rather than stack them.
 *
 * This replaces alpha-ui-attr-toggle for these overlays. That mechanism reads
 * the attribute once, when ux-interactions-library.js is parsed, and binds a
 * listener there and then. Anything Angular renders later, such as a screen
 * reached by switching views, never gets a listener at all.
 */
@Injectable({ providedIn: 'root' })
export class OverlayService {
  private readonly openOverlay = signal<string | null>(null);

  /** The open overlay's id, or null when none is showing. */
  readonly current = this.openOverlay.asReadonly();

  isOpen(id: string): boolean {
    return this.openOverlay() === id;
  }

  open(id: string): void {
    this.openOverlay.set(id);
  }

  close(): void {
    this.openOverlay.set(null);
  }

  toggle(id: string): void {
    this.openOverlay.update((current) => (current === id ? null : id));
  }
}
