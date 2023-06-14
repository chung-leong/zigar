import { expect } from 'chai';

import { MemberType } from '../src/type.js';
import { DATA } from '../src/symbol.js';
import { obtainTypedArrayGetter } from '../src/typed-array.js';

describe('Typed array functions', function() { 
  describe('obtainTypedArrayGetter', function() {
    it('should return a function that yield a typed array when all members are of the same type', function() {
      const members = [
        {
          name: 'dog',
          type: MemberType.Int,
          signed: true,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          signed: true,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
        }
      ];
      const f = obtainTypedArrayGetter(members);
      expect(f).to.be.a('function');
      const object = {
        [DATA]: new DataView(new ArrayBuffer(8)),
      };
      const array = f.call(object);
      expect(array).to.be.an.instanceOf(Int32Array);
    })
    it('should return nothing when members are different', function() {
      const members = [
        {
          name: 'dog',
          type: MemberType.Int,
          signed: true,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          signed: false,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
        }
      ];
      const f = obtainTypedArrayGetter(members);
      expect(f).to.be.undefined;
    })
  })
})
