import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, RESTORE } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: struct-like', function() {
  describe('defineVivificatorStruct', function() {
    it('should return descriptor for vivificating struct properties', function() {
      const env = new Env();
      const structure = {
        instance: {
          members: [],
        }
      };
      const descriptor = env.defineVivificatorStruct(structure);
      expect(descriptor.value).to.be.a('function');
    })
    it('should return a function that throws when child object is on not on a byte boundary', function() {
      const env = new Env();
      const structure = {
        instance: {
          members: [
            {
              name: 'flags',
              type: MemberType.Object,
              bitOffset: 4,
              bitSize: 8,
              structure: {
                type: StructureType.Struct,
                flags: StructureFlag.IsPacked,
                byteSize: 8,
              },
              slot: 0,
            }
          ],
        }
      };
      const descriptor = env.defineVivificatorStruct(structure);
      expect(descriptor.value).to.be.a('function');
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(2)),
        [RESTORE]() { return this[MEMORY] },
      };
      expect(() => descriptor.value.call(object, 0)).to.throw(TypeError)
        .with.property('message').that.includes('boundary');
    })
  })
})
