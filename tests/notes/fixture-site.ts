import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));

/** Copy the actual application; published lecture sources are never touched by tests. */
export async function createFixtureSite(base = '/multiplicative-weights'): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'notes-site-test-'));
  try {
    for (const entry of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(path.join(repository, entry), path.join(directory, entry), { recursive: true });
    }
    await symlink(path.join(repository, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    for (const name of ['experts', 'games']) {
      const fixture = await readFile(new URL(`./fixtures/${name}.mdx`, import.meta.url), 'utf8');
      // Resolve the manual import against the copied lecture location.
      await writeFile(path.join(directory, `src/content/lectures/${name}.mdx`), fixture.replaceAll('../../../src/components/', '../../components/'));
    }
    const configPath = path.join(directory, 'astro.config.mjs');
    const config = await readFile(configPath, 'utf8');
    await writeFile(configPath, config.replace(/base: '[^']*'/, `base: ${JSON.stringify(base)}`));
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
