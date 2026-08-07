import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CallCenterDemoComponent } from './prototype-migration/call-center-demo/call-center-demo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CallCenterDemoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent { }