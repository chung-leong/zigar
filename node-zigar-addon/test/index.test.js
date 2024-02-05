import { expect } from 'chai';
import os from 'os';
import { fileURLToPath } from 'url';
import { addPlatformExt } from '../../zigar-compiler/src/configuration.js';

import cjs from '../dist/index.cjs';

import {
  importModule,
} from '../dist/index.js';


describe('Module loading', function() {
  const options = {
    arch: os.arch(),
    platform: os.platform(),  
  };
  const getModulePath = (name) => {
    const path = fileURLToPath(new URL(`./so-samples/${name}.zigar`, import.meta.url));
    return addPlatformExt(path, options);
  };
  it('should load module', function() {
    this.timeout(120000);
    const path = getModulePath('integers');
    const module = importModule(path);
    expect(module.int32).to.equal(1234);
  })
  it('should throw when module is missing', function() {
    this.timeout(120000);
    const path = getModulePath('missing');
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
    const path = getModulePath('integers');
    const module = cjs.importModule(path);
    expect(module.int32).to.equal(1234);
  })
});
