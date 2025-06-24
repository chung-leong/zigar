import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { FALLBACK } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Member: dataView', function() {
  describe('defineDataView', function() {
    it('should return descriptor for dataView prop', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const dataView = env.defineDataView(structure);
      expect(dataView.get).to.be.a('function');
      expect(dataView.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach dataView prop to structure', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const Array = env.defineStructure(structure);
      env.finalizeStructure(structure);
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(array.dataView.byteLength).to.equal(11);
    })
    it('should throw when dataView prop is given incorrect data', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const Array = env.defineStructure(structure);
      env.finalizeStructure(structure);
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(() => array.dataView = new DataView(new ArrayBuffer(0))).to.throw(TypeError);
      expect(() => array.dataView = new ArrayBuffer(0)).to.throw(TypeError);
    })
    if (process.env.TARGET === 'node') {
      it('should synchronize with external memory when fallback is used', function() {
        const env = new Env();
        const intStructure = env.beginStructure({
          type: StructureType.Primitive,
            byteSize: 1,
        });
        env.attachMember(intStructure, {
          type: MemberType.Uint,
          bitSize: 8,
          bitOffset: 0,
          byteSize: 1,
          structure: intStructure,
        });
        env.defineStructure(intStructure);
        env.finalizeStructure(intStructure);
        const structure = env.beginStructure({
          type: StructureType.Array,
          flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
          name: '[11]u8',
          length: 11,
          byteSize: 11,
        });
        env.attachMember(structure, {
          type: MemberType.Uint,
          bitSize: 8,
          byteSize: 1,
          structure: intStructure
        });
        const Array = env.defineStructure(structure);
        env.finalizeStructure(structure);
        const buffer = new ArrayBuffer(11);
        const dv = env.obtainView(buffer, 0, 11);
        const array = Array(dv);
        array.string = 'Hello world';
        env.requireBufferFallback = () => true;
        buffer[FALLBACK] = usize(0x1234);
        let count = 0;
        env.syncExternalBuffer = (buffer, address) => {
          expect(buffer).to.be.an('ArrayBuffer');
          expect(address).to.equal(usize(0x1234));
          count++;
        };
        expect(array.string).to.equal('Hello world');
        expect(array.dataView).to.be.a('DataView');
        expect(array.typedArray).to.be.a('Uint8Array');
        expect(array.base64).to.be.a('string');
        expect(count).to.equal(4);
      })
    }
  })
})
