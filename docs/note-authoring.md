# Note blocks and references

Write notes in `src/content/lectures/*.mdx`. The notes integration supplies the components below automatically; existing imports of `TheoremBlock` and `ProofBlock` still work. Keep explanatory wording in your MDX, not in the presentation components.

## Statements and references

```mdx
<TheoremBlock id="result" title="Your title">

Your statement, including ordinary Markdown and $inline$ mathematics.

</TheoremBlock>

<StatementBlock id="definition" kind="definition">

Your definition.

</StatementBlock>

<BlockRef target="result" />
<BlockRef target="temporary-preview/result">Your link wording</BlockRef>
```

`StatementBlock` supports `theorem`, `lemma`, `proposition`, `corollary`, `definition`, `example`, and `exercise`. These share a sequence within a section. Equations have their own sequence. A default reference label is generated from the kind and number, for example `Theorem 1.1`. An optional default slot replaces the link wording without changing its destination.

IDs must be lowercase words separated by hyphens and unique across the page, including headings and HTML anchors. `page-title` and `main-content` are reserved. Once a link is published, keep its ID even if you change its wording or position. Numbers can change when blocks move; URLs do not.

Targets are either local IDs or `note-id/local-id`. A note's identity defaults to its frontmatter `slug`; an optional `noteId` can preserve identity when its route slug changes. Preserving an old public route/redirect after a route change is a separate hosting task. Section `order`, route slugs, and note identities must each be unique.

Use `NoteBlock` for an unnumbered paragraph, figure, or proof step:

```mdx
<NoteBlock id="step" title="Your label">

Your material.

</NoteBlock>
```

Click a block title or equation number to copy its permalink. If clipboard access is unavailable, the link opens its target.

The original `<TheoremBlock number={7}>` API still displays `Theorem 07`. Explicit numbers reserve their positions in the section sequence and duplicate explicit numbers fail the build. Prefer generated numbering for new material.

## Proofs and hints

```mdx
<ProofBlock id="proof" for="result">

Your proof.

<NoteBlock id="proof-step">Your referable step.</NoteBlock>

</ProofBlock>

<StatementBlock id="problem" kind="exercise">Your exercise.</StatementBlock>

<HintBlock id="hint-one" for="problem">Your hint.</HintBlock>
<HintBlock id="hint-two" for="problem">Your next hint.</HintBlock>
```

`for` is optional. A proof may associate with a theorem, lemma, proposition, or corollary; a hint may associate with an exercise. Associations can be local or fully qualified. They supply reference labels such as `Proof of Theorem 1.1` and `Hint 2 for Exercise 1.2`.

Disclosures start closed. Use `open` or `open={true}` to start open. `open={false}` starts closed. Disclosures are independent and may be nested. Click the disclosure marker or press Enter while the summary has focus to toggle it. For a custom summary, supply text or inline formatting in the named slot.

```mdx
<ProofBlock id="proof-detail">
  <span slot="summary">Your summary</span>

Your body.

</ProofBlock>
```

`DisclosureBlock` exposes the same contract with `kind="proof"` or `kind="hint"`. The older unanchored `<ProofBlock>` remains usable, but needs an ID before it can be referenced or associated.

Proofs with multiple steps start with the first one visible. Each Markdown paragraph, top-level list item, and row of a multiline Typst MathML equation is a step. A fenced Typst SVG is a single step. Press **N** while focus is inside an open proof to reveal the next step. Closing and reopening a proof keeps its progress. Readers can show the whole proof or start over. Use `ProofBlock` or an explicit `kind="proof"` on `DisclosureBlock`.

Direct links to proofs or nested steps open all enclosing disclosures and reveal any steps through the destination. Clicking a reference moves keyboard focus to the destination, while opening a page with a fragment lets the browser retain focus. Linking to a theorem leaves its proof closed. Printing shows the full proofs and restores reading progress afterward. With JavaScript disabled, opening a proof shows its entire content.

## Typst math

Add `math: typst` to a lecture's YAML frontmatter to use Typst syntax inside `$...$` for inline math and between `$$` lines for display math.

```mdx
Inline math can use $eta in (0, 1)$.

$$
sum_(i=1)^n x_i >= 0
$$
```

The build extracts native MathML from the pinned Typst compiler's experimental HTML export. The browser renders it alongside the lecture text. Lectures without this setting use KaTeX for dollar-delimited math.

## Typst display blocks

Install **Typst 0.15.1** on `PATH` from the [official release](https://github.com/typst/typst/releases/tag/v0.15.1), or with `cargo install --locked typst-cli --version 0.15.1`. Confirm with `typst --version`. CI installs the pinned official Linux release and verifies its SHA-256 digest.

Render a self-contained fragment in a `typst` fence. Include Typst's own math delimiters:

````mdx
```typst id="formula" alt="Your text equivalent of the expression."
$ a^2 + b^2 = c^2 $
```
````

The ID is optional for a block that does not need numbering or references. Supply `alt` or `tex` for accessibility. In a lecture with `math: typst`, a block containing a single equation can omit both and use generated MathML. Metadata values must be quoted. Double quotes follow JSON escaping, while single quotes preserve backslashes literally. For a structured accessible TeX counterpart, use:

````mdx
```typst id="fraction" tex='\frac{a}{b}'
$ a / b $
```
````

The visible result is a Typst SVG. The `tex` equivalent renders to KaTeX HTML/MathML, visually hidden and available to assistive technology. The image is hidden from assistive technology in this case to avoid duplicate reading. Use a text equivalent only when it can adequately express the mathematics; complex derivations benefit from a structured counterpart.

For an extended accessible alternative, use a literal `code` prop and the named slot:

```mdx
<TypstBlock id="expression" code="$ x + 1 $">
  <span slot="alternative">Your accessible equivalent.</span>
</TypstBlock>
```

The named slot takes precedence over `tex` and `alt`. When `math: typst` is enabled, a single equation without an explicit alternative uses generated MathML.

Compilation happens during development/build, using only the pinned compiler's embedded fonts. The shared technical prelude sets tight transparent bounds, a baseline mathematical size, and the ink color from `src/styles/tokens.css`. Rendered sizing follows the existing body typography token. Keep proof prose in MDX so it can reflow. Wide equations scroll in their own region, with numbers to the right on wide layouts and below on narrow layouts.

Imports/includes are outside the supported subset, as are external files and Typst packages. The compiler uses an isolated project root. This supports trusted repository-authored snippets; it is not a service for compiling untrusted submissions. Internal Typst labels do not create website references; place referable boundaries in HTML blocks instead.

Use `typst-source` to show source code.

## Static metadata and failure behavior

The scanner reads MDX without executing it. Use the documented component names directly. IDs, targets, kinds, associations, titles, and Typst `code`/alternatives must be literal strings. Numbers must be literal positive integers. Spread props, computed structural metadata, aliased component names, and blocks generated by JavaScript loops are outside the registered authoring contract. Use ordinary MDX for content and composition.

Builds fail for malformed metadata, duplicate/reserved anchors, conflicting numbers, unresolved references, invalid associations, missing Typst alternatives, or compiler failures. Diagnostics include source filenames and positions. A final HTML pass checks that each registered target and generated reference has exactly one emitted destination, including collisions introduced by custom components.

Development watches note creation, changes, deletion, and shared color tokens. It regenerates the registry, recompiles affected assets, invalidates referencing pages, and reports errors without serving a partial registry. Typst output is cached under `.astro/notes/typst/`. SVGs are served locally in development and emitted to `dist/_notes/typst/` in production. MathML is embedded in the page HTML. Cache keys include source, output format, prelude, compiler version, and embedded-font mode. Delete `.astro/notes/` to clear the cache.

No compiler or WASM is shipped to readers. Build-time parsing, compilation, and lifecycle hooks live in `src/integrations/notes/`. Reference and numbering rules live in `src/lib/notes/`, presentation in `src/components/blocks/`, and browser enhancements in `src/scripts/`.

## Tests

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run check
npm run build
```

Node discovers tests in `tests/notes/*.test.ts`. They cover source extraction, reference/numbering rules, final output validation, the actual pinned Typst compiler, development invalidation/recovery, and complete Astro fixture builds at both hosting bases. Playwright discovers browser tests in `tests/browser/*.spec.ts` and starts its own temporary static fixture sites.

The browser fixtures copy the application to temporary directories and fill the experts and games lectures with neutral test material from `tests/notes/fixtures/`. They run under both `/` and `/multiplicative-weights/`; the real lecture sources and production build are not populated by these tests. Coverage includes keyboard toggles, nested/direct/same-hash links, history, accessible math output, copy failures, print state, 320 px reflow, and disabled JavaScript. Generated test artifacts are ignored by Git.
