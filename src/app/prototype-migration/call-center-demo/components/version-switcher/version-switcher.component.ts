import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-version-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-switcher.component.html',
  styleUrls: ['./version-switcher.component.css'],
})
export class VersionSwitcherComponent {

  readonly currentVersion = signal(1);

  selectVersion(version: number): void {
    this.currentVersion.set(version);
    
    // Remove all previous version classes
    document.body.classList.remove(
      'banner-version-1', 'banner-version-2', 'banner-version-3',
      'banner-version-4', 'banner-version-5'
    );
    
    // Add the new one
    document.body.classList.add(`banner-version-${version}`);
  }
}