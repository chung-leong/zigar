import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';

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
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              isSigned: true,
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
        isConst: false,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              isSigned: true,
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
          methods: [],
          template: null,
        },
        static: {
          members: [
            {
              type: MemberType.Object,
              name: "panda",
              isSigned: true,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: ptrStructure,
            }
          ],
          methods: [],
          template: null,
        },
        options: {},
      };
      const code = generateCode([ ptrStructure, structure ], {});
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('usePointer()');
      // find export section
      const m = /export \{([\s\S]*)\}/.exec(code);
      expect(m).to.not.be.null;
      expect(m[1]).to.contain('panda,');
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
        options: {},
      };
      const code = generateCode([ argStructure, structure ], { loadWASM: `loadWASM()`, topLevelAwait: true });
      expect(code).to.contain('package');
      expect(code).to.contain('useStruct()');
      expect(code).to.contain('hello');
      expect(code).to.contain('await __init');
      expect(code).to.contain('writeBack: false');
      const codeAlt = generateCode([ argStructure, structure ], { loadWASM: `loadWASM()`, topLevelAwait: false });
      expect(codeAlt).to.not.contain('await __init');
      expect(codeAlt).to.contain('writeBack: true');
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
          methods: [],
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
          methods: [],
          template: null,
        },
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
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
          isConst: false,
          hasPointer: false,
          instance: {
            members: [
              {
                type: MemberType.Int,
                isSigned: true,
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
          options: {},
        });
       }
      const code = generateCode(structures, {});
      expect(code).to.contain('i32');
      expect(code).to.contain('i64');
    })
  })
})
