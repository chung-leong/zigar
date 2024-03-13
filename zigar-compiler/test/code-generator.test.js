import { expect } from 'chai';

import { MemberType, hasStandardFloatSize } from '../../zigar-runtime/src/member.js';
import { StructureType } from '../../zigar-runtime/src/structure.js';
import { CONST, MEMORY, SLOTS } from '../../zigar-runtime/src/symbol.js';
import { generateCode } from '../src/code-generator.js';

describe('Code generation', function() {
  const options = {
    littleEndian: true,
    runtimeSafety: true,
  };
  describe('generateCode', function() {
    const params = {
      declareFeatures: true,
    };
    it('should generate code for defining a standard int type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "i32",
        byteSize: 4,
        isConst: false,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useInt()');
      expect(code).to.contain('i32');
      expect(code).to.not.contain('const source =');
    })
    it('should generate code for defining a non-standard int type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "i31",
        byteSize: 4,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 31,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useExtendedInt()');
      expect(code).to.contain('useInt()');
      expect(code).to.contain('i31');
    })
    it('should generate code for defining a standard uint type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "u32",
        byteSize: 4,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Uint,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useUint()');
      expect(code).to.contain('u32');
    })
    it('should generate code for defining a non-standard uint type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "u31",
        byteSize: 4,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitOffset: 0,
              bitSize: 31,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useExtendedUint()');
      expect(code).to.contain('useUint()');
      expect(code).to.contain('u31');
    })
    it('should generate code for defining a standard float type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "f32",
        byteSize: 4,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Float,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useFloat()');
      expect(code).to.contain('f32');
    })
    it('should generate code for defining a non-standard float type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "f80",
        byteSize: 16,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 80,
              byteSize: 16,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useExtendedFloat()');
      expect(code).to.contain('useFloat()');
      expect(code).to.contain('f80');
    })
    it('should generate code for defining a standard boolean type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "bool",
        byteSize: 1,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Bool,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 1,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useBool()');
      expect(code).to.contain('bool');
    })
    it('should generate code for defining bitfields', function() {
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: "flags",
        byteSize: 1,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Bool,
              name: "option1",
              bitOffset: 0,
              bitSize: 1,
            },
            {
              type: MemberType.Bool,
              name: "option2",
              bitOffset: 1,
              bitSize: 1,
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
      const def = { structures: [ structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useBool()');
      expect(code).to.contain('useExtendedBool()');
      expect(code).to.contain('flags');
    })
    it('should generate code for defining a standard enum type', function() {
      const enumSetStructure = {
        constructor: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        byteSize: 2,
        hasPointer: false,
        instance: {
          members: [ 
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 16,
              byteSize: 2,
              structure: {},
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
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "enumItem",
        byteSize: 2,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.EnumerationItem,
              bitOffset: 0,
              bitSize: 16,
              byteSize: 2,
              structure: enumSetStructure,
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
      const def = { structures: [ enumSetStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useEnumerationItem()');
      expect(code).to.contain('enumItem');
      expect(code).to.contain('enum {}');
    })
    it('should generate code for defining a non-standard enum type', function() {
      const enumSetStructure = {
        constructor: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        byteSize: 2,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 16,
              byteSize: 2,
              structure: {},
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
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: "enumItem",
        byteSize: 2,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.EnumerationItem,
              bitOffset: 3,
              bitSize: 16,
              structure: enumSetStructure,
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
      const def = { structures: [ enumSetStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useEnumerationItem()');
      expect(code).to.contain('enumItem');
      expect(code).to.contain('enum {}');
    })
    it('should generate code for exporting types', function() {
      const enumSetStructure = {
        constructor: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        byteSize: 2,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: "package",
        byteSize: 0,
        isConst: false,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Type,
              name: 'Enum',
              structure: enumSetStructure,
            },
          ],
          methods: [],
          template: null,
        },
      };
      const def = { structures: [ enumSetStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('useType()');
      expect(code).to.contain('package');
      expect(code).to.contain('Enum');
    })
    it('should generate code for exporting a constant', function() {
      const ptrStructure = {
        constructor: null,
        type: StructureType.Pointer,
        name: "*int32",
        byteSize: 0,
        isConst: true,
        hasPointer: true,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              slot: 0,
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
      const structure = {
        constructor: function() {},
        type: StructureType.Struct,
        name: "package",
        byteSize: 0,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Comptime,
              name: "panda",
              slot: 0,
              structure: ptrStructure,
            }
          ],
          methods: [],
          template: null,
        },
      };
      const def = { structures: [ ptrStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('usePointer()');
      // find export section
      const m = /export const \{([\s\S]*)\} = constructor/.exec(code);
      expect(m).to.not.be.null;
      expect(m[1]).to.contain('panda');
    })
    it('should generate code for exporting a function', function() {
      const argStructure = {
        constructor: null,
        type: StructureType.Pointer,
        name: "hello",
        byteSize: 0,
        hasPointer: true,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
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
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: "package",
        byteSize: 0,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [
            {
              name: "hello",
              thunk: 123,
              argStruct: argStructure,
            }
          ],
          template: null,
        },
      };
      const def = { structures: [ argStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, { binarySource: `loadWASM()`, topLevelAwait: true, ...params });
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      const m = /export const \{([\s\S]*)\} = constructor/.exec(code);
      expect(m).to.not.be.null;
      expect(m[1]).to.contain('hello');
      expect(code).to.contain('await __zigar.init()');
      expect(code).to.contain('env.linkVariables(false)');
      const { code: codeAlt } = generateCode(def, { binarySource: `loadWASM()`, topLevelAwait: false });
      expect(codeAlt).to.not.contain('await __zigar.init()');
      expect(codeAlt).to.contain('env.linkVariables(true)');
    })
    it('should generate code for exporting a struct with default values', function() {
      const memory = new DataView(new ArrayBuffer(8), 4, 4);
      memory.address = 0x12341234;
      const structStructure = {
        constructor: null,
        type: StructureType.Struct,
        name: 'struct {}',
        byteSize: 4,
        hasPointer: hasStandardFloatSize,
        instance: {
          members: [
            {
              type: MemberType.Int,
              name: 'number',
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            },
          ],
          methods: [],
          template: {
            [MEMORY]: memory,
            [SLOTS]: {
              '0': {}
            },
          },
        },
        static: {
          members: [],
          methods: [],
        },
      };
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: 'package',
        byteSize: 0,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Type,
              name: 'Hello',
              structure: structStructure,
            }
          ],
          methods: [],
          template: null,
        },
      };
      const def = { structures: [ structStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('Hello');
    })
    it('should generate code for exporting a struct with static variable', function() {
      const i32 = {
        [MEMORY]: (() => { 
          const dv = new DataView(new ArrayBuffer(4));
          dv.reloc = 0x0100_0000;
          return dv;
        })(),
        [CONST]: true,
      };
      const structStructure = {
        constructor: null,
        type: StructureType.Struct,
        name: "struct {}",
        byteSize: 4,
        hasPointer: true,
        instance: {
          members: [
            {
              type: MemberType.Static,
              name: 'number',
              slot: 0,
            },
          ],
          methods: [],
        },
        static: {
          members: [],
          methods: [],
          template: {
            [MEMORY]: new DataView(new ArrayBuffer()),
            [SLOTS]: {
              0: i32,
            }
          },
        },
      };
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: 'package',
        byteSize: 0,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Type,
              name: 'Hello',
              structure: structStructure,
            }
          ],
          methods: [],
          template: null,
        },
      };
      const def = { structures: [ structStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('useStatic()');
      expect(code).to.contain('Hello');
    })
    it('should omit exports when omitExports is true', function() {
      const structStructure = {
        constructor: null,
        type: StructureType.Struct,
        name: "struct {}",
        byteSize: 4,
        hasPointer: true,
        instance: {
          members: [
            {
              type: MemberType.Int,
              name: "number",
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            },
          ],
          methods: [],
          template: {
            [SLOTS]: {},
          },
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const structure = {
        constructor: null,
        type: StructureType.Struct,
        name: "package",
        byteSize: 0,
        hasPointer: false,
        instance: {
          members: [],
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Type,
              name: 'Hello',
              structure: structStructure,
            }
          ],
          methods: [],
          template: null,
        },
      };
      const def = { structures: [ structStructure, structure ], options, keys: { MEMORY, SLOTS, CONST }};
      const { code, exports } = generateCode(def, { omitExports: true, ...params });
      expect(code).to.not.contain('export {');
      expect(exports).to.contain('__zigar');
    })
    it('should break initializer into multiple lines when the number of structures is large', function() {
      const structures = [];
      for (let bitSize = 2; bitSize <= 64; bitSize++) {
        structures.push({
          constructor: null,
          type: StructureType.Primitive,
          name: `i${bitSize}`,
          byteSize: 8,
          isConst: false,
          hasPointer: false,
          instance: {
            members: [
              {
                type: MemberType.Int,
                bitOffset: 0,
                bitSize,
                byteSize: 8,
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
        });
      }
      const def = { structures, options, keys: { MEMORY, SLOTS, CONST }};
      const { code } = generateCode(def, params);
    })
  })
})
