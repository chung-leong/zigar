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
  })
})