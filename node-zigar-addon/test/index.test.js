import { expect } from 'chai';
import os from 'os';
import { fileURLToPath } from 'url';
import { createConfig } from '../../zigar-compiler/src/compiler.js';

import cjs from '../dist/index.cjs';

import {
  getGCStatistics,
  importModule,
} from '../dist/index.js';


describe('Module loading', function() {
  const options = {
    arch: os.arch(),
    platform: os.platform(),  
  };
  const getModulePath = (name) => {
    const modPath = fileURLToPath(new URL(`./sample-modules/${name}.zigar`, import.meta.url));
    const { outputPath } = createConfig(null, modPath, options);
    return outputPath;
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
  it('should get gc statistics', function() {
    const stats = getGCStatistics();
    expect(stats).to.be.an('object');
  })
  it('should load module using CommonJS function', function() {
    this.timeout(120000);
    const path = getModulePath('integers');
    const module = cjs.importModule(path);
    expect(module.int32).to.equal(1234);
  })
  it('should get gc statistics using CommonJS function', function() {
    const stats = cjs.getGCStatistics();
    expect(stats).to.be.an('object');
  })
});
