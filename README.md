# Multiplicative Weights

A static teaching website built with Astro, Svelte, TypeScript, KaTeX, and SVG/D3. Lesson explanations are authored by the repository owner; see `AGENTS.md` for the content-editing restriction.

## Setup

Run commands from this directory, the Git repository root. Use a Node.js version satisfying the `engines.node` requirement in `package.json`.

```sh
npm ci
```

Commit `package-lock.json` when dependencies change. `node_modules/`, `.astro/`, and `dist/` are generated and ignored.

## Development and validation

| Command | Purpose |
| --- | --- |
| `npm run dev -- --background` | Start the development server in the background |
| `npm run astro -- dev status` | Show the development server URL and status |
| `npm run astro -- dev logs` | Read development server logs |
| `npm run astro -- dev stop` | Stop the background development server |
| `npm run check` | Check Astro, TypeScript, and Svelte files |
| `npm run build` | Run checks and build static output into `dist/` |
| `npm run preview` | Serve the production build locally |

There is no unit test framework yet. Introduce tests alongside simulation behavior.

## Source layout

```text
src/
  pages/        Overview and static section routes
  content/      Owner-authored section MDX
  data/         Build-time course index derived from MDX metadata
  layouts/      Shared document, reading, and lecture shells
  components/   Navigation, content slots, theorem/proof blocks, and SVG shell
  lib/          Pure TypeScript simulation functions
  styles/       Semantic design tokens and global CSS
public/         Unprocessed static assets
```

Use `src/layouts/BaseLayout.astro` for pages. An `.mdx` page directly under `src/pages/` can select it with frontmatter:

```yaml
---
layout: ../layouts/BaseLayout.astro
title: Multiplicative Weights
---
```

The Markdown pipeline supports `$...$` for inline math and `$$...$$` on separate lines for display math. Equations render at build time; the shared layout includes KaTeX's CSS and bundled fonts.

## Design review and authoring

The current site is a reading shell with three sections in order: Learning From Experts, Two Player Games, and Linear Programming. Each section has a single empty content slot; there are no predefined subsections, theorem statements, or exercises.

Edit section files in `src/content/lectures/`. Frontmatter controls the order, route slug, and title. The course index, navigation, and previous/next links are derived from these files. If you add level-two Markdown headings, they automatically populate the on-page outline; it stays hidden when there are no headings. Changing a heading also changes its generated anchor; preserve published headings or add explicit stable anchors when long-term links are needed.

To author a section, replace its `<ContentSlot />` with your own Markdown, mathematics, or components. The reusable `TheoremBlock` and `ProofBlock` components remain available for later authoring. The overview composition lives in `src/pages/index.astro`.

Change the visual design through `src/styles/tokens.css` first: colors, font families, type sizes, spacing, widths, and placeholder heights are centralized there. `ReadingLayout.astro` owns the reading column and responsive rail. The navigation, theorem panel, proof disclosure, and lecture pagination each have scoped component styles. No lesson source needs editing to change those designs.

Review the overview and each section on desktop and mobile. The desktop rail becomes a native Contents disclosure below 1,280 px. All pages are static and usable without JavaScript.

Import Svelte components into Astro or MDX pages and attach `client:visible` for hydration on entering the viewport, or `client:load` for immediately needed controls. Keep linked controls and diagrams in one parent Svelte component. Let Svelte manage SVG elements and use D3 utilities for scales and geometry. Put simulation calculations in `src/lib/`, without DOM dependencies. Browser-only APIs belong in Svelte lifecycle handlers rather than module initialization.

`src/components/SvgDiagram.svelte` provides a responsive SVG shell with a required accessible `label`, optional coordinate-system `width` and `height`, and a children snippet for SVG elements. Give interactive controls their own keyboard-accessible HTML elements outside the image.

## Static hosting

Run `npm run build` and deploy the contents of `dist/`. The deployed site requires no Node.js server or hosting adapter. All routes must remain prerendered.

When the hosting service checks out this repository, use its root as the project directory, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the publish directory.

Set Astro's `site` to the final public URL when known. For hosting under a subpath, also set `base` in `astro.config.mjs` and use `import.meta.env.BASE_URL` when referencing public assets and internal links. Keep this configuration independent of any particular hosting provider.
