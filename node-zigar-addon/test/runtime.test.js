import { expect } from 'chai';
import { readFile } from 'fs/promises';

describe('Runtime code', function() {
  it('should not contain "Unknown target"', async function() {
    const { pathname } = new URL('../src/addon.js.txt', import.meta.url);
    const code = await readFile(pathname, 'utf-8');
    expect(code).to.not.contain('Unknown target');
  })
})
