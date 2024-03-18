import { expect } from 'chai';

import {
  load,
  resolve,
} from '../dist/index.js';

describe('Loader', function() {
  describe('resolve', function() {
    it('should call nextResolver', async function() {
      let called = false;
      const nextResolver = () => {
        called = true;
        return { shortCircuit: true, url: 'file:///somewhere/cow.css' };
      };
      const result = await resolve('./cow.css', {}, nextResolver);
      expect(called).to.be.true;
      expect(result).to.eql({ shortCircuit: true, url: 'file:///somewhere/cow.css' });
    })
  })
  describe('load', function() {
    it('should load Zig file', async function() {
      this.timeout(60000);
      const { href: url } = new URL('./zig-samples/function-simple.zig', import.meta.url);
      const { source, format, shortCircuit } = await load(url, {}, () => {});
      expect(format).to.equal('module');
      expect(shortCircuit).to.be.true;
      expect(source).to.contain('const source = ');
      expect(source).to.contain('runtimeSafety: true');
      const m = /export \{([\s\S]*)\}/.exec(source);
      expect(m[1]).to.contain('add');
    })
    it('should load Zig file with no functions', async function() {
      this.timeout(60000);
      const { href: url } = new URL('./zig-samples/struct.zig', import.meta.url);
      const { source } = await load(url, {}, () => {});
      expect(source).to.not.contain('const source = ');
    })
    it('should ignore URL without the extension zig', async function() {
      let called = false;
      const nextLoad = () => {
        called = true;
      };
      const { href: url } = new URL('./test.css', import.meta.url);
      const result = await load(url, {}, nextLoad);
      expect(result).to.be.undefined;
      expect(called).to.be.true;
    })
    it('should use query variables', async function() {
      this.timeout(300000);
      const { href: url } = new URL('./zig-samples/function-simple.zig?optimize=ReleaseSmall', import.meta.url);
      const { source } = await load(url, {}, () => {});
      expect(source).to.contain('runtimeSafety: false');
    })
    it('should use config file', async function() {
      this.timeout(300000);
      const { href: url } = new URL('./zig-samples/with-config/lib/simple.zigar', import.meta.url);
      const { source } = await load(url, {}, () => {});
      expect(source).to.contain('runtimeSafety: false');
    })
  })
  describe('import', function() {
    it('should load Zigar module', async function() {
      this.timeout(60000);
      const module = await import('./sample-modules/integers.zigar');
      expect(module.int16).to.equal(-44);
    })
  })
})