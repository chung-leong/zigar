import { expect } from 'chai';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { MEMORY } from '../../src/symbols.js';

import AccessorAll from '../../src/accessors/all.js';
import Baseline from '../../src/features/baseline.js';
import IntConversion from '../../src/features/int-conversion.js';
import MemberAll from '../../src/members/all.js';
import MemberPrimitive from '../../src/members/primitive.js';
import Sentinel, {
  isNeededByStructure,
} from '../../src/members/sentinel.js';
import MemberUint from '../../src/members/uint.js';

const Env = defineClass('MemberTest', [
  Baseline, AccessorAll, MemberUint, MemberPrimitive, MemberAll, Sentinel, IntConversion
]);

describe('Member: sentinel', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Slice,
        flags: StructureFlag.HasSentinel,
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const structure = {
        type: StructureType.Slice,
      };
      const env = new Env();
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineSentinel', function() {
    it('should return sentinel descriptor', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(1));
      dv.setUint8(0, 0xff);
      const structure = {
        type: StructureType.Slice,
        flags: StructureType.HasSentinel,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsRequired,
              bitSize: 8,
              byteSize: 8,
              bitOffset: 0,
              structure: {},
            }
          ],
          template: {
            [MEMORY]: dv,
          },
        },
      };
      const { value: sentinel } = env.defineSentinel(structure);
      expect(sentinel).to.be.an('object');
      expect(sentinel.validateValue).to.be.a('function');
      expect(sentinel.validateData).to.be.a('function');
      expect(sentinel.value).to.equal(0xff);
      expect(sentinel.bytes).to.equal(dv);
      expect(sentinel.isRequired).to.be.true;
    })
  })
  describe('findSentinel', function() {
    if (process.env.TARGET === 'wasm') {
      it('should find length of zero-terminated string at address', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const text = 'Hello';
        const src = new DataView(memory.buffer, 128, 16);
        for (let i = 0; i < text.length; i++) {
          src.setUint8(i, text.charCodeAt(i));
        }
        const byte = new DataView(new ArrayBuffer(1));
        const len = env.findSentinel(128, byte);
        expect(len).to.equal(5);
      })
      it('should return undefined upon hitting end of memory', function() {
        const env = new Env();
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const text = 'Hello';
        const byte = new DataView(new ArrayBuffer(1));
        byte.setUint8(0, 0xFF);
        const len = env.findSentinel(128, byte);
        expect(len).to.be.undefined;
      })
    }
  })
})

