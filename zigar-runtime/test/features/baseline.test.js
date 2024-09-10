import { expect } from 'chai';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { capture } from '../test-utils.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBoolUnalign from '../../src/accessors/bool1-unaligned.js';
import Baseline, {
  isNeeded,
} from '../../src/features/baseline.js';
import DataCopying from '../../src/features/data-copying.js';
import intConversion from '../../src/features/int-conversion.js';
import ModuleLoading from '../../src/features/module-loading.js';
import StreamRedirection from '../../src/features/stream-redirection.js';
import StructureAcqusiton from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import PointerInStruct from '../../src/members/pointer-in-struct.js';
import MemberPrimitive from '../../src/members/primitive.js';
import MemberTypeMixin from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import MemberVoid from '../../src/members/void.js';
import StructureAll from '../../src/structures/all.js';
import ArgStruct from '../../src/structures/arg-struct.js';
import Pointer from '../../src/structures/pointer.js';
import StructurePrimitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';

const Env = defineClass('FeatureTest', [
  Baseline, StructureAll, MemberAll, MemberPrimitive, StructurePrimitive, DataCopying, MemberInt,
  intConversion, AccessorAll, ArgStruct, MemberVoid, Pointer, PointerInStruct, MemberUint,
  ViewManagement, Struct, StructLike, MemberObject, MemberTypeMixin, ModuleLoading,
  StructureAcqusiton, MemberBool, AccessorBoolUnalign, StreamRedirection,
]);

describe('Feature: baseline', function() {
  describe('isNeeded', function() {
    it('should return true', function() {
      expect(isNeeded()).to.be.true;
    })
  })
  describe('recreateStructures', function() {
    it('should recreate structures based on input definition', function() {
      const env = new Env();
      const s1 = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
        align: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: {},
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
      };
      const s2 = {
        type: StructureType.ArgStruct,
        name: 'hello',
        byteSize: 0,
        align: 0,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
              structure: {},
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
      };
      const s3 = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: {},
            },
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
      };
      const s4 = {
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: s1,
            },
            {
              name: 'cat',
              type: MemberType.Int,
              bitOffset: 32,
              bitSize: 32,
              byteSize: 4,
              structure: s1,
            },
            {
              name: 'ghost',
              type: MemberType.Object,
              flags: MemberFlag.IsReadOnly,
              slot: 2,
              structure: s1,
            },
            {
              name: 'type',
              type: MemberType.Type,
              slot: 3,
              structure: {},
            }
          ],
          template: {
            memory: (() => {
              const array = new Uint8Array(8);
              const dv = new DataView(array.buffer);
              dv.setInt32(0, 1234, true);
              dv.setInt32(4, 5678, true);
              return { array };
            })(),
            slots: (() => {
              const array = new Uint8Array(4);
              const dv = new DataView(array.buffer);
              dv.setInt32(0, -8888, true);
              return {
                2: {
                  memory: { array },
                  structure: s1,
                  reloc: 0x1000n,
                },
                3: {
                  structure: s1,
                }
              };
            })(),
          },
        },
        static: {
          members: [
            {
              type: MemberType.Object,
              name: 'pointer',
              slot: 0,
              structure: s3,
            },
            {
              type: MemberType.Object,
              name: 'unsupported',
              slot: 1,
              structure: {},
            },
          ],
          template: {
            slots: {
              0: {
                memory: (() => {
                  const array = new Uint8Array(8);
                  return { array };
                })(),
                slots: {
                  0: {
                    memory: (() => {
                      const array = new Uint8Array(4);
                      const dv = new DataView(array.buffer);
                      dv.setInt32(0, 707, true);
                      return { array };
                    })(),
                    structure: s1,
                    reloc: 0x2000n,
                    const: true,
                  },
                },
                structure: s3,
              }
            }
          },
        },
      };
      env.recreateStructures([ s1, s2, s3, s4 ]);
      const { constructor } = s4;
      expect(constructor).to.be.a('function');
      const object = new constructor({});
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(5678);
      expect(object.ghost).to.equal(-8888);
      let thunkId, argStruct;
      env.invokeThunk = function(...args) {
        thunkId = args[0];
        argStruct = args[1];
      };
      throw new Error('FIXME');
      expect(() => constructor.hello()).to.not.throw();
      expect(thunkId).to.equal(34);
      expect(argStruct[MEMORY].byteLength).to.equal(0);
      expect(env.variables).to.have.lengthOf(2);
    })
  })
  describe('getSpecialExports', function() {
    it('should return object for controlling module', async function() {
      const env = new Env();
      env.init = async () => {};
      env.imports = {
        runThunk: function() {},
      };
      const object = env.getSpecialExports();
      expect(object.init).to.be.a('function');
      expect(object.abandon).to.be.a('function');
      expect(object.released).to.be.a('function');
      expect(object.connect).to.be.a('function');
      await object.init();
      expect(env.abandoned).to.be.false;
      object.abandon();
      expect(env.abandoned).to.be.true;
      expect(object.released()).to.be.false;
    })
    it('should allow redirection of console output', async function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(2));
      dv.setUint8(0, '?'.charCodeAt(0));
      dv.setUint8(1, '\n'.charCodeAt(0));
      const [ before ] = await capture(() => env.writeToConsole(dv));
      expect(before).to.equal('?');
      const object = env.getSpecialExports();
      let content;
      object.connect({
        log(s) {
          content = s;
        }
      });
      const [ after ] = await capture(() => env.writeToConsole(dv));
      expect(after).to.be.undefined;
      expect(content).to.equal('?');
    })
    it('should provide functions for obtaining type info', async function() {
      const env = new Env();
      env.imports = {
        runThunk: function() {},
      };
      const { sizeOf, alignOf, typeOf } = env.getSpecialExports();
      expect(sizeOf).to.be.a('function');
      expect(alignOf).to.be.a('function');
      expect(typeOf).to.be.a('function');
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.IsPacked,
        name: 'Packed',
        byteSize: 4,
        align: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'nice',
        bitSize: 1,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'rich',
        bitSize: 1,
        bitOffset: 1,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'young',
        bitSize: 1,
        bitOffset: 2,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Packed = env.defineStructure(structure);
      env.finalizeStructure(structure);
      expect(sizeOf(Packed)).to.equal(4);
      expect(alignOf(Packed)).to.equal(2);
      expect(typeOf(Packed)).to.equal('struct');
    })
  })
})