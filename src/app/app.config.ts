
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';  // adjust filename if different
import { PrototypeContextService } from './prototype-migration/context/prototype-context.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // Load the context before the first render so consumers never have to
    // guard against it being absent, and the header does not flash empty.
    provideAppInitializer(() => inject(PrototypeContextService).loadContext()),
  ]
};
