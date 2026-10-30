# Repository Guidelines

## Project Decisions

Teach multiplicative weights using Astro, Svelte, TypeScript, KaTeX, and SVG with D3 utilities. These choices are settled unless the user explicitly changes them. This directory is the Git repository root; its parent is a personal workspace. Keep the site static, with simulations running in the browser and no required server runtime.

Use the available laptop viewport width with small outer gutters. Do not impose a narrow maximum width on the page shell, lecture column, or content panels. A prose line-length limit may apply to paragraphs without restricting the surrounding layout.

## Website Explanatory Content

Never directly add or edit explanatory website text, including lesson prose, definitions, theorem statements, proofs, worked examples, explanatory captions, or instructional strings in components, Markdown, MDX, and data files. This content is user-authored. Do not bypass the rule through generated or imported replacement text. Implement layout, styling, interactions, and simulation logic without changing explanatory wording. Offer proposed content changes separately for the user to apply. Contributor and setup documentation may be maintained.

## Structure and Validation

Use `src/pages/` for routes, `src/content/` for owner-authored MDX, `src/data/` for the derived course index, `src/layouts/` for page shells, `src/components/` for Astro and Svelte components, `src/lib/` for TypeScript utilities and simulation logic, `src/styles/` for shared CSS, and `public/` for unprocessed assets. Lecture pages compose `LectureLayout.astro`, `ReadingLayout.astro`, and `BaseLayout.astro`, which includes KaTeX styles. Change shared design values in `src/styles/tokens.css`.

Run `npm run check` for Astro, TypeScript, and Svelte diagnostics. `npm run build` runs those checks and generates `dist/`; `npm run preview` serves that output. No unit test framework or coverage threshold is configured yet. Add meaningful simulation tests when introducing algorithm behavior.

## Modularity and Design Changes

Write highly modular code so the visual design can change easily even after most of the site is built.

- Separate owner-authored content, simulation mathematics, interaction state, and presentation. Pure TypeScript simulation modules must not depend on Svelte, the DOM, CSS, or chart geometry.
- Keep pages and MDX focused on content and composition. Put reusable page structure in layouts and visual behavior in focused components with narrow, typed props and events.
- Centralize semantic design tokens for colors, typography, spacing, widths, borders, and motion. Components should consume tokens rather than repeat design values or depend on page-specific selectors.
- Keep expert identities and simulation values independent of their colors, labels, and screen coordinates. Map data to visual properties at the rendering boundary.
- Let a lab controller own shared state and pass data to replaceable controls and diagrams. Views must not reach into sibling components or duplicate simulation calculations.
- Prefer composition through slots or snippets over large components with many mode flags. Keep styles scoped; avoid dependencies on another component's internal markup.
- Extract shared patterns when they become clear, while avoiding speculative frameworks and abstractions. Split modules by responsibility, not arbitrary line counts.
- Before finishing a feature, verify that changing its theme, rearranging its layout, or replacing its diagram would not require rewriting the algorithm or owner-authored explanations. Document public component contracts and test behavior rather than incidental markup.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
