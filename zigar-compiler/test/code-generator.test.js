import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { stat, utimes } from 'fs/promises';

use(ChaiAsPromised);

import {
  generateCode,
} from '../src/code-generator.js';
import { StructureType } from '../../zigar-runtime/src/structure.js';
import { MemberType } from '../../zigar-runtime/src/member.js';
import { MEMORY, SLOTS, STRUCTURE } from '../../zigar-runtime/src/symbol.js';

describe('Code generation', function() {
  describe('generateCode', function() {
    it('should generate code for defining a standard int type', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "i32",
        size: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              isSigned: true,
              isConst: false,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useInt()');
      expect(code).to.contain('i32');
    })
    it('should generate code for defining a non-standard int type', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "i31",
        size: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              isSigned: true,
              isConst: false,
              bitOffset: 0,
              bitSize: 31,
              byteSize: 4,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useIntEx()');
      expect(code).to.not.contain('useInt()');
      expect(code).to.contain('i31');
    })
    it('should generate code for defining a standard float type', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "f32",
        size: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Float,
              isConst: false,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useFloat()');
      expect(code).to.contain('f32');
    })
    it('should generate code for defining a non-standard float type', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "f80",
        size: 16,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Float,
              isConst: false,
              bitOffset: 0,
              bitSize: 80,
              byteSize: 16,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useFloatEx()');
      expect(code).to.not.contain('useFloat()');
      expect(code).to.contain('f80');
    })
    it('should generate code for defining a standard boolean type', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "bool",
        size: 1,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Bool,
              isConst: false,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 1,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useBool()');
      expect(code).to.contain('bool');
    })
    it('should generate code for defining bitfields', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "flags",
        size: 1,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Bool,
              name: "option1",
              isConst: false,
              bitOffset: 0,
              bitSize: 1,
            },
            {
              type: MemberType.Bool,
              name: "option2",
              isConst: false,
              bitOffset: 1,
              bitSize: 1,
            },
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], {});
      expect(code).to.contain('useBoolEx()');
      expect(code).to.not.contain('useBool()');
      expect(code).to.contain('flags');
    })
    it('should generate code for defining a standard enum type', function() {
      const enumSetStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        size: 2,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "enumItem",
        size: 2,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.EnumerationItem,
              isConst: false,
              bitOffset: 0,
              bitSize: 16,
              byteSize: 2,
              structure: enumSetStructure,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ enumSetStructure, structure ], {});
      expect(code).to.contain('useEnumerationItem()');
      expect(code).to.contain('enumItem');
      expect(code).to.contain('enum {}');
    })
    it('should generate code for defining a non-standard enum type', function() {
      const enumSetStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        size: 2,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "enumItem",
        size: 2,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.EnumerationItem,
              isConst: false,
              bitOffset: 3,
              bitSize: 16,
              structure: enumSetStructure,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ enumSetStructure, structure ], {});
      expect(code).to.contain('useEnumerationItemEx()');
      expect(code).to.contain('enumItem');
      expect(code).to.contain('enum {}');
    })
    it('should generate code for exporting types', function() {
      const enumSetStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Enumeration,
        name: "enum {}",
        size: 2,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "package",
        size: 0,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Type,
              name: 'Enum',
              isConst: false,
              structure: enumSetStructure,
            },
          ],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ enumSetStructure, structure ], {});
      expect(code).to.contain('useType()');
      expect(code).to.contain('package');
      expect(code).to.contain('Enum');
    })
    it('should generate code for exporting a constant', function() {
      const ptrStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Pointer,
        name: "*int32",
        size: 0,
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
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "package",
        size: 0,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Object,
              name: "panda",
              isSigned: true,
              isConst: true,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: ptrStructure,
            }
          ],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ ptrStructure, structure ], {});
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('usePointer()');
      expect(code).to.contain('panda');
    })
    it('should generate code for exporting a function', function() {
      const argStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Pointer,
        name: "hello",
        size: 0,
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
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "package",
        size: 0,
        hasPointer: false,
        instance: {
          members: [],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [
          {
            name: "hello",
            isStaticOnly: true,
            thunk: 123,
            argStruct: argStructure,
          }
        ],
        options: {},
      };
      const code = generateCode([ argStructure, structure ], { loadWASM: `loadWASM()`, topLevelAwait: true });
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('hello');
      expect(code).to.contain('await __init');
      const codeAlt = generateCode([ argStructure, structure ], { loadWASM: `loadWASM()`, topLevelAwait: false });
      expect(codeAlt).to.not.contain('await __init');
    })
    it('should generate code for exporting a struct with default values', function() {
      const memory = new DataView(new ArrayBuffer(8), 4, 4);
      memory.address = 0x12341234;
      const structStructure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "struct {}",
        size: 4,
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
          template: {
            [MEMORY]: memory,
            [SLOTS]: {
              '0': {
                [STRUCTURE]: {},
              }
            },
          },
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Struct,
        name: "package",
        size: 0,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Type,
              name: 'Hello',
              structure: structStructure,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structStructure, structure ], { loadWASM: `loadWASM()`, topLevelAwait: true });
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('Hello');
    })
    it('should import linkModule when loadWASM is truthy', function() {
      const structure = {
        constructor: null,
        initializer: null,
        pointerCopier: null,
        pointerResetter: null,
        type: StructureType.Primitive,
        name: "i32",
        size: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              isSigned: true,
              isConst: false,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            }
          ],
          template: null,
        },
        static: {
          members: [],
          template: null,
        },
        methods: [],
        options: {},
      };
      const code = generateCode([ structure ], { loadWASM: 'loadWASM()'});
      expect(code).to.contain('linkModule');
      expect(code).to.contain('loadWASM()');
    })
    it('should break initializer into multiple lines when the number of structures is large', function() {
      const structures = [];
      for (let bitSize = 2; bitSize <= 64; bitSize++) {
        structures.push({
          constructor: null,
          initializer: null,
          pointerCopier: null,
          pointerResetter: null,
          type: StructureType.Primitive,
          name: `i${bitSize}`,
          size: 8,
          hasPointer: false,
          instance: {
            members: [
              {
                type: MemberType.Int,
                isSigned: true,
                isConst: false,
                bitOffset: 0,
                bitSize,
                byteSize: 8,
              }
            ],
            template: null,
          },
          static: {
            members: [],
            template: null,
          },
          methods: [],
          options: {},
        });
       }
      const code = generateCode(structures, {});
      expect(code).to.contain('i32');
      expect(code).to.contain('i64');
    })
  })
})
