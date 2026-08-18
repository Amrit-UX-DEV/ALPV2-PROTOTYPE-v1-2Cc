
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';  // adjust filename if different
import { PrototypeContextService } from './prototype-migration/context/prototype-context.service';
import { AppViewService } from './prototype-migration/ui/app-view.service';

/**
 * TEMPORARY, while the possible match summary is being built.
 *
 * The screen only exists inside a possible match context, so the app opens
 * straight into one rather than needing a search on every reload. Nothing is
 * faked: the context and its record are the real ones a search would find.
 * Remove this and the initializer below once the screen is settled, and the app
 * goes back to starting in no context.
 */
const OPEN_ON_POSSIBLE_MATCH = 'possible-match-pmr12345678910';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // Load the registry of searchable contexts, not a context. The app starts
    // in no context and stays there until a search finds something, so this
    // only has to be ready before the first search, and having it before the
    // first render keeps that free of a loading state.
    //
    // Both steps are one initializer because initializers run together, not in
    // turn, and opening a context has to happen after the registry it is looked
    // up in has loaded. Everything injected is taken before the first await,
    // since inject() is only available while the initializer is being called.
    provideAppInitializer(() => {
      const ctx = inject(PrototypeContextService);
      const views = inject(AppViewService);

      return ctx
        .loadIndex()
        .then(() => ctx.activate(OPEN_ON_POSSIBLE_MATCH))
        .then(() => views.show('search-summary'));
    }),
  ]
};
