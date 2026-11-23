# Multiplicative Weights

A static teaching website built with Astro, Svelte, TypeScript, KaTeX, and SVG/D3. Lesson explanations are authored by the repository owner; see `AGENTS.md` for the content-editing restriction.

## Setup

Run commands from this directory, the Git repository root. Use a Node.js version satisfying the `engines.node` requirement in `package.json`.

```sh
npm ci
```

Install Typst **0.15.1** on `PATH` to render Typst blocks and run the compiler tests. See the [note authoring guide](docs/note-authoring.md) for installation and supported syntax.

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
| `npm test` | Run note, search, Typst compiler, and expert-game tests |
| `npm run test:browser` | Build temporary fixture sites and run interaction tests in Chromium |

Node discovers tests in `tests/*/*.test.ts`. Browser tests use Playwright and live in `tests/browser/`. Run `npx playwright install chromium` once before browser testing.

## Source layout

```text
src/
  pages/        Overview and static section routes
  content/      Owner-authored section MDX
  data/         Build-time course index derived from MDX metadata
  layouts/      Shared document, reading, and lecture shells
  components/   Navigation, content slots, theorem/proof blocks, and SVG shell
  lib/          Pure TypeScript simulation functions and shared note rules
  integrations/ Build-only note parsing, reference registry, and Typst compilation
  scripts/      Browser enhancements for note navigation, printing, and search
  styles/       Semantic design tokens and global CSS
public/         Unprocessed static assets
docs/           Contributor and component authoring documentation
tests/          Unit tests, browser tests, and isolated authoring fixtures
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

The course starts with Section 0, Overview, followed by Introduction, Multiplicative Weight Updates, Two Player Games, Linear Programming, and Temporary Preview. Section 5 contains the note block and equation examples. Introduction includes two ten-round expert games. A collapsible replay after the regret definition shows realized regret round by round. Multiplicative Weight Updates embeds a weight simulation and a fair-coin expert game. Two Player Games includes the Hidden Coin payoff calculator and the playable MWU hider.

Edit section files in `src/content/lectures/`. Frontmatter controls the order, route slug, and title. The course index, navigation, and previous/next links are derived from these files. If you add level-two Markdown headings, they automatically populate the on-page outline; it stays hidden when there are no headings. Changing a heading also changes its generated anchor; preserve published headings or add explicit stable anchors when long-term links are needed.

The build generates `search-index.json` from lecture MDX and the note registry. The Search page fetches it on the first query and matches locally in the browser. Adding or changing a lecture updates the index on the next build.

To author a section, replace its `<ContentSlot />` with your own Markdown, mathematics, or components. The reusable `TheoremBlock` and `ProofBlock` components remain available for later authoring. The overview composition lives in `src/pages/index.astro`.

The [note authoring guide](docs/note-authoring.md) documents automatic theorem numbering, stable block references, proof/hint disclosures, Typst fences, accessible mathematical alternatives, and component contracts. Components are automatically available in lecture MDX. Test fixtures populate temporary copies of the first lectures without changing the published notes.

Change the visual design through `src/styles/tokens.css` first: colors, font families, type sizes, spacing, widths, and placeholder heights are centralized there. `ReadingLayout.astro` owns the reading column and responsive rail. The navigation, theorem panel, proof disclosure, and lecture pagination each have scoped component styles. No lesson source needs editing to change those designs.

Review the overview and each section on desktop and mobile. The desktop rail becomes a native Contents disclosure below 1,280 px. Reading and navigation work without JavaScript. Search and the expert games require it.

The site follows the browser's light or dark preference. The header toggle saves an explicit choice on that browser. Both palettes live in `src/styles/tokens.css`. Typst's generated SVGs use the light and dark ink tokens to match the page.

Import Svelte components into Astro or MDX pages and attach `client:visible` for hydration on entering the viewport, or `client:load` for immediately needed controls. Keep linked controls and diagrams in one parent Svelte component. Let Svelte manage SVG elements and use D3 utilities for scales and geometry. Put simulation calculations in `src/lib/`, without DOM dependencies. Browser-only APIs belong in Svelte lifecycle handlers rather than module initialization.

`src/components/experts/ExpertGame.svelte` accepts `preset="reliable-experts"`, `preset="mixed-accuracy"`, or `preset="coin-flip-experts"` and the optional `conjectures` prop. Pass `collapsible` to start the game in a closed disclosure that keeps its progress. The browser draws a fresh board on load and on **New game**. The defaults show numbered conjectures with hidden verdicts. For authored statements, pass at least ten distinct `{ prompt, verdict }` pairs. The game samples them without replacement and preserves each verdict across boards. `src/lib/experts/game.ts` owns seeded board generation, scoring, and the visible round state. Set `recordForReplay` on the opening mixed-accuracy game and mount `RegretReplay` later on the same page. Opening the disclosure immediately shows an independent mixed-accuracy game with `showRegret`. Once the opening game has answered rounds, a control switches between live play and replay in the same panel. Closing the disclosure preserves both views.

`src/components/experts/WeightSimulation.svelte` starts in a closed disclosure with a horizon of 30 decisions. Readers can choose 20–50 decisions and adjust ε from 0 to 1. The initial ε uses the chapter's learning-rate formula. Changing ε pauses autoplay and replays the same losses through the current decision with the new rate. Changing the horizon restarts the current loss sequence. Loading the widget or pressing Reset draws a new set of Gaussian parameters and generates a new loss sequence. Closing the disclosure pauses autoplay and keeps progress. `src/lib/experts/weights.ts` samples from the current weights before applying each round's losses and tracks each expert's cumulative loss and the algorithm's total sampled loss. Each expert's losses come from a Gaussian truncated to `[0, 1]`. The cards display the underlying Gaussian's mean μ and standard deviation σ, drawn without replacement from `0.20–0.80` and `0.06–0.23`, respectively, in hundredth increments.

With focus inside an open expert game, press **T** or **F** to submit a prediction. Press **N** inside an expert game, regret replay, or weight simulation to activate its available step control. Set `data-widget-shortcuts` and attach `widgetShortcuts` on a widget container. Mark its keyboard controls with `data-widget-shortcut` and the corresponding single letter in `aria-keyshortcuts`.

`src/components/SvgDiagram.svelte` provides a responsive SVG shell with a required accessible `label`, optional coordinate-system `width` and `height`, and a children snippet for SVG elements. Give interactive controls their own keyboard-accessible HTML elements outside the image.

`src/components/games/` contains the two Hidden Coin widgets. The calculator accepts each player's probability of choosing red. In the playable widget, the reader picks boxes as Bob and Alice commits a hide before every pick. Alice uses Bob's payoffs directly as losses in her MWU update with ε = 0.5. `src/lib/games/hidden-coin.ts` owns the payoff and update rules.

## Static hosting

Run `npm run build` and deploy the contents of `dist/`. The deployed site requires no Node.js server or hosting adapter. All routes must remain prerendered.

When the hosting service checks out this repository, use its root as the project directory, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the publish directory.

Set Astro's `site` to the final public URL when known. For hosting under a subpath, also set `base` in `astro.config.mjs` and use `import.meta.env.BASE_URL` when referencing public assets and internal links. Keep this configuration independent of any particular hosting provider.
