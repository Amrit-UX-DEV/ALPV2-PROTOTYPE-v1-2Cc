
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';  // adjust filename if different
import { PrototypeContextService } from './prototype-migration/context/prototype-context.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // Load the registry of searchable contexts, not a context. The app starts
    // with nothing searched and stays that way until a search finds something,
    // so this only has to be ready before the first search, and having it before
    // the first render keeps that free of a loading state.
    provideAppInitializer(() => inject(PrototypeContextService).loadIndex()),
  ]
};
