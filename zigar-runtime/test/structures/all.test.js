import { expect } from 'chai';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, ENVIRONMENT, FIXED, MEMORY, SIZE, SLOTS, TYPED_ARRAY } from '../../src/symbols.js';
import { defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: all', function() {
  describe('defineStructure', function() {
    it('should define a structure for holding an integer', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFF_FFFF_FFFF_FFFFn, true);
      const object = Hello(dv);
      expect(object.$).to.equal(0x7FFF_FFFF_FFFF_FFFFn);
      expect(BigInt(object)).to.equal(0x7FFF_FFFF_FFFF_FFFFn);
      expect(String(object)).to.equal(`${0x7FFF_FFFF_FFFF_FFFFn}`);
    })
    it('should add special methods to structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      // the special methods relies on the property [TYPE] on the constructor, which is added by
      // finalizeStructure();
      env.finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 12345n, true);
      const object = Hello(dv);
      expect(object.$).to.equal(12345n);
      expect(object.valueOf()).to.equal(12345n);
      expect(JSON.stringify(object)).to.equal(`${12345n}`);
    })
  })
  describe('createConstructor', function() {
    it('should create a constructor for the structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      const object = new Hello(77n);
      expect(object.$).to.equal(77n);
      object.$ = 1234n,
      expect(object.$).to.equal(1234n);
    })
  })
  describe('createApplier', function() {
    it('should create property applier for the structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      // the applier function depends on the prop [SETTERS] and [KEYS], which are set
      // by defineStructure()
      const Hello = env.defineStructure(structure);
      const object = new Hello(undefined);
      const f = env.createApplier(structure);
      expect(f).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(16), 8);
      dv.setBigInt64(0, 1234n, true);
      const count1 = f.call(object, { dataView: dv });
      expect(count1).to.equal(1);
      expect(object.$).to.equal(1234n);
      const count2 = f.call(object, {});
      expect(count2).to.equal(0);
    })
    it('should throw when an unrecognized prop is encountered', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      // the applier function depends on the prop [SETTERS] and [KEYS], which are set
      // by defineStructure()
      const Hello = env.defineStructure(structure);
      const object = new Hello(undefined);
      const f = env.createApplier(structure);
      expect(() => f.call(object, { cow: 1234 })).to.throw(TypeError)
        .with.property('message').that.contains('cow');
    })
  })
  describe('defineDestructor', function() {
    const env = new Env;
    it('should return descriptor for destructor', function() {
      const env = new Env;
      const descriptor = env.defineDestructor();
      expect(descriptor.value).to.be.a('function');
      const object = defineProperty({
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      }, 'delete', descriptor);
      let target;
      env.releaseFixedView = (dv) => {
        target = dv;
      };
      expect(() => object.delete()).to.not.throw();
      expect(target).to.be.a('DataView');
    })
  })
  describe('finalizeStructure', function() {
    it('should add special properties to constructor', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure,
        }
      ];
      const Hello = env.defineStructure(structure);
      env.finalizeStructure(structure);
      expect(Hello.name).to.equal('Hello');
      expect(Hello[ALIGN]).to.equal(4);
      expect(Hello[SIZE]).to.equal(8);
    })
    it('should call type-specific finalization method', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure,
        }
      ];
      const Hello = env.defineStructure(structure);
      env.finalizeStructure(structure);
      // finalizePrimitive() in mixin "structure/primitive" adds property [TYPE_ARRAY]
      expect(Hello[TYPED_ARRAY]).to.equal(BigInt64Array);
    })
    it('should attach variables to a struct', function() {
      // define structure for integer variables
      const env = new Env;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: int1,
          1: int2,
        },
      }, true);
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      expect(() => Hello.supercat = 777).to.throw();
      expect(Hello.supercat).to.equal(4567);
      const object = new Hello(undefined);
      expect(object.dog).to.equal(0);
      object.dog = 123;
      expect(object.dog).to.equal(123);
      expect(Hello.superdog).to.equal(43);
      const descriptors = Object.getOwnPropertyDescriptors(Hello);
      expect(descriptors.superdog.set).to.be.a('function');
      expect(descriptors.supercat.set).to.be.a('function');
      const names = [], values = [];
      for (const [ name, value ] of Hello) {
        names.push(name);
        values.push(value);
      }
      expect(names).to.eql([ 'superdog', 'supercat' ]);
      expect(values).to.eql([ 43, 4567 ]);
      expect(Hello.valueOf()).to.eql({ superdog: 43, supercat: 4567 });
      expect(JSON.stringify(Hello)).to.eql('{"superdog":43,"supercat":4567}');
      expect(() => Hello.supercat = 123).to.throw();
    })
    it('should attach variables to an enum', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Enum,
        flags: StructureFlag.HasValue,
        name: 'Hello'
      });
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        slot: 0,
        structure: intStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        slot: 1,
        structure: intStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: int1,
          1: int2,
        },
      }, true);
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      // make sure the variables aren't overwriting the enum slots
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should attach method to a struct', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 12,
        length: 1,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 32,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      const ArgStruct = env.defineStructure(argStruct);
      env.endStructure(argStruct);
      const fnStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(fnStructure, {
        type: MemberType.Object,
        structure: argStruct,
      });
      const thunk = { [MEMORY]: fixed(0x1234) };
      env.attachTemplate(fnStructure, thunk, false);
      const Func = env.defineStructure(fnStructure);
      env.finalizeStructure(fnStructure);
      env.attachMember(structure, {
        name: 'merge',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsMethod,
        structure: fnStructure,
        slot: 0,
      }, true);
      const fn = Func.call(ENVIRONMENT, fixed(0x4567));
      expect(fn).to.be.a('function');
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: fn,
        }
      }, true);
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Hello.merge).to.be.a('function');
      expect(Hello.merge).to.have.property('name', 'merge');
      expect(Hello.prototype.merge).to.be.a('function');
      expect(Hello.prototype.merge).to.have.property('name', 'merge');
      const object = new Hello({});
      object.dog = 10;
      object.cat = 13;
      let call, argBuffer;
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
      } else if (process.env.TARGET === 'node') {
        env.getBufferAddress = function(buffer) {
          argBuffer = buffer;
          return usize(0x0000_f000);
        };
      }
      env.runThunk = function(thunkAddress, fnAddress, argAddress) {
        let argDV;
        if (process.env.TARGET === 'wasm') {
          argDV = new DataView(env.memory.buffer, argAddress, ArgStruct[SIZE]);
        } else {
          argDV = new DataView(argBuffer, 0, ArgStruct[SIZE]);
        }
        call = { thunkAddress, fnAddress, argDV };
        const dog = argDV.getInt32(4, true);
        const cat = argDV.getInt32(8, true);
        argDV.setInt32(0, dog + cat, true);
        return true;
      };
      const res1 = object.merge();
      expect(res1).to.equal(23);
      object.dog = 20;
      const res2 = object.merge();
      expect(res2).to.equal(33);
      expect(call.thunkAddress).to.equal(usize(0x1234));
      expect(call.fnAddress).to.equal(usize(0x4567));
    })
    it('should attach getter and setter to a struct', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      const getterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 12,
        length: 1,
      });
      env.attachMember(getterArgStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(getterArgStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 32,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      env.defineStructure(getterArgStruct);
      env.endStructure(getterArgStruct);
      const getterStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn (Hello) i32',
        byteSize: 0,
      });
      env.attachMember(getterStructure, {
        type: MemberType.Object,
        structure: getterArgStruct,
      });
      const getterThunk = { [MEMORY]: fixed(0x1234) };
      env.attachTemplate(getterStructure, getterThunk, false);
      const Getter = env.defineStructure(getterStructure);
      env.endStructure(getterStructure);
      env.attachMember(structure, {
        name: 'get  apple',
        type: MemberType.Object,
        flags: MemberFlag.IsMethod,
        slot: 0,
        structure: getterStructure,
      }, true);
      const setterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 12,
        length: 2,
      });
      env.attachMember(setterArgStruct, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: {},
      });
      env.attachMember(setterArgStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 0,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      env.attachMember(setterArgStruct, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: structure.byteSize * 8,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(setterArgStruct);
      env.endStructure(setterArgStruct);
      const setterStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn (Hello, i32) void',
        byteSize: 0,
      });
      env.attachMember(setterStructure, {
        type: MemberType.Object,
        structure: setterArgStruct,
      });
      const setterThunk = { [MEMORY]: fixed(0x4567) };
      env.attachTemplate(setterStructure, setterThunk, false);
      const Setter = env.defineStructure(setterStructure);
      env.endStructure(setterStructure);
      env.attachMember(structure, {
        name: 'set apple',
        type: MemberType.Object,
        flags: MemberFlag.IsMethod,
        slot: 1,
        structure: setterStructure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Getter.call(ENVIRONMENT, fixed(0x12345)),
          1: Setter.call(ENVIRONMENT, fixed(0x45678)),
        }
      }, true);
      env.endStructure(structure);
      const object = new Hello({ dog: 1, cat: 2 });
      let apple = 123;
      const thunkAddresses = [];
      env.invokeThunk = (thunk, fn, args) => {
        const thunkAddress = env.getViewAddress(thunk[MEMORY]);
        const fnAddress = env.getViewAddress(fn[MEMORY]);
        thunkAddresses.push(thunkAddress);
        switch (fnAddress) {
          case usize(0x12345): // getter
             args.retval = apple;
            break;
          case usize(0x45678): // setter
            apple = args[1];
            break;
        }
        return args.retval;
      };
      expect(object.apple).to.equal(123);
      object.apple = 456;
      expect(apple).to.equal(456);
      expect(thunkAddresses).to.eql([ usize(0x1234), usize(0x4567) ]);
    })
    it('should attach static getter and setter to a struct', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 0,
      });
      const Hello = env.defineStructure(structure);
      const getterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 4,
        length: 0,
      });
      env.attachMember(getterArgStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(getterArgStruct);
      env.endStructure(getterArgStruct);
      const getterStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn () i32',
        byteSize: 0,
      });
      env.attachMember(getterStructure, {
        type: MemberType.Object,
        structure: getterArgStruct,
      });
      const getterThunk = { [MEMORY]: fixed(0x1234) };
      env.attachTemplate(getterStructure, getterThunk, false);
      const Getter = env.defineStructure(getterStructure);
      env.endStructure(getterStructure);
      env.attachMember(structure, {
        name: 'get  apple',
        type: MemberType.Object,
        slot: 0,
        structure: getterStructure,
      }, true);
      const setterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 4,
        length: 1,
      });
      env.attachMember(setterArgStruct, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: {},
      });
      env.attachMember(setterArgStruct, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(setterArgStruct);
      env.endStructure(setterArgStruct);
      const setterStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn (i32) void',
        byteSize: 0,
      });
      env.attachMember(setterStructure, {
        type: MemberType.Object,
        structure: setterArgStruct,
      });
      const setterThunk = { [MEMORY]: fixed(0x4567) };
      env.attachTemplate(setterStructure, setterThunk, false);
      const Setter = env.defineStructure(setterStructure);
      env.endStructure(setterStructure);
      env.attachMember(structure, {
        name: 'set apple',
        type: MemberType.Object,
        slot: 1,
        structure: setterStructure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Getter.call(ENVIRONMENT, fixed(0x12345)),
          1: Setter.call(ENVIRONMENT, fixed(0x45678)),
        }
      }, true);
      env.endStructure(structure);
      let apple = 123;
      const thunkAddresses = [];
      env.invokeThunk = (thunk, fn, args) => {
        const thunkAddress = env.getViewAddress(thunk[MEMORY]);
        const fnAddress = env.getViewAddress(fn[MEMORY]);
        thunkAddresses.push(thunkAddress);
        switch (fnAddress) {
          case usize(0x12345): // getter
             args.retval = apple;
            break;
          case usize(0x45678): // setter
            apple = args[0];
            break;
        }
        return args.retval;
      };
      expect(Hello.apple).to.equal(123);
      Hello.apple = 456;
      expect(apple).to.equal(456);
      expect(thunkAddresses).to.eql([ usize(0x1234), usize(0x4567) ]);
    })
  })
  describe('getTypedArray', function() {
    it('should return typed array constructor for integer primitive', function() {
      let index = 0;
      const types = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        BigInt64Array,
        BigUint64Array,
      ];
      const env = new Env;
      for (const byteSize of [ 1, 2, 4, 8 ]) {
        for (const type of [ MemberType.Int, MemberType.Uint ]) {
          const structure = {
            type: StructureType.Primitive,
            instance: {
              members: [
                {
                  type,
                  bitSize: byteSize * 8,
                  byteSize,
                }
              ]
            }
          };
          const f = env.getTypedArray(structure);
          expect(f).to.be.a('function');
          expect(f).to.equal(types[index++]);
        }
      }
    })
    it('should return a typed array constructor for non-standard integer', function() {
      const structure = {
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 36,
              byteSize: 8,
            }
          ]
        }
      };
      const env = new Env;
      const f = env.getTypedArray(structure);
      expect(f).to.equal(BigUint64Array);
    })
    it('should return typed array constructor for floating point', function() {
      let index = 0;
      const types = [
        undefined,
        Float32Array,
        Float64Array,
        undefined,
      ];
      const env = new Env;
      for (const byteSize of [ 2, 4, 8, 16 ]) {
        const structure = {
          type: StructureType.Primitive,
          instance: {
            members: [
              {
                type: MemberType.Float,
                bitSize: byteSize * 8,
                byteSize,
              }
            ]
          }
        };
        const f = env.getTypedArray(structure);
        expect(f).to.equal(types[index++]);
      }
    })
    it('should return type array constructor of child elements', function() {
      const structure = {
        type: StructureType.Array,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 32 * 4,
              byteSize: 4 * 4,
              structure: {
                type: StructureType.Primitive,
                instance: {
                  members: [
                    {
                      type: MemberType.Float,
                      bitSize: 32,
                      byteSize: 4,
                    }
                  ]
                }
              }
            }
          ]
        }
      };
      const env = new Env;
      const f = env.getTypedArray(structure);
      expect(f).to.equal(Float32Array);
    })
  })
})

function fixed(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[FIXED] = { address: usize(address), len };
  return dv;
}
