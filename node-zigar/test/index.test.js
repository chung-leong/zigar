import { expect } from 'chai';

import {
  resolve,
  load,
} from '../dist/index.js';

describe('Loader', function() {
  describe('resolve', function() {
    it('should resolve to expect URL when the extension is zig', function() {
      const result = resolve('./cow.zig', { parentURL: 'file:///somewhere/test.js' }, () => {});
      expect(result).to.eql({ shortCircuit: true, url: 'file:///somewhere/cow.zig' });
    })
    it('should give the right result when specifier has a querystring', function() {
      const result = resolve('./cow.zig?hello=1', { parentURL: 'file:///somewhere/test.js' }, () => {});
      expect(result).to.eql({ shortCircuit: true, url: 'file:///somewhere/cow.zig?hello=1' });
    })
    it('should resolve to expect URL when the parentURL is missing', function() {
      const result = resolve('./cow.zig', {}, () => {});
      const { href } = new URL('../cow.zig', import.meta.url);
      expect(result.url).to.equal(href);
    })
    it('should call nextResolver function when the extension is not Zig', function() {
      let called = false;
      const nextResolver = () => {
        called = true;
        return { shortCircuit: true, url: 'file:///somewhere' };
      };
      const result = resolve('./cow.css', {}, nextResolver);
      expect(called).to.be.true;
      expect(result).to.eql({ shortCircuit: true, url: 'file:///somewhere' });
    })
  })
  describe('load', function() {
    beforeEach(function() {
      delete process.env.ZIGAR_OPTIMIZE;
      delete process.env.ZIGAR_CLEAN;
      delete process.env.NODE_ENV;
    })
    it('should load Zig file', async function() {
      this.timeout(60000);
      const { href: url } = new URL('./zig-samples/simple.zig', import.meta.url);
      const result = await load(url, {}, () => {});
      const { source, format, shortCircuit } = result;
      expect(format).to.equal('module');
      expect(shortCircuit).to.be.true;
      const m = /export \{([\s\S]*)\}/.exec(source);
      expect(m[1]).to.contain('hello');
      expect(m[1]).to.contain('constant');
    })
    it('should ignore URL without the extension zig', async function() {
      let called = false;
      const nextLoad = () => called = true;
      const { href: url } = new URL('./test.css', import.meta.url);
      const result = await load(url, {}, nextLoad);
      expect(called).to.be.true;
    })
    it('should compile for ReleaseFast when NODE_ENV is production', async function() {
      // for coverage purpose
      this.timeout(60000);
      process.env.NODE_ENV = 'production';
      const { href: url } = new URL('./zig-samples/simple.zig', import.meta.url);
      const result = await load(url, {}, () => {});
    })
    it('should use environment variables', async function() {
      // for coverage purpose
      this.timeout(60000);
      process.env.ZIGAR_OPTIMIZE = 'ReleaseSmall';
      process.env.ZIGAR_CLEAN = '0';
      process.env.NODE_ENV = 'development';
      const { href: url } = new URL('./zig-samples/simple.zig', import.meta.url);
      const result = await load(url, {}, () => {});
    })
  })
})