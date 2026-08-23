# ALPV2-PROTOTYPE-v1-2Cc

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/Amrit-UX-DEV/ALPV2-PROTOTYPE-v1-2Cc)

## Building

```bash
npm ci
npm run build      # production, into dist/demo/browser
npm start          # dev server
```

`npm run build` is the only build command. Every host runs it, so none of them
holds its own idea of how this is built, and what a host produces is what you
get locally.

### Why production disables optimization

`ng build` with optimization on runs Angular's critical-CSS step (beasties),
which parses the whole stylesheet bundle through PostCSS. The bundle carries
around a dozen legacy IE gradient filters written as

```css
filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#80000000', ...);
```

An unquoted colon inside a declaration value is what PostCSS reports as
`Missed semicolon`, and the build dies there. The declarations are dead code:
they target IE 6 to 9. Until they are quoted or removed, the production
configuration keeps `optimization: false`, which is also why the CSS ships
unminified. Re-enabling it is worth doing, and needs a deploy to prove.

## Deploying

The app is a static SPA. A host needs three things:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist/demo/browser` |
| Node version | 22.16.0, pinned in `.node-version` |

Deep links need a rewrite to `index.html`. `src/_redirects` carries it and the
build copies it into the output, which is what Cloudflare Pages reads;
`netlify.toml` says the same thing for Netlify.

### Branches

- `develop` is the working trunk. Everything lands here. Never published.
- `main` takes occasional promotions from `develop`. Never published.
- `release/*` are frozen cuts, and the only branches a host builds.

A release branch is named `release/YYYY-MM-DD-short-label-audience`, dated for
the freeze in UK time, with a lowercase hyphenated label and the audience it
was cut for last:

```
release/2026-08-18-pension-dashboard-internal-review
```

The audience is one of `internal-review`, `stakeholder-review` or `demo`, so
the branch says who was given it as well as what and when.

Cut one per shareable piece of work and leave it alone afterwards. A later
change, however small, gets its own `release/...` rather than being pushed on
top of a cut somebody has already been given, so a link shared today shows the
same thing next week.
