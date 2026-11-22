import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultTreeAdapter, parse, serializeOuter } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import type { TypstAsset } from '../../lib/notes/types.ts';
import { typstPixelsPerEm } from '../../lib/notes/types.ts';
import { diagnostic } from '../../lib/notes/registry.ts';
import type { TypstFragment } from './source.ts';

const execute = promisify(execFile);
export const typstVersion = '0.15.1';

export interface CompiledAsset extends TypstAsset { svg: string }

function onlyElement(parent: DefaultTreeAdapterMap['element'] | undefined) {
  const children = parent?.childNodes.filter((node) => !defaultTreeAdapter.isTextNode(node) || node.value.trim()) ?? [];
  return children.length === 1 && defaultTreeAdapter.isElementNode(children[0]) ? children[0] : undefined;
}

/** Build-only compiler. One isolated root per fragment; no document files are exposed. */
export class TypstCompiler {
  private pending = new Map<string, Promise<string>>();
  private checkedVersion?: Promise<void>;
  private cacheDirectory: string;
  private ink: { light: string; dark: string };
  constructor(cacheDirectory: string, ink: { light: string; dark: string }) {
    this.cacheDirectory = cacheDirectory;
    this.ink = ink;
  }

  private async checkVersion(): Promise<void> {
    this.checkedVersion ??= execute('typst', ['--version']).then(({ stdout }) => {
      if (!stdout.startsWith(`typst ${typstVersion} `)) throw new Error(`Expected Typst ${typstVersion}; found ${stdout.trim()}. See README.md.`);
    }).catch((error) => {
      this.checkedVersion = undefined;
      throw new Error(`Typst compiler unavailable: ${error.message}`);
    });
    return this.checkedVersion;
  }

  async compile(fragment: TypstFragment): Promise<CompiledAsset> {
    const prelude = [
      '#set page(width: auto, height: auto, margin: 0pt, fill: none)',
      `#set text(font: "New Computer Modern", size: ${typstPixelsPerEm * 3 / 4}pt, fill: rgb("${this.ink.light}"))`,
      '#set math.equation(numbering: none)',
    ].join('\n') + '\n';
    const { key, output: svg } = await this.render(fragment, prelude, 'svg');
    const viewBox = /\bviewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number);
    if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
      throw diagnostic(fragment.source, 'Typst produced invalid or empty SVG dimensions.');
    }
    return { fileName: `_notes/typst/${key}.svg`, width: viewBox[2] * 4 / 3, height: viewBox[3] * 4 / 3, svg };
  }

  async compileMath(fragment: TypstFragment): Promise<string> {
    const { output } = await this.render(fragment, '', 'html');
    const html = parse(output).childNodes.filter(defaultTreeAdapter.isElementNode).find((node) => node.tagName === 'html');
    const body = html?.childNodes.filter(defaultTreeAdapter.isElementNode).find((node) => node.tagName === 'body');
    const element = onlyElement(body);
    const math = element?.tagName === 'p' ? onlyElement(element) : element;
    if (math?.namespaceURI !== 'http://www.w3.org/1998/Math/MathML' || math.tagName !== 'math' || !math.childNodes.length) {
      throw diagnostic(fragment.source, 'Expected one Typst equation in MathML. For other Typst content, supply an accessible alternative.');
    }
    return serializeOuter(math);
  }

  private async render(fragment: TypstFragment, prelude: string, format: 'svg' | 'html') {
    // This is a documented self-contained subset, not an untrusted-code sandbox.
    if (/\b(?:import|include)\b/.test(fragment.code)) {
      throw diagnostic(fragment.source, 'Typst imports/includes are unsupported; use a self-contained fragment.');
    }
    const key = createHash('sha256').update(JSON.stringify({
      code: fragment.code, prelude, version: typstVersion, fonts: 'embedded-only', format,
      darkInk: format === 'svg' ? this.ink.dark : undefined,
    })).digest('hex');
    let job = this.pending.get(key);
    if (!job) {
      job = this.compileUncached(fragment, prelude, key, format);
      this.pending.set(key, job);
    }
    try { return { key, output: await job }; }
    catch (error) { this.pending.delete(key); throw error; }
  }

  private async compileUncached(fragment: TypstFragment, prelude: string, key: string, format: 'svg' | 'html'): Promise<string> {
    await this.checkVersion();
    await mkdir(this.cacheDirectory, { recursive: true });
    const cached = path.join(this.cacheDirectory, `${key}.${format}`);
    try { return await readFile(cached, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const temporary = await mkdtemp(path.join(this.cacheDirectory, 'compile-'));
      const input = path.join(temporary, 'fragment.typ');
      const output = path.join(temporary, `fragment.${format}`);
      const features = format === 'html' ? ['--features', 'html'] : [];
      try {
        await writeFile(input, prelude + fragment.code);
        await execute('typst', [
          'compile', '--root', temporary, '--ignore-system-fonts', '--diagnostic-format', 'short', ...features, input, output,
        ], { timeout: 30_000, maxBuffer: 1024 * 1024 });
        let markup = await readFile(output, 'utf8');
        if (format === 'svg') {
          const { light, dark } = this.ink;
          const style = `<style>@media (prefers-color-scheme: dark) { [fill="${light}" i] { fill: ${dark}; } [stroke="${light}" i] { stroke: ${dark}; } }</style>`;
          markup = markup.replace(/<svg\b[^>]*>/, '$&' + style);
        }
        await writeFile(cached, markup);
        return markup;
      } catch (error) {
        const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message;
        const preludeLines = prelude.split('\n').length - 1;
        const detail = stderr.replace(/(?:[^\s]*[/\\])?fragment\.typ:(\d+):(\d+)/g, (_match, line, column) =>
          `${fragment.source.file}:${Math.max(fragment.source.line, fragment.source.line + Number(line) - preludeLines - 1)}:${column}`);
        throw diagnostic(fragment.source, `Typst compilation failed:\n${detail.trim()}`);
      } finally { await rm(temporary, { recursive: true, force: true }); }
    }
  }
}
