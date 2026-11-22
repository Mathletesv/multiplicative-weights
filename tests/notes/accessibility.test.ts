import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAccessibleContent } from '../../src/lib/notes/accessible-html.ts';

test('rendered alternatives require accessible content rather than empty or hidden markup', () => {
  for (const html of ['', '<span> </span>', '<span aria-hidden="true">x</span>', '<span hidden>x</span>', '<!-- x -->', '<script>x</script>']) {
    assert.equal(hasAccessibleContent(html), false, html);
  }
  for (const html of ['<span>x plus one</span>', '<math><mi>x</mi></math>', '<span role="math" aria-label="x plus one"></span>']) {
    assert.equal(hasAccessibleContent(html), true, html);
  }
});
