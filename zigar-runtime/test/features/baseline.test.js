import { expect } from 'chai';
import 'mocha-skip-if';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { capture, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: baseline', function() {
  describe('recreateStructures', function() {
    it('should recreate structures based on input definition', function() {
      const env = new Env();
      const s1 = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
        align: 4,
        instance: {
          members: [
            {
              type: MemberType.Int,
              flags: 0,
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
              flags: 0,
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
              flags: 0,
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
        type: StructureType.Function,
        flags: 0,
        name: 'fn () void',
        byteSize: 0,
        instance: {
          members: [
            {
              type: MemberType.Object,
              flags: 0,
              slot: 0,
              structure: s2,
            }
          ],
          template: {
            memory: (() => {
              const array = new Uint8Array(1);
              return { array };
            })(),
            reloc: usize(0x8888),
          },
        },
        static: {
          members: []
        },
      };
      const s5 = {
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
              flags: 0,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: s1,
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: 0,
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
              flags: 0,
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
                  reloc: usize(0x1000),
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
              flags: 0,
              name: 'pointer',
              slot: 0,
              structure: s3,
            },
            {
              type: MemberType.Object,
              flags: 0,
              name: 'unsupported',
              slot: 1,
              structure: {},
            },
            {
              type: MemberType.Object,
              flags: MemberFlag.IsReadOnly,
              name: 'hello',
              slot: 2,
              structure: s4,
            },
            {
              type: MemberType.Object,
              flags: MemberFlag.IsReadOnly,
              name: 'world',
              slot: 3,
              structure: s4,
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
                    reloc: usize(0x2000),
                    const: true,
                  },
                },
                structure: s3,
              },
              2: {
                memory: (() => {
                  const array = new Uint8Array(0);
                  return { array };
                })(),
                reloc: usize(0x2_8888),
                structure: s4,
              },
              3: undefined,
            },
          },
        },
      };
      //
      s5.static.template.slots[3] = s5.static.template.slots[2];
      env.recreateStructures([ s1, s2, s3, s4, s5 ]);
      const { constructor } = s5;
      expect(constructor).to.be.a('function');
      const object = new constructor({});
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(5678);
      expect(object.ghost).to.equal(-8888);
      let thunkAddress, fnAddress, argDV;
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1]
          argDV = new DataView(env.memory.buffer, args[2], s2.byteSize);
          return true;
        };
      } else {
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1]
          argDV = args[2];
          return true;
        };
        env.recreateAddress = function(address) {
          return 0n + address;
        };
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      env.linkVariables(false);
      expect(() => constructor.hello()).to.not.throw();
      expect(() => constructor.world()).to.not.throw();
      expect(thunkAddress).to.equal(usize(0x8888));
      expect(fnAddress).to.equal(usize(0x2_8888));
      expect(argDV.byteLength).to.equal(0);
      expect(env.variables).to.have.lengthOf(4);
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
      expect(() => typeOf(undefined)).to.throw(Error);
    })
  })
})