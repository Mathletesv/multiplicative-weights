// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [svelte(), mdx()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  site: 'https://mathletesv.github.io',
  base: '/multiplicative-weights',
});
