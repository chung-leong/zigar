import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Feature: dir-conversion', function() {
  describe('convertDirectory', function() {
    it('should convert Map to directory', function() {
      const env = new Env();
      const map = new Map([
        [ 'hello.txt', { type: 'file' } ],
      ]);
      const dir = env.convertDirectory(map);
      const list = [];
      for (const entry of dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(1);
      expect(list[0]).to.eql({ name: 'hello.txt', type: 'file' });
      let called = false;
      dir.onClose = () => called = true;
      map.close();
      expect(called).to.be.true;
    })
    it('should return same object if it has a readdir method', function() {
      const env = new Env();
      const object = {
        *readdir() {
          for (let i = 0; i < 5; i++) {
            yield { name: `file${i}.txt`, type: 'file' };
          }
        },
      };
      const dir = env.convertDirectory(object);
      const list = [];
      for (const entry of dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(5);
      expect(list[0]).to.eql({ name: 'file0.txt', type: 'file' });
    })
    it('should throw error when conversion is not possible', function() {
      const env = new Env();
      expect(() => env.convertDirectory(1234)).to.throw(TypeError)
        .with.property('message').that.contains('map or object');
    })
  })
})