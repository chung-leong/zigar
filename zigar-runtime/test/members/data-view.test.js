import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FALLBACK, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Member: dataView', function() {
  describe('defineDataView', function() {
    it('should return descriptor for dataView prop', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const dataView = env.defineDataView(structure);
      expect(dataView.get).to.be.a('function');
      expect(dataView.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach dataView prop to structure', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(array.dataView.byteLength).to.equal(11);
    })
    it('should throw when dataView prop is given incorrect data', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      intStructure.constructor;
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(() => array.dataView = new DataView(new ArrayBuffer(0))).to.throw(TypeError);
      expect(() => array.dataView = new ArrayBuffer(0)).to.throw(TypeError);
    })
    if (process.env.TARGET === 'node') {
      it('should synchronize with external memory when fallback is used', function() {
        const env = new Env();
        const intStructure = {
          type: StructureType.Primitive,
          byteSize: 1,
          signature: 0n,
          instance: {
            members: [
              {
                type: MemberType.Uint,
                bitSize: 8,
                bitOffset: 0,
                byteSize: 1,
                structure: {},
              },
            ],
          },
          static: {},
        };
        env.beginStructure(intStructure);
        intStructure.constructor;
        env.finalizeStructure(intStructure);
        const structure = {
          type: StructureType.Array,
          flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray,
          name: '[11]u8',
          length: 11,
          byteSize: 11,
          signature: 0n,
          instance: {
            members: [
              {
                type: MemberType.Uint,
                bitSize: 8,
                byteSize: 1,
                structure: intStructure
              },
            ],
          },
          static: {},
        };
        env.beginStructure(structure);
        env.finalizeStructure(structure);
        const Array = structure.constructor;
        const address = usize(0x1234);
        const len = 11;
        const buffer = new ArrayBuffer(len);
        buffer[FALLBACK] = address;
        buffer[ZIG] = { address, len };
        const dv = env.obtainView(buffer, 0, 11);
        expect(dv[FALLBACK]).to.be.a('function');
        const array = Array(dv);
        let called = 0;
        env.moveExternBytes = (argDV, argAddress, to) => {
          expect(to).to.be.true;
          expect(argAddress).to.equal(address);
          expect(argDV).to.equal(dv);
          called++;
        }
        array.string = 'Hello world';
        expect(called).to.equal(1);
        env.moveExternBytes = (argDV, argAddress, to) => {
          expect(to).to.be.false;
          called++;
        }
        expect(array.string).to.equal('Hello world');
        expect(called).to.equal(2);
        expect(array.dataView).to.be.a('DataView');
        expect(called).to.equal(3);
        expect(array.typedArray).to.be.a('Uint8Array');
        expect(called).to.equal(4);
        expect(array.base64).to.be.a('string');
        expect(called).to.equal(5);
      })
    }
  })
})
