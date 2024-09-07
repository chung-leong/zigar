import 'mocha-skip-if';

import { WebAssemblyEnvironment } from '../src/environment-wasm.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';

describe('VariadicStruct functions', function() {
  const env = new WebAssemblyEnvironment();
  describe('defineVariadicStruct', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
  })
})

