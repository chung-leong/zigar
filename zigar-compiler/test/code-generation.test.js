import { expect } from 'chai';

import { MemberType, StructureType } from '../../zigar-runtime/src/constants.js';
import { SLOTS } from '../../zigar-runtime/src/symbols.js';
import { generateCode } from '../src/code-generation.js';

describe('Code generation', function() {
  const settings = {
    littleEndian: true,
    runtimeSafety: true,
    libc: false,
  };
  describe('generateCode', function() {
    const params = {
      declareFeatures: true,
      binarySource: '"/somewhere.wasm"',
    };
    it('should generate code for defining a standard int type', function() {
      const structure = {
        constructor: null,
        type: StructureType.Primitive,
        name: 'i32',
        signature: 0xdead_beefn,
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
      const def = { structures: [ structure ], settings };
      const { code } = generateCode(def, { ...params, binarySource: null });
      expect(code).to.contain('deadbeef');
      expect(code).to.contain('i32');
      expect(code).to.not.contain('const source =');
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
      const def = { structures: [ structStructure, structure ], settings };
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
      const def = { structures, settings };
      const { code } = generateCode(def, params);
    })
    it('should include settings for environment', function() {
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
      const moduleOptions = { addonPath: '/tmp/somewhere' };
      const def = { structures: [ structure ], settings };
      const { code } = generateCode(def, { ...params, moduleOptions });
      expect(code).to.contain('addonPath');
      expect(code).to.contain('/tmp/somewhere');
    })
  })
})
