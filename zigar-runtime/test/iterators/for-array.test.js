import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { MEMORY } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Iterator: for-array', function() {
  describe('defineArrayIterator', function() {
    it('should return an iterator', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = defineProperties({ [MEMORY]: dv }, {
        get: {
          value(index) {
            return this[MEMORY].getInt32(index * 4, true);
          }
        },
        length: {
          get() {
            return this[MEMORY].byteLength / 4;
          }
        },
        [Symbol.iterator]: env.defineArrayIterator(),
      });
      const it = object[Symbol.iterator]();
      expect(it.next()).to.eql({ value: 1234, done: false });
      expect(it.next()).to.eql({ value: -2, done: false });
      expect(it.next()).to.eql({ value: -1, done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, -2, -1]);
    })
  })
  describe('defineArrayEntries', function() {
    it('should return an iterator', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = defineProperties({ [MEMORY]: dv }, {
        get: {
          value(index) {
            return this[MEMORY].getInt32(index * 4, true);
          }
        },
        length: {
          get() {
            return this[MEMORY].byteLength / 4;
          }
        },
        entries: env.defineArrayEntries(),
      });
      const it = object.entries()[Symbol.iterator]();
      expect(it.next()).to.eql({ value: [ 0, 1234 ], done: false });
      expect(it.next()).to.eql({ value: [ 1, -2 ], done: false });
      expect(it.next()).to.eql({ value: [ 2, -1 ], done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
    it('should create an entries object from an array', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = defineProperties({ [MEMORY]: dv }, {
        get: {
          value(index) {
            return this[MEMORY].getInt32(index * 4, true);
          }
        },
        length: {
          get() {
            return this[MEMORY].byteLength / 4;
          }
        },
        entries: env.defineArrayEntries(),
      });
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
    it('should trap and return errors when specified', function() {
      const env = new Env();
      const object = defineProperties({}, {
        get: {
          value(index) {
            throw new Error(`Doh: ${index}`);
          }
        },
        length: {
          get() {
            return 4;
          }
        },
        entries: env.defineArrayEntries(),
      });
      const indexList = [];
      for (const [ index, value ] of object.entries({ error: 'return' })) {
        indexList.push(index);
        expect(value).to.be.an('error');
      }
      expect(indexList).to.eql([ 0, 1, 2, 3 ]);
    })
  })
})