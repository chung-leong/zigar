import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Feature: dir-conversion', function() {
  describe('convertDirectory', function() {
    it('convert Map to directory', function() {
      const env = new Env();
      const map = new Map([
        [ 'hello.txt', {} ],
      ]);
      const dir = env.convertDirectory(map);
      const list = [];
      for (const entry of dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(1);
      expect(list[0]).to.eql({ name: 'hello.txt' });
    })
    it('convert Generator to directory', function() {
      const env = new Env();
      const generator = (function*() {
        yield { name: 'hello.txt', type: 'file' };
        yield { name: 'world', type: 'directory' };
      })();
      const dir = env.convertDirectory(generator);
      const list = [];
      for (const entry of dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(2);
      expect(list[0]).to.eql({ name: 'hello.txt', type: 'file' });
      expect(list[1]).to.eql({ name: 'world', type: 'directory' });
    })
  })
})