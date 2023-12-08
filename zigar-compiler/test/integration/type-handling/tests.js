import * as BoolTests from './bool/tests.js';
import * as ComptimeFloatTests from './comptime-float/tests.js';
import * as ComptimeIntTests from './comptime-int/tests.js';
import * as EnumTests from './enum/tests.js';
import * as EnumLiteralTests from './enum-literal/tests.js';
import * as ErrorSetTests from './error-set/tests.js';
import * as ErrorUnionTests from './error-union/tests.js';
import * as FloatTests from './float/tests.js';
import * as FnTestTests from './fn/tests.js';
import * as IntTests from './int/tests.js';
import * as NoReturnTests from './no-return/tests.js';
import * as NullTests from './null/tests.js';
import * as OpaqueTests from './opaque/tests.js';
import * as OptionalTests from './optional/tests.js';
import * as TypeTests from './type/tests.js';
import * as UndefinedTests from './undefined/tests.js';
import * as VectorTests from './vector/tests.js';
import * as VoidTests from './void/tests.js';

export function addTests(importModule, options) {
  describe('Type handling', function() {
    BoolTests.addTests(importModule, options);
    ComptimeFloatTests.addTests(importModule, options);
    ComptimeIntTests.addTests(importModule, options);
    EnumTests.addTests(importModule, options);
    EnumLiteralTests.addTests(importModule, options);
    ErrorSetTests.addTests(importModule, options);
    ErrorUnionTests.addTests(importModule, options);
    FloatTests.addTests(importModule, options);
    FnTestTests.addTests(importModule, options);
    IntTests.addTests(importModule, options);
    NoReturnTests.addTests(importModule, options);
    NullTests.addTests(importModule, options);
    OpaqueTests.addTests(importModule, options);
    OptionalTests.addTests(importModule, options);
    TypeTests.addTests(importModule, options);
    UndefinedTests.addTests(importModule, options);
    VectorTests.addTests(importModule, options);
    VoidTests.addTests(importModule, options);
  })
}
