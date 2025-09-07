import { expect } from 'chai';
import { MemberType, PointerFlag, StructFlag, StructureFlag, StructureType, VisitorFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { ArgumentCountMismatch, InvalidVariadicArgument, UndefinedArgument } from '../../src/errors.js';
import '../../src/mixins.js';
import { MEMORY, RETURN, VISIT } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: variadic-struct', function() {
  describe('defineVariadicStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.VariadicStruct,
        byteSize: 8,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: "retval",
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: "0",
              type: MemberType.Bool,
              bitSize: 1,
              bitOffset: 32,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineVariadicStruct(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.VariadicStruct,
        byteSize: 8,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: "retval",
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: "0",
              type: MemberType.Bool,
              bitSize: 1,
              bitOffset: 32,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.defineVariadicStruct(structure, descriptors);
      expect(descriptors.retval?.get).to.be.a('function');
      expect(descriptors.retval?.set).to.be.a('function');
      expect(descriptors[0]?.get).to.be.a('function');
      expect(descriptors[0]?.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an variadic argument struct', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const Int32 = intStructure.constructor;
      const floatStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'f64',
        byteSize: 8,
        align: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(floatStructure);
      env.finishStructure(floatStructure);
      const Float64 = floatStructure.constructor;
      const structStructure = {
        type: StructureType.Struct,
        flags: StructFlag.IsExtern,
        name: 'Struct',
        byteSize: 8,
        align: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'number',
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: floatStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const Struct = structStructure.constructor;
      const structure = {
        type: StructureType.VariadicStruct,
        byteSize: 4 * 3,
        align: 4,
        length: 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
            {
              name: '0',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: intStructure,
            },
            {
              name: '1',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 64,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const VariadicStruct = structure.constructor;
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 123, 456 ], 'hello', 0);
      args1.retval = 777;
      expect(args1[0]).to.equal(123);
      expect(args1[1]).to.equal(456);
      expect(args1.retval).to.equal(777);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const args2 = new VariadicStruct([ 123, 456, new Int32(1), new Int32(2) ], 'hello', 0);
      expect(args2[MEMORY].byteLength).to.equal(20);
      const args3 = new VariadicStruct([ 123, 456, new Int32(1), new Float64(2) ], 'hello', 0);
      expect(args3[MEMORY].byteLength).to.equal(24);
      const args4 = new VariadicStruct([ 123, 456, new Int32(1), new Struct({ number: 123 }) ], 'hello', 0);
      expect(args4[MEMORY].byteLength).to.equal(24);
      expect(() => new VariadicStruct([ 123 ], 'hello', 0)).to.throw(ArgumentCountMismatch);
      expect(() => new VariadicStruct([ undefined, 2 ], 'hello', 0)).to.throw(UndefinedArgument);
      expect(() => new VariadicStruct([ 123, 0xFFFF_FFFF_FFFFn ], 'hello', 0)).to.throw(TypeError);
      expect(() => new VariadicStruct([ 123, 456, 1, 2 ], 'hello', 0)).to.throw(InvalidVariadicArgument)
        .with.property('message').that.contains('args[2]');
    })
    it('should define an variadic argument struct containing a pointer argument', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 4,
        align: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.VariadicStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 4 + 4 + 4,
        align: 4,
        length: 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
              slot: 0,
            },
            {
              name: '0',
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: ptrStructure,
              slot: 1,
            },
            {
              name: '1',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 64,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const VariadicStruct = structure.constructor;
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 88, -123 ], 'hello', 0);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const pointers = [], active = [], mutable = [];
      args1[VISIT](function(flags) {
        pointers.push(this);
        active.push(!(flags & VisitorFlag.IsInactive));
        mutable.push(!(flags & VisitorFlag.IsImmutable));
      });
      expect(pointers).to.have.lengthOf(1);
      expect(pointers[0]['*']).to.equal(88);
      expect(active).to.eql([ true ]);
      expect(mutable).to.eql([ false ]);
    })
    it('should define an variadic argument struct containing a pointer argument and pointer retval', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 4,
        align: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.VariadicStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 4 + 4 + 4,
        align: 4,
        length: 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: ptrStructure,
              slot: 0,
            },
            {
              name: '0',
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: ptrStructure,
              slot: 1,
            },
            {
              name: '1',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 64,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const VariadicStruct = structure.constructor;
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 88, -123 ], 'hello', 0);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const pointers = [], active = [], mutable = [];
      args1[VISIT](function(flags) {
        pointers.push(this);
        active.push(!(flags & VisitorFlag.IsInactive));
        mutable.push(!(flags & VisitorFlag.IsImmutable));
      });
      expect(pointers).to.have.lengthOf(2);
      expect(pointers[0]['*']).to.equal(88);
      expect(active).to.eql([ true, true ]);
      expect(mutable).to.eql([ false, true ]);
    })
  })
  it('should set retval when RETURN is called', function() {
    const env = new Env();
    env.runtimeSafety = true;
    const intStructure = {
      type: StructureType.Primitive,
      flags: StructureFlag.HasValue,
      byteSize: 4,
      align: 4,
      signature: 0n,
      instance: {
        members: [
          {
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
            structure: {},
          },
        ],
      },
      static: {},
    };
    env.beginStructure(intStructure);
    env.finishStructure(intStructure);
    const floatStructure = {
      type: StructureType.Primitive,
      flags: StructureFlag.HasValue,
      name: 'f64',
      byteSize: 8,
      align: 8,
      signature: 0n,
      instance: {
        members: [
          {
            type: MemberType.Float,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
            structure: {},
          },
        ],
      },
      static: {},
    };
    env.beginStructure(floatStructure);
    env.finishStructure(floatStructure);
    const structStructure = {
      type: StructureType.Struct,
      flags: StructFlag.IsExtern,
      name: 'Struct',
      byteSize: 8,
      align: 8,
      signature: 0n,
      instance: {
        members: [
          {
            name: 'number',
            type: MemberType.Float,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
            structure: floatStructure,
          },
        ],
      },
      static: {},
    };
    env.beginStructure(structStructure);
    env.finishStructure(structStructure);
    const structure = {
      type: StructureType.VariadicStruct,
      byteSize: 4 * 3,
      align: 4,
      length: 2,
      signature: 0n,
      instance: {
        members: [
          {
            name: 'retval',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
            structure: intStructure,
          },
          {
            name: '0',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
            structure: intStructure,
          },
          {
            name: '1',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 64,
            byteSize: 4,
            structure: intStructure,
          },
        ],
      },
      static: {},
    };
    env.beginStructure(structure);
    env.finishStructure(structure);
    const VariadicStruct = structure.constructor;
    expect(VariadicStruct).to.be.a('function');
    const args1 = new VariadicStruct([ 123, 456 ], 'hello', 0);
    args1[RETURN](777);
    expect(args1.retval).to.equal(777);
  })
})
