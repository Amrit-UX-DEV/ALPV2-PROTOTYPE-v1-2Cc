import { Injectable, computed, signal } from '@angular/core';

/** Where theme files live. Adding a theme means adding a file here. */
export const THEME_DATA_PATH = 'assets/data/themes';

/** Lists the themes that ship, and names the one that applies. */
export const THEME_INDEX_FILE = `${THEME_DATA_PATH}/index.json`;

/**
 * What the app falls back to when no theme is active.
 *
 * Turning every theme off is a supported state, not a broken one: the brand
 * tokens in src/index.css are ReAssure, so that is what shows, and the logo
 * has to say so.
 */
const UNTHEMED_LOGO_ALT = 'ReAssure';

/** One brand. The class is what its stylesheet scopes itself to. */
export interface Theme {
  id: string;
  name: string;
  class: string;
  logoAlt: string;
}

/** The contents of assets/data/themes/index.json. */
export interface ThemeIndex {
  active: string;
  themes: Theme[];
}

/**
 * Decides which brand the prototype wears.
 *
 * Every theme's CSS ships in every build. Each one is wrapped in
 * `@scope (.alp-theme-<id>)`, so a theme costs nothing until its class is on
 * the page, and turning one on is a matter of putting that class somewhere
 * above the app. That is all this service does, driven by a JSON file, so a
 * release cut for a different audience is a one-line edit rather than a
 * change to markup.
 *
 * The class goes on <body> rather than on the shell's container because the
 * scope root only has to be an ancestor, and body is an ancestor of things the
 * shell is not: the legacy interaction scripts append to it directly. Only
 * classes this service knows about are removed, so the version switcher's own
 * body classes are left alone.
 *
 * Applying happens explicitly rather than through an effect. The initializer
 * awaits load() before the first render, so the page is painted already
 * wearing the right brand instead of flashing the default and correcting
 * itself a frame later.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly available = signal<Theme[]>([]);
  private readonly activeId = signal('');

  /** Every theme that shipped, whether or not it is the active one. */
  readonly themes = this.available.asReadonly();

  /** The active theme, or undefined when the config turns them all off. */
  readonly theme = computed(() => this.available().find((t) => t.id === this.activeId()));

  /** What the brand logo should announce to a screen reader. */
  readonly logoAlt = computed(() => this.theme()?.logoAlt ?? UNTHEMED_LOGO_ALT);

  /**
   * Loads the theme config and dresses the page.
   *
   * A missing or unreadable file leaves the app unthemed rather than
   * half-branded, which is the same thing the config asks for when `active` is
   * empty, so a broken deploy still shows a coherent ReAssure app.
   */
  async load(): Promise<void> {
    try {
      const response = await fetch(`${THEME_INDEX_FILE}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const index = (await response.json()) as ThemeIndex;

      this.available.set(index.themes ?? []);
      this.use(index.active ?? '');
    } catch (err) {
      console.error('Failed to load the theme config, the app will run unthemed:', err);
    }
  }

  /**
   * Makes a theme current by id. An empty id turns theming off; an id nothing
   * matches is a typo in the config, so it says so rather than failing quietly.
   */
  use(id: string): void {
    this.activeId.set(id);

    if (id && !this.theme()) {
      console.error(`No theme with id '${id}' in ${THEME_INDEX_FILE}, running unthemed.`);
    }

    this.applyToDocument();
  }

  private applyToDocument(): void {
    const classes = document.body.classList;
    for (const theme of this.available()) classes.remove(theme.class);

    const active = this.theme();
    if (active) classes.add(active.class);
  }
}
