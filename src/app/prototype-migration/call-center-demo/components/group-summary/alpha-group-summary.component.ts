import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VulnerableClientActionComponent } from '../vulnerable-client-action/vulnerable-client-action.component';

@Component({
  selector: 'alpha-group-summary',
  standalone: true,
  imports: [
    CommonModule,
    VulnerableClientActionComponent, 
  ],
  templateUrl: './alpha-group-summary.component.html',
  styleUrls: ['./alpha-group-summary.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AlphaGroupSummaryComponent { }