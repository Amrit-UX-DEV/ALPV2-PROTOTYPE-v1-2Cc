import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptSetupComponent } from '../script-management/script-setup.component';
import { ScriptBuilderComponent } from '../call-rep-scripts/script-builder/script-builder.component';
import { ScriptSetupSelection } from '../call-rep-scripts/script-builder/models/script-builder.models';

@Component({
  selector: 'alpha-work-plan',
  standalone: true,
  imports: [
    CommonModule,
    ScriptSetupComponent,
    ScriptBuilderComponent
  ],
  templateUrl: './alpha-work-plan.component.html',
  styleUrls: ['./alpha-work-plan.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AlphaWorkPlanComponent {

  readonly setupSelection = signal<ScriptSetupSelection | null>(null);

  onSetupContinue(selection: ScriptSetupSelection) {
    this.setupSelection.set(selection);
  }
}