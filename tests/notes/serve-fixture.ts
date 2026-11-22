import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtureSite } from './fixture-site.ts';

const port = Number(process.argv.find((arg) => arg.startsWith('--port='))?.slice(7) ?? 4373);
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? '/multiplicative-weights';
const prefix = `${base.replace(/\/$/, '')}/`;
const directory = await createFixtureSite(base);
const astro = fileURLToPath(new URL('../../node_modules/astro/bin/astro.mjs', import.meta.url));
try {
  const { stdout } = await promisify(execFile)(process.execPath, [astro, 'build', '--root', directory], {
    cwd: directory, timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  process.stdout.write(stdout);
} catch (error) {
  const failure = error as { stdout?: string; stderr?: string; message?: string };
  process.stderr.write((failure.stdout ?? '') + (failure.stderr ?? '') + (failure.message ?? 'Fixture build failed.'));
  await rm(directory, { recursive: true, force: true });
  process.exit(1);
}
const mime: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://fixture.invalid');
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length));
    const outputRoot = path.join(directory, 'dist');
    const file = path.resolve(outputRoot, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
    if (!file.startsWith(outputRoot + path.sep)) { response.writeHead(404).end(); return; }
    const content = await readFile(file);
    response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
server.once('error', async (error) => {
  console.error(error.message);
  await rm(directory, { recursive: true, force: true });
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`Fixture: http://127.0.0.1:${port}${prefix}`));
async function cleanup(): Promise<void> {
  server.close();
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
}
process.once('SIGTERM', cleanup);
process.once('SIGINT', cleanup);
