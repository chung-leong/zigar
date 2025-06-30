import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Feature: dir', function() {
  describe('createDirectory', function() {
    it('should create a dir struct from a Map', async function() {
      const env = new Env();
      const map = new Map([
        [ 'hello.txt', { type: 'file' } ],
      ]);
      const dir = env.createDirectory(map);
      expect(dir.fd).to.be.a('number');
    })
    it('should return the same object if it has a fd property', async function() {
      const env = new Env();
      const object = { fd: 1234 };
      const dir = env.createDirectory(object);
      expect(dir).to.equal(object);
    })
  })
})
