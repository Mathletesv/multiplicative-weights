import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { Plugin as RemarkPlugin } from 'unified';
import type { Root } from 'mdast';
import type { Node } from 'unist';
import type { VFile } from 'vfile';
import type { NoteRegistry } from '../../lib/notes/types.ts';
import { createRegistry } from '../../lib/notes/registry.ts';
import { parseNote, walk, isElement, isMath, normalizeNamedSlots, componentPaths, components } from './source.ts';
import type { Element, ParsedNote } from './source.ts';
import { TypstCompiler } from './typst.ts';
import type { CompiledAsset } from './typst.ts';
import { validateOutput } from './output.ts';

const virtualId = 'virtual:note-registry';
const resolvedId = '\0' + virtualId;

interface CompiledNote {
  blocks: Array<CompiledAsset & { mathml?: string }>;
  math: string[];
}

/** One snapshot shared by the MDX transformer and virtual-module consumers. */
export default function notesSystem(): { integration: AstroIntegration; remarkPlugin: RemarkPlugin<[], Root> } {
  let root = '';
  let notesDirectory = '';
  let base = '/';
  let registry: NoteRegistry = { notes: {}, blocks: {} };
  let notes = new Map<string, ParsedNote>();
  let assets = new Map<string, CompiledAsset>();
  let compiledNotes = new Map<string, CompiledNote>();
  let preparation: Promise<void> = Promise.resolve();

  async function prepare(): Promise<void> {
    const files = (await readdir(notesDirectory)).filter((file) => file.endsWith('.mdx')).sort();
    const nextNotes = await Promise.all(files.map(async (name) => {
      const file = path.join(notesDirectory, name);
      return parseNote(file, await readFile(file, 'utf8'));
    }));
    const nextRegistry = createRegistry(nextNotes);
    const tokens = await readFile(path.join(root, 'src/styles/tokens.css'), 'utf8');
    const light = /--color-ink-light:\s*(#[a-fA-F0-9]{6})\s*;/.exec(tokens)?.[1];
    const dark = /--color-ink-dark:\s*(#[a-fA-F0-9]{6})\s*;/.exec(tokens)?.[1];
    if (!light || !dark) throw new Error('Typst requires six-digit --color-ink-light and --color-ink-dark tokens.');
    const compiler = new TypstCompiler(path.join(root, '.astro/notes/typst'), { light, dark });
    const nextAssets = new Map<string, CompiledAsset>();
    const nextCompiledNotes = new Map<string, CompiledNote>();
    for (const note of nextNotes) {
      const compiled: CompiledNote = { blocks: [], math: [] };
      for (const fragment of note.fragments) {
        const asset = await compiler.compile(fragment);
        nextAssets.set(asset.fileName, asset);
        const mathml = fragment.mathml ? await compiler.compileMath(fragment) : undefined;
        compiled.blocks.push({ ...asset, mathml });
      }
      for (const expression of note.math ?? []) {
        compiled.math.push(await compiler.compileMath(expression));
      }
      nextCompiledNotes.set(note.file, compiled);
    }
    // Publish atomically; the development server must not render a partial registry.
    registry = nextRegistry;
    notes = new Map(nextNotes.map((note) => [note.file, note]));
    assets = nextAssets;
    compiledNotes = nextCompiledNotes;
  }

  const remarkPlugin: RemarkPlugin<[], Root> = function () {
    return async (tree: Root, file: VFile) => {
      await preparation;
      const note = notes.get(file.path);
      if (!note) return;
      const imports = new Set<string>();
      for (const child of tree.children) {
        if (child.type !== 'mdxjsEsm') continue;
        for (const statement of child.data?.estree?.body ?? []) {
          if (statement.type === 'ImportDeclaration') for (const specifier of statement.specifiers) imports.add(specifier.local.name);
        }
      }
      const used = new Set<string>();
      const compiled = compiledNotes.get(note.file)!;
      let fragmentIndex = 0;
      let mathIndex = 0;
      walk(tree, (node: Node) => {
        if (note.math && isMath(node)) {
          const mathml = compiled.math[mathIndex++];
          if (!mathml) throw new Error(`Missing compiled Typst equation in ${note.file}.`);
          const display = node.type === 'math';
          const element: Element = {
            type: display ? 'mdxJsxFlowElement' : 'mdxJsxTextElement',
            name: 'TypstMath',
            attributes: [{ type: 'mdxJsxAttribute', name: 'mathml', value: mathml }],
            children: [],
            position: node.position,
          };
          if (display) element.attributes.push({ type: 'mdxJsxAttribute', name: 'display', value: null });
          Object.assign(node, element);
          used.add('TypstMath');
          return;
        }
        if (node.type === 'code') {
          const code = node as Node & { lang?: string; value: string };
          if (code.lang === 'typst-source') { code.lang = 'typst'; return; }
          if (code.lang !== 'typst') return;
          const fragment = note.fragments[fragmentIndex];
          const replacement: Element = {
            type: 'mdxJsxFlowElement', name: 'TypstBlock', attributes: [], children: [], position: node.position,
          };
          for (const [name, value] of Object.entries({ code: fragment.code, id: fragment.id, alt: fragment.alt, tex: fragment.tex })) {
            if (value !== undefined) replacement.attributes.push({ type: 'mdxJsxAttribute', name, value });
          }
          Object.assign(node, replacement);
        }
        if (!isElement(node) || !node.name || !Object.hasOwn(components, node.name)) return;
        normalizeNamedSlots(node);
        used.add(node.name);
        node.attributes.push({ type: 'mdxJsxAttribute', name: '__note', value: note.metadata.noteId });
        if (node.name === 'TypstBlock') {
          const asset = compiled.blocks[fragmentIndex++];
          if (!asset) throw new Error(`Missing compiled Typst fragment in ${note.file}.`);
          for (const [name, value] of Object.entries({ __asset: asset.fileName, __width: String(asset.width), __height: String(asset.height) })) {
            node.attributes.push({ type: 'mdxJsxAttribute', name, value });
          }
          if (asset.mathml) node.attributes.push({ type: 'mdxJsxAttribute', name: '__mathml', value: asset.mathml });
        }
      });
      // Parse generated import declarations to supply valid ESTree to the MDX compiler.
      const importLines = [...used].filter((name) => !imports.has(name)).map((name) =>
        `import ${name} from ${JSON.stringify(path.join(root, componentPaths[name]))};`);
      if (importLines.length) {
        const generated = parseNote(path.join(notesDirectory, '__imports.mdx'),
          `---\norder: 1\nslug: imports\ntitle: Imports\n---\n${importLines.join('\n')}\n`);
        tree.children.unshift(...generated.tree.children);
      }
    };
  };

  const integration: AstroIntegration = {
    name: 'note-authoring',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig }) => {
        root = fileURLToPath(config.root);
        notesDirectory = path.resolve(fileURLToPath(new URL('content/lectures/', config.srcDir)));
        base = config.base;
        preparation = prepare();
        await preparation;
        updateConfig({ vite: { plugins: [{
          name: 'note-registry',
          resolveId(id) { if (id === virtualId) return resolvedId; },
          async load(id) {
            if (id !== resolvedId) return;
            await preparation;
            return `export const registry = ${JSON.stringify(registry)};`;
          },
          configureServer(server) {
            server.watcher.add([notesDirectory, path.join(root, 'src/styles/tokens.css')]);
            const onChange = (file: string) => {
              if (!(path.dirname(file) === notesDirectory && file.endsWith('.mdx')) && file !== path.join(root, 'src/styles/tokens.css')) return;
              // Assign the promise immediately so an HMR transform cannot see a stale snapshot.
              preparation = preparation.catch(() => {}).then(prepare);
              preparation.then(() => {
                server.moduleGraph.invalidateAll();
                server.ws.send({ type: 'full-reload' });
              }).catch((error) => {
                server.moduleGraph.invalidateAll();
                server.ws.send({ type: 'error', err: { message: error.message, stack: error.stack } });
              });
            };
            server.watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
            server.httpServer?.once('close', () => {
              server.watcher.off('add', onChange).off('change', onChange).off('unlink', onChange);
            });
            server.middlewares.use(async (req, res, next) => {
              // Astro removes the site base from req.url before this middleware runs.
              const pathname = new URL(req.originalUrl ?? req.url ?? '/', 'http://notes.invalid').pathname;
              const prefix = `${base.replace(/\/$/, '')}/`;
              const name = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
              if (!name.startsWith('_notes/typst/')) return next();
              try {
                await preparation;
                const asset = assets.get(name);
                if (!asset) { res.statusCode = 404; res.end(); return; }
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(asset.svg);
              } catch (error) { next(error as Error); }
            });
          },
        }] } });
      },
      'astro:build:done': async ({ dir }) => {
        await preparation;
        for (const asset of assets.values()) {
          const output = fileURLToPath(new URL(asset.fileName, dir));
          await mkdir(path.dirname(output), { recursive: true });
          await writeFile(output, asset.svg);
        }
        await validateOutput(fileURLToPath(dir), base, registry);
      },
    },
  };
  return { integration, remarkPlugin };
}
