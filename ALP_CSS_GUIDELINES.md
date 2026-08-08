# ALP CSS / Design System Guidelines

`ALP` = Alpha design system prefix for the Reassure call-center prototype.

## 1. Single source of truth

All styles for the call-center demo live in the global design system:

```
src/assets/styles/alp-design-system/
```

Component-level `.component.css` files are **not used**. Every call-center component should have its `styleUrls` array removed from the `@Component()` decorator.

## 2. Folder structure

```
alp-design-system/
├── _index.css              # Public barrel — import this to load everything
├── tokens/                 # Design tokens only
│   ├── primitives/         # Raw values: colors, spacing, typography, radius, shadows, elevation
│   └── semantic/           # Meaningful aliases: theme, status, content-types
├── core/                   # Reset, base, utilities
├── components/             # Reusable UI components
│   ├── buttons.css
│   ├── cards.css
│   ├── tiles.css
│   ├── tags.css
│   ├── badges.css
│   ├── signposts.css
│   ├── modals.css
│   ├── popovers.css
│   ├── inputs.css
│   ├── connectors.css
│   ├── journey.css
│   └── script-builder-shell.css
└── layouts/                # Page / feature-level layouts
    ├── script-builder.css
    ├── script-setup.css
    └── recent-callers.css
```

## 3. Naming convention

- All classes start with `.alp-`.
- BEM pattern: `.alp-block__element--modifier`.
- Examples:
  - `.alp-button`
  - `.alp-button--primary`
  - `.alp-card__title`
  - `.alp-card--selected`

## 4. Tokens first

Never use raw hex / rgb values in component files. Use tokens:

```css
/* Good */
.alp-button--primary {
  background: var(--alp-color-brand);
  color: var(--alp-color-brand-text);
}

/* Bad */
.alp-button--primary {
  background: #444f83;
  color: white;
}
```

Common token families:

- `--alp-color-brand` / `--alp-color-brand-soft` / `--alp-color-brand-hover`
- `--alp-color-text` / `--alp-color-text-muted` / `--alp-color-text-soft`
- `--alp-color-surface` / `--alp-color-background` / `--alp-color-surface-raised`
- `--alp-color-border` / `--alp-color-border-strong`
- `--alp-color-prompt` / `--alp-color-question` / `--alp-color-required-check` / `--alp-color-log-task` / `--alp-color-end-call`
- `--alp-space-1` ... `--alp-space-8`
- `--alp-radius-sm` / `--alp-radius-md` / `--alp-radius-lg` / `--alp-radius-full`
- `--alp-shadow-sm` / `--alp-shadow-md` / `--alp-shadow-lg`
- `--alp-font-size-xs` / `--alp-font-size-sm` / `--alp-font-size-md` / `--alp-font-size-lg` / `--alp-font-size-xl`

If a token does not exist for a value you need, add it to the appropriate primitive file and then create a semantic alias if needed.

## 5. Adding a new component style

1. Decide which design-system file the styles belong to (buttons, cards, tiles, etc.).
2. Append the new `.alp-*` classes to that file.
3. Use tokens only.
4. Do not create a new `.component.css` file.

## 6. Content type colors

Call-center script step content types use the following semantic tokens:

| Type | Token | Preview |
|------|-------|---------|
| Prompt | `--alp-color-prompt` | blue |
| Question | `--alp-color-question` | purple |
| Required check | `--alp-color-required-check` | green |
| Log task | `--alp-color-log-task` | amber |
| End call | `--alp-color-end-call` | red |

Apply them via `[data-type]` selectors in `components/cards.css` and `components/badges.css`.

## 7. Status colors

| Status | Token |
|--------|-------|
| Success | `--alp-color-success` |
| Warning | `--alp-color-warning` |
| Danger / error | `--alp-color-danger` |
| Info | `--alp-color-info` |
| Neutral / disabled | `--alp-color-neutral` |

## 8. Legacy aliases

A few legacy token names are preserved as aliases during the migration so that older code continues to work:

- `--alp-color-brand-primary` → `--alp-color-brand`
- `--alp-color-brand-primary-soft` → `--alp-color-brand-soft`
- `--alp-color-brand-primary-hover` → `--alp-color-brand-hover`

Do not use these aliases in new code. Use the new semantic names instead.

## 9. Loading order

The design system is loaded globally at the end of the legacy prototype stack, via `src/assets/styles/prototype-migration/p-drive-collection/_index.css`:

```css
@import '../../alp-design-system/_index.css';
```

This keeps it in the same position as the old `script-builder.styles.css` and after the Bootstrap / Font Awesome / legacy CSS stack, so ALP styles can override when necessary.

## 10. Line endings

All CSS files must use LF line endings. If you are on Windows, configure your editor to use LF for CSS files to avoid Angular compiler parse errors.

## 11. When in doubt

- Keep the class prefix as `.alp-`.
- Keep the file in the design system, not in a component folder.
- Use a token instead of a raw value.
- Group by pattern (buttons, cards, tags) rather than by feature.
