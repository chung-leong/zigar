import { expect } from 'chai';

import {
  getFormat,
  getSource,
  resolve,
} from '../dist/index-n14.js';

describe('Node 14.x loader', function() {
  describe('resolve', function() {
    it('should call defaultResolver', async function() {
      let called = false;
      const defaultResolver = () => {
        called = true;
        return { shortCircuit: true, url: 'file:///somewhere/cow.css' };
      };
      const result = await resolve('./cow.css', {}, defaultResolver);
      expect(called).to.be.true;
      expect(result).to.eql({ shortCircuit: true, url: 'file:///somewhere/cow.css' });
    })
  })
  describe('getFormat', function() {
    it('should get module as format', async function() {
      this.timeout(60000);
      const { href: url } = new URL('./zig-samples/function-simple.zig', import.meta.url);
      const { format } = await getFormat(url, {}, () => {});
      expect(format).to.equal('module');
    })
    it('should call defaultGetFormat', async function() {
      let called = false;
      const defaultGetFormat = () => {
        called = true;
        return { format: 'css' };
      };
      const result = await getFormat('./cow.css', {}, defaultGetFormat);
      expect(called).to.be.true;
      expect(result).to.eql({ format: 'css' });
    })
  })
  describe('getSource', function() {
    it('should load Zig file', async function() {
      this.timeout(60000);
      const { href: url } = new URL('./zig-samples/function-simple.zig', import.meta.url);
      const { source } = await getSource(url, {}, () => {});
      expect(source).to.contain('const source = ');
      expect(source).to.contain('runtimeSafety: true');
    })
    it('should ignore URL without the extension zig', async function() {
      let called = false;
      const defaultGetSource = () => {
        called = true;
      };
      const { href: url } = new URL('./test.css', import.meta.url);
      const result = await getSource(url, {}, defaultGetSource);
      expect(result).to.be.undefined;
      expect(called).to.be.true;
    })
  })
})