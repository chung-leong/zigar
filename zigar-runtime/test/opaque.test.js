import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Opaque functions', function() {
  const env = new NodeEnvironment();
  describe('defineOpaque', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should define an opaque structure', function() {
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello.call(ENVIRONMENT, dv);
      expect(String(object)).to.equal('[opaque Hello]');
      expect(Number(object)).to.be.NaN;
      expect(object.valueOf()).to.eql({});
      expect(JSON.stringify(object)).to.equal('{}');
      expect(() => object.$).to.throw(TypeError);
      expect(() => new Hello(undefined)).to.throw(TypeError);
    })
    it('should not allow the creation of opaque instances', function() {
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should define an iterator opaque', function() {
      const env = new NodeEnvironment();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 4,
        isIterator: true,
      });
      env.finalizeShape(structure);
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure,
        slot: 0,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const optStructure = env.beginStructure({
        type: StructureType.Optional,
        name: '?i32',
        byteSize: 5,
      });
      env.attachMember(optStructure, {
        name: 'value',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(optStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitSize: 8,
        bitOffset: 32,
        byteSize: 1,
        structure: {},
      });
      env.finalizeShape(optStructure);
      env.finalizeStructure(optStructure);
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 13,
        hasPointer: true,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 5,
        structure: optStructure,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: optStructure.byteSize * 8,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.finalizeShape(argStruct);
      env.finalizeStructure(argStruct);
      env.attachMethod(structure, {
        name: 'next',
        argStruct,
        isStaticOnly: false,
        thunkId: 1234,
      });
      env.finalizeStructure(structure);
      let i = 0;
      env.runThunk = function(thunkId, argDV) {
        if (i++ < 5) {
          argDV.setInt32(0, i, true);
          argDV.setInt8(4, 1);
        } else {
          argDV.setInt32(0, 0, true);
          argDV.setInt8(4, 0);
        }
      };
      env.getBufferAddress = function(buffer) {
        return 0x1000n;
      }
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(4));
      const object = Hello(dv);
      const results = [];
      for (const value of object) {
        results.push(value);
      }
      expect(results).to.eql([ 1, 2, 3, 4, 5 ]);
    })
  })
})