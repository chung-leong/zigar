import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

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
      let entry;
      while (entry = dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(3);
      expect(list).to.eql([ 
        { name: '.', type: 'directory' }, 
        { name: '..', type: 'directory' },
        { name: 'hello.txt', type: 'file' },
      ]);
      let called = false;
      dir.onClose = () => called = true;
      map.close();
      expect(called).to.be.true;
    })
    it('should return same object if it has a readdir method', function() {
      const env = new Env();
      const object = {
        pos: 0,

        readdir() {
          const index = this.pos++;
          if (index < 5) {
            return { name: `file${index}.txt`, type: 'file' };
          }
        },
      };
      const dir = env.convertDirectory(object);
      const list = [];
      let entry;
      while (entry = dir.readdir()) {
        list.push(entry);
      }
      expect(list).to.have.lengthOf(5);
      expect(list[0]).to.eql({ name: 'file0.txt', type: 'file' });
    })
    it('should return undefined when conversion is not possible', function() {
      const env = new Env();
      const dir = env.convertDirectory(1234);
      expect(dir).to.be.undefined;
    })
  })
})