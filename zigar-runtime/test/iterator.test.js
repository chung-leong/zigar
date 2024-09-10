import { expect } from 'chai';

import {
  getArrayEntries,
  getArrayEntriesIterator,
  getArrayIterator,
  getZigIterator,
} from '../src/iterators.js';
import { MEMORY } from '../src/symbols.js';
import { defineProperties } from '../src/utils.js';

describe('Iterator functions', function() {
  describe('getZigIterator', function() {
    it('should return an iterator for a Zig iterator', function() {
      const object = {
        index: 0,
        next() {
          if (this.index < 4) {
            return this.index++;
          } else {
            return null;
          }
        },
        [Symbol.iterator]: getZigIterator
      };
      expect([ ...object ]).to.eql([ 0, 1, 2, 3 ]);
    })
  })
  describe('getArrayIterator', function() {
    it('should return an iterator', function() {
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
        }
      });
      const it = getArrayIterator.call(object);
      expect(it.next()).to.eql({ value: 1234, done: false });
      expect(it.next()).to.eql({ value: -2, done: false });
      expect(it.next()).to.eql({ value: -1, done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      object[Symbol.iterator] = getArrayIterator;
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, -2, -1]);
    })
  })
  describe('getArrayEntriesIterator', function() {
    it('should return an iterator', function() {
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
        }
      });
      const it = getArrayEntriesIterator.call(object);
      expect(it.next()).to.eql({ value: [ 0, 1234 ], done: false });
      expect(it.next()).to.eql({ value: [ 1, -2 ], done: false });
      expect(it.next()).to.eql({ value: [ 2, -1 ], done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      object.entries = function() {
        return { [Symbol.iterator]: getArrayEntriesIterator.bind(this) };
      };
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
  })
  describe('getArrayEntries', function() {
    it('should create an entries object from an array', function() {
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
        }
      });
      const entries = getArrayEntries.call(object);
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of entries) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
    it('should trap and return errors when specified', function() {
      const object = {
        get(index) {
          throw new Error(`Doh: ${index}`);
        },
        get length() {
          return 4;
        },
      };
      const entries = getArrayEntries.call(object, { error: 'return' });
      const indexList = [];
      for (const [ index, value ] of entries) {
        indexList.push(index);
        expect(value).to.be.an('error');
      }
      expect(indexList).to.eql([ 0, 1, 2, 3 ]);
    })
  })
})