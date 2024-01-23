import { expect } from 'chai';
import os from 'os';
import { fileURLToPath } from 'url';

import cjs from '../dist/index.cjs';
import {
  importModule,
} from '../dist/index.js';

function getSOFilename(name, platform) {
  switch (platform) {
    case 'darwin': return `${name}.dylib`;
    case 'win32': return `${name}.dll`;
    default: return `lib${name}.so`
  }
}

describe('Module loading', function() {
  const arch = os.arch();
  const platform = os.platform();
  it('should load module', function() {
    this.timeout(120000);
    const filename = getSOFilename('as-static-variables', platform);
    const url = new URL(`./so-samples/${platform}/${arch}/${filename}`, import.meta.url);
    const path = fileURLToPath(url);
    const module = importModule(path);
    expect(module.int32).to.equal(1234);
  })
  it('should throw when module is missing', function() {
    this.timeout(120000);
    const filename = getSOFilename('missing', platform);
    const url = new URL(`./so-samples/${platform}/${arch}/${filename}`, import.meta.url);
    const path = fileURLToPath(url);
    let error;
    try {
      importModule(path);
    } catch (err) {
      error = err;
    }
    expect(error).to.be.an('error');
  })
  it('should load module using CommonJS function', function() {
    this.timeout(120000);
    const filename = getSOFilename('as-static-variables', platform);
    const url = new URL(`./so-samples/${platform}/${arch}/${filename}`, import.meta.url);
    const path = fileURLToPath(url);
    const module = cjs.importModule(path);
    expect(module.int32).to.equal(1234);
  })
});
