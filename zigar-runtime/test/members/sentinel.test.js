import { expect } from 'chai';
import { MemberFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: sentinel', function() {
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

