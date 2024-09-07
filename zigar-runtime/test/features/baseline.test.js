import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { StructureType } from '../../src/constants.js';
import Baseline from '../../src/features/baseline.js';

const Env = defineClass('FeatureTest', [ Baseline ]);

describe('Feature: baseline', function() {
  describe('recreateStructures', function() {
    it('should recreate structures based on input definition', function() {
      const env = new Environment();
      const s1 = {
        type: StructureType.Primitive,
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
            }
          ],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s2 = {
        type: StructureType.ArgStruct,
        name: 'hello',
        byteSize: 0,
        align: 0,
        hasPointer: false,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
            }
          ],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s3 = {
        type: StructureType.SinglePointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s4 = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        hasPointer: false,
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
              type: MemberType.Comptime,
              slot: 2,
              structure: s1,
            },
            {
              name: 'type',
              type: MemberType.Type,
              slot: 3,
            }
          ],
          methods: [],
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
              type: MemberType.Static,
              name: 'pointer',
              slot: 0,
              structure: s3,
            },
            {
              type: MemberType.Static,
              name: 'unsupported',
              slot: 1,
              structure: {},
            },
          ],
          methods: [
            {
              name: 'hello',
              thunkId: 34,
              argStruct: s2,
            }
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
      expect(() => constructor.hello()).to.not.throw();
      expect(thunkId).to.equal(34);
      expect(argStruct[MEMORY].byteLength).to.equal(0);
      expect(env.variables).to.have.lengthOf(2);
    })
  })
  describe('getSpecialExports', function() {
    it('should return object for controlling module', async function() {
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
      env.imports = {
        runThunk: function() {},
      };
      const { sizeOf, alignOf, typeOf } = env.getSpecialExports();
      expect(sizeOf).to.be.a('function');
      expect(alignOf).to.be.a('function');
      expect(typeOf).to.be.a('function');
      const structure = env.beginStructure({
        type: StructureType.PackedStruct,
        name: 'Packed',
        byteSize: 4,
        align: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'nice',
        bitSize: 1,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'rich',
        bitSize: 1,
        bitOffset: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'young',
        bitSize: 1,
        bitOffset: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Packed } = structure;
      expect(sizeOf(Packed)).to.equal(4);
      expect(alignOf(Packed)).to.equal(2);
      expect(typeOf(Packed)).to.equal('packed struct');
    })
  })

})