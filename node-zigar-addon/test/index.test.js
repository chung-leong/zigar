import { expect } from 'chai';
import os from 'os';

import {
  load,
} from '../dist/index.js';

function getLibraryExt(platform) {
  switch (platform) {
    case 'darwin': return 'dylib';
    case 'windows': return 'dll';
    default: return 'so';
  }
}

describe('Module loading', function() {
  const arch = os.arch();
  const platform = os.platform();
  const ext = getLibraryExt(platform);
  it('should load module', async function() {
    const { pathname } = new URL(`./samples/${platform}/${arch}/libintegers.${ext}`, import.meta.url);
    const module = await load(pathname);
  })
  it('should throw when module is missing', async function() {
    const { pathname } = new URL(`./samples/${platform}/${arch}/missing.${ext}`, import.meta.url);
    let error;
    try {
      await load(pathname);
    } catch (err) {
      error = err;
    }
    expect(error).to.be.an('error');
  })
});
